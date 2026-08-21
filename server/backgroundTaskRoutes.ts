import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import {
  createBackgroundTask,
  createConversation,
  createMessage,
  getAttachmentsByIds,
  getBackgroundTaskForRequest,
  getConversationForUser,
  setBackgroundTaskUserMessage,
} from "./db";
import { getOmniRouteReadiness } from "./omniRouteProvider";
import { getProviderStatus } from "./modelProvider";
import { processOneBackgroundTask } from "./backgroundTaskService";
import { sdk } from "./_core/sdk";

const MAX_ATTACHMENTS_PER_PROMPT = 4;

async function getAuthenticatedUser(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user) return user;
  } catch {
    // Do not reveal private route details for a missing or invalid session.
  }
  if (!res.headersSent) res.status(401).json({ error: "Please sign in to use private background tasks." });
  return null;
}

export function registerBackgroundTaskRoutes(app: Express) {
  app.post("/api/chat/background", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;
      const body = req.body as { conversationId?: number; content?: string; attachmentIds?: number[]; clientRequestId?: string };
      const content = body.content?.trim();
      const clientRequestId = body.clientRequestId?.trim();
      if (!content || content.length > 20_000) {
        res.status(400).json({ error: "A background task needs a message up to 20,000 characters." });
        return;
      }
      if (!clientRequestId || !/^[A-Za-z0-9_-]{12,64}$/.test(clientRequestId)) {
        res.status(400).json({ error: "A valid background task request id is required." });
        return;
      }

      const existingTask = await getBackgroundTaskForRequest(user.id, clientRequestId);
      if (existingTask) {
        res.status(200).json({ task: existingTask, reused: true });
        return;
      }

      const providerStatus = getProviderStatus();
      if (!providerStatus.ready) {
        res.status(503).json({ error: "Background tasks are paused until the approved AI gateway is configured." });
        return;
      }
      if (providerStatus.id === "omniroute") {
        const readiness = await getOmniRouteReadiness();
        if (!readiness.ready) {
          res.status(503).json({ error: readiness.message });
          return;
        }
      }

      let conversation = body.conversationId ? await getConversationForUser(user.id, Number(body.conversationId)) : undefined;
      if (!conversation) conversation = await createConversation(user.id, content.slice(0, 80), null, providerStatus.id, providerStatus.model);
      const attachmentIds = Array.isArray(body.attachmentIds)
        ? body.attachmentIds.filter(id => Number.isInteger(id)).slice(0, MAX_ATTACHMENTS_PER_PROMPT)
        : [];
      const attachments = await getAttachmentsByIds(user.id, conversation.id, attachmentIds);
      if (attachments.length !== attachmentIds.length) {
        res.status(400).json({ error: "One or more private attachments could not be used for this task." });
        return;
      }

      const task = await createBackgroundTask({
        userId: user.id,
        conversationId: conversation.id,
        clientRequestId,
        prompt: content,
        attachmentIds,
        provider: providerStatus.id,
        model: providerStatus.model,
      });
      const userMessage = await createMessage(user.id, conversation.id, "user", content);
      const updatedTask = await setBackgroundTaskUserMessage(task.id, user.id, userMessage.id);
      res.status(202).json({ task: updatedTask ?? task, conversation: { id: conversation.id, title: conversation.title } });
    } catch (error) {
      console.error("[Background task submit]", error);
      res.status(500).json({ error: "The private background task could not be queued." });
    }
  });

  app.post("/api/scheduled/background-tasks", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req) as { isCron?: boolean };
      if (!user?.isCron) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const result = await processOneBackgroundTask();
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background task worker failed.";
      console.error("[Background task worker]", error);
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
