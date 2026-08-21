import type { BackgroundTask } from "../drizzle/schema";
import { getAssistantModeInstruction } from "./assistantMode";
import {
  claimNextBackgroundTask,
  completeBackgroundTask,
  createMessage,
  failBackgroundTask,
  getAttachmentsByIds,
  getConversationForUser,
  getMessagesForConversation,
  getUserSettings,
  renameConversation,
} from "./db";
import { ChatTurn } from "./geminiProvider";
import { isProviderId, streamModelResponse } from "./modelProvider";
import { sendTaskNotification } from "./notificationService";
import { storageGetSignedUrl } from "./storage";

function parseAttachmentIds(raw: string) {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function toAttachmentPart(mimeType: string, data: string) {
  return { inlineData: { mimeType, data } } as const;
}

async function executeBackgroundTask(task: BackgroundTask) {
  const conversation = await getConversationForUser(task.userId, task.conversationId);
  if (!conversation) throw new Error("BACKGROUND_CONVERSATION_NOT_FOUND");

  const [allMessages, settings, attachments] = await Promise.all([
    getMessagesForConversation(task.userId, task.conversationId),
    getUserSettings(task.userId),
    getAttachmentsByIds(task.userId, task.conversationId, parseAttachmentIds(task.attachmentIds)),
  ]);
  const historicalTurns: ChatTurn[] = allMessages
    .filter(message => message.id !== task.userMessageId)
    .map(message => ({ role: message.role === "assistant" ? "model" : "user" as "user", parts: [{ text: message.content }] }));
  const modelTurns: ChatTurn[] = [
    { role: "user", parts: [{ text: getAssistantModeInstruction(settings.assistantMode) }] },
    ...historicalTurns,
  ];
  const messageParts: ChatTurn["parts"] = [{ text: task.prompt }];
  for (const attachment of attachments) {
    if (attachment.extractedText) {
      messageParts.push({ text: `\n\nAttached file: ${attachment.fileName}\n${attachment.extractedText}` });
      continue;
    }
    const signedUrl = await storageGetSignedUrl(attachment.storageKey);
    const fileResponse = await fetch(signedUrl);
    if (!fileResponse.ok) throw new Error("BACKGROUND_ATTACHMENT_UNAVAILABLE");
    const bytes = Buffer.from(await fileResponse.arrayBuffer());
    messageParts.push(toAttachmentPart(attachment.mimeType, bytes.toString("base64")));
  }
  modelTurns.push({ role: "user", parts: messageParts });

  const controller = new AbortController();
  const provider = isProviderId(task.provider) ? task.provider : undefined;
  let responseText = "";
  for await (const chunk of streamModelResponse(modelTurns, controller.signal, provider, task.model)) responseText += chunk;
  const assistantMessage = await createMessage(task.userId, task.conversationId, "assistant", responseText || "I could not generate a response.");
  if (conversation.title === "New conversation") await renameConversation(task.userId, task.conversationId, task.prompt.slice(0, 80));
  await completeBackgroundTask(task.id, assistantMessage.id);
  const completedTask = { ...task, status: "completed" as const, assistantMessageId: assistantMessage.id };
  await sendTaskNotification(completedTask, "task_complete");
}

export async function processOneBackgroundTask() {
  const task = await claimNextBackgroundTask();
  if (!task) return { processed: false as const };
  try {
    await executeBackgroundTask(task);
    return { processed: true as const, taskId: task.id, status: "completed" as const };
  } catch (error) {
    console.error("[Background task] Execution failed", { taskId: task.id, error: error instanceof Error ? error.message : "unknown" });
    await failBackgroundTask(task.id);
    await sendTaskNotification({ ...task, status: "failed" as const }, "task_error");
    return { processed: true as const, taskId: task.id, status: "failed" as const };
  }
}
