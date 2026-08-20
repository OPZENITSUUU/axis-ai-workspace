import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import { PDFParse } from "pdf-parse";
import {
  createAttachment,
  createConversation,
  createMessage,
  getAttachmentsByIds,
  getConversationForUser,
  getMessagesForConversation,
  renameConversation,
} from "./db";
import { ChatTurn } from "./geminiProvider";
import { getProviderStatus, isProviderId, streamModelResponse } from "./modelProvider";
import { getOmniRouteReadiness } from "./omniRouteProvider";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl, storagePut } from "./storage";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_PROMPT = 4;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function getAuthenticatedUser(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user) return user;
  } catch {
    // Invalid or missing OAuth sessions must not reveal route internals.
  }
  if (!res.headersSent) {
    res.status(401).json({ error: "Please sign in to use personal chat." });
  }
  return null;
}

function sendEvent(res: Response, event: string, data: unknown) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function isSafeFileName(fileName: string) {
  return fileName.trim().replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "attachment";
}

function toAttachmentPart(mimeType: string, data: string) {
  return { inlineData: { mimeType, data } } as const;
}

async function extractAttachmentText(mimeType: string, buffer: Buffer) {
  if (mimeType.startsWith("text/")) return buffer.toString("utf8").slice(0, 100_000);
  if (mimeType !== "application/pdf") return null;

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim().slice(0, 100_000) || null;
  } finally {
    await parser.destroy();
  }
}

export function registerChatRoutes(app: Express) {
  app.post("/api/chat/upload", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const { conversationId, fileName, mimeType, base64Data } = req.body as Record<string, unknown>;
      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "A valid conversation is required before uploading a file." });
        return;
      }

      if (typeof fileName !== "string" || typeof mimeType !== "string" || typeof base64Data !== "string") {
        res.status(400).json({ error: "File metadata is incomplete." });
        return;
      }

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(415).json({ error: "Use a PDF, TXT, Markdown, PNG, JPEG, or WebP file." });
        return;
      }

      const conversation = await getConversationForUser(user.id, id);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found." });
        return;
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE_BYTES) {
        res.status(413).json({ error: "Files must be between 1 byte and 10 MB." });
        return;
      }

      const safeName = isSafeFileName(fileName);
      const { key } = await storagePut(
        `chat/${user.id}/${id}/${nanoid(10)}-${safeName}`,
        buffer,
        mimeType,
      );
      const extractedText = await extractAttachmentText(mimeType, buffer);
      const attachment = await createAttachment({
        userId: user.id,
        conversationId: id,
        fileName: safeName,
        mimeType,
        storageKey: key,
        sizeBytes: buffer.length,
        extractedText,
      });

      res.status(201).json({
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
      });
    } catch (error) {
      console.error("[Chat upload]", error);
      res.status(500).json({ error: "The attachment could not be saved." });
    }
  });

  app.post("/api/chat/stream", async (req, res) => {
    const controller = new AbortController();
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const body = req.body as { conversationId?: number; content?: string; attachmentIds?: number[] };
      const content = body.content?.trim();
      if (!content) {
        res.status(400).json({ error: "A message is required." });
        return;
      }
      if (content.length > 20_000) {
        res.status(413).json({ error: "Messages are limited to 20,000 characters." });
        return;
      }
      const providerStatus = getProviderStatus();
      if (!providerStatus.ready) {
        res.status(503).json({ error: "Live chat is paused until the approved OmniRoute gateway is configured." });
        return;
      }
      if (providerStatus.id === "omniroute") {
        const readiness = await getOmniRouteReadiness();
        if (!readiness.ready) {
          res.status(503).json({ error: readiness.message });
          return;
        }
      }

      let conversation = body.conversationId
        ? await getConversationForUser(user.id, Number(body.conversationId))
        : undefined;
      if (!conversation) {
        conversation = await createConversation(user.id, content.slice(0, 80), null, providerStatus.id, providerStatus.model);
      }

      const attachmentIds = Array.isArray(body.attachmentIds)
        ? body.attachmentIds.filter(id => Number.isInteger(id)).slice(0, MAX_ATTACHMENTS_PER_PROMPT)
        : [];
      const attachments = await getAttachmentsByIds(user.id, conversation.id, attachmentIds);

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.on("close", () => controller.abort());

      sendEvent(res, "conversation", { id: conversation.id, title: conversation.title });
      const previousMessages = await getMessagesForConversation(user.id, conversation.id);
      await createMessage(user.id, conversation.id, "user", content);

      const modelTurns: ChatTurn[] = previousMessages.map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

      const messageParts: ChatTurn["parts"] = [{ text: content }];
      for (const attachment of attachments) {
        if (attachment.extractedText) {
          messageParts.push({
            text: `\n\nAttached file: ${attachment.fileName}\n${attachment.extractedText}`,
          });
          continue;
        }

        const signedUrl = await storageGetSignedUrl(attachment.storageKey);
        const fileResponse = await fetch(signedUrl, { signal: controller.signal });
        if (!fileResponse.ok) throw new Error(`Could not read ${attachment.fileName}`);
        const bytes = Buffer.from(await fileResponse.arrayBuffer());
        messageParts.push(toAttachmentPart(attachment.mimeType, bytes.toString("base64")));
      }
      modelTurns.push({ role: "user", parts: messageParts });

      let responseText = "";
      const preferredProvider = isProviderId(conversation.provider) ? conversation.provider : undefined;
      for await (const chunk of streamModelResponse(modelTurns, controller.signal, preferredProvider, conversation.model, notice => {
        sendEvent(res, "provider_fallback", notice);
      })) {
        responseText += chunk;
        sendEvent(res, "token", { text: chunk });
      }

      await createMessage(user.id, conversation.id, "assistant", responseText || "I could not generate a response.");
      if (conversation.title === "New conversation") {
        await renameConversation(user.id, conversation.id, content.slice(0, 80));
      }
      sendEvent(res, "done", { conversationId: conversation.id });
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The chat request failed.";
      console.error("[Chat stream]", error);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        sendEvent(res, "error", { error: message });
        res.end();
      }
    }
  });
}
