import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  attachments,
  Attachment,
  backgroundTasks,
  BackgroundTask,
  ChatMessage,
  conversations,
  Conversation,
  InsertUser,
  messages,
  notificationDevices,
  NotificationDevice,
  notificationEvents,
  projects,
  Project,
  userSettings,
  UserSettings,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      const normalized = user[field] ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listConversationsForUser(userId: number): Promise<Conversation[]> {
  const db = await requireDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationForUser(userId: number, conversationId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createConversation(
  userId: number,
  title = "New conversation",
  projectId?: number | null,
  provider = "omniroute",
  model?: string | null,
) {
  const db = await requireDb();
  if (projectId !== undefined && projectId !== null && !(await getProjectForUser(userId, projectId))) {
    throw new Error("Project not found");
  }
  const result = await db.insert(conversations).values({ userId, title, projectId: projectId ?? null, provider, model: model ?? null });
  const id = Number((result[0] as { insertId: number }).insertId);
  const conversation = await getConversationForUser(userId, id);
  if (!conversation) throw new Error("Conversation could not be created");
  return conversation;
}

export async function createProject(userId: number, name: string, description?: string) {
  const db = await requireDb();
  const result = await db.insert(projects).values({
    userId,
    name: name.trim().slice(0, 140) || "Untitled project",
    description: description?.trim().slice(0, 10_000) || null,
  });
  const id = Number((result[0] as { insertId: number }).insertId);
  const created = await getProjectForUser(userId, id);
  if (!created) throw new Error("Project could not be created");
  return created;
}

export async function listProjectsForUser(userId: number): Promise<Project[]> {
  const db = await requireDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.isPinned), desc(projects.updatedAt));
}

export async function getProjectForUser(userId: number, projectId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateProjectForUser(
  userId: number,
  projectId: number,
  input: { name?: string; description?: string | null; isPinned?: boolean },
) {
  const db = await requireDb();
  const values: { name?: string; description?: string | null; isPinned?: boolean } = {};
  if (input.name !== undefined) values.name = input.name.trim().slice(0, 140) || "Untitled project";
  if (input.description !== undefined) values.description = input.description?.trim().slice(0, 10_000) || null;
  if (input.isPinned !== undefined) values.isPinned = input.isPinned;
  if (Object.keys(values).length > 0) {
    await db
      .update(projects)
      .set(values)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  }
  return getProjectForUser(userId, projectId);
}

export async function deleteProjectForUser(userId: number, projectId: number) {
  const db = await requireDb();
  await db
    .update(conversations)
    .set({ projectId: null })
    .where(and(eq(conversations.userId, userId), eq(conversations.projectId, projectId)));
  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

export async function setConversationProject(userId: number, conversationId: number, projectId: number | null) {
  const db = await requireDb();
  if (projectId !== null && !(await getProjectForUser(userId, projectId))) return undefined;
  await db
    .update(conversations)
    .set({ projectId })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  return getConversationForUser(userId, conversationId);
}

export async function setConversationProvider(
  userId: number,
  conversationId: number,
  provider: string,
  model: string | null,
) {
  const db = await requireDb();
  await db
    .update(conversations)
    .set({ provider, model })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  return getConversationForUser(userId, conversationId);
}

export async function getUserSettings(userId: number): Promise<UserSettings> {
  const db = await requireDb();
  await db.insert(userSettings).values({ userId }).onDuplicateKeyUpdate({ set: { userId } });
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (!result[0]) throw new Error("User settings could not be initialized");
  return result[0];
}

export async function updateUserSettings(
  userId: number,
  input: Partial<Pick<UserSettings, "theme" | "fontSize" | "accent" | "assistantMode" | "preferredModel" | "memoryEnabled" | "memoryInstructions" | "privacy" | "backgroundTaskNotifications" | "backgroundTaskErrors">>,
) {
  const db = await requireDb();
  await getUserSettings(userId);
  await db.update(userSettings).set(input).where(eq(userSettings.userId, userId));
  return getUserSettings(userId);
}

export async function exportWorkspaceForUser(userId: number) {
  const db = await requireDb();
  const [settings, userProjects, userConversations, userMessages, userAttachments, userTasks, userNotificationEvents] = await Promise.all([
    getUserSettings(userId),
    listProjectsForUser(userId),
    listConversationsForUser(userId),
    db.select().from(messages).where(eq(messages.userId, userId)).orderBy(messages.createdAt),
    db.select().from(attachments).where(eq(attachments.userId, userId)).orderBy(attachments.createdAt),
    db.select().from(backgroundTasks).where(eq(backgroundTasks.userId, userId)).orderBy(backgroundTasks.createdAt),
    db.select().from(notificationEvents).where(eq(notificationEvents.userId, userId)).orderBy(notificationEvents.createdAt),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    settings,
    projects: userProjects,
    conversations: userConversations,
    messages: userMessages,
    attachments: userAttachments,
    backgroundTasks: userTasks.map(({ prompt, ...task }) => ({ ...task, prompt: "[redacted from export: use the linked conversation]" })),
    notificationEvents: userNotificationEvents,
  };
}

export async function deleteWorkspaceDataForUser(userId: number) {
  const db = await requireDb();
  await db.delete(notificationEvents).where(eq(notificationEvents.userId, userId));
  await db.delete(notificationDevices).where(eq(notificationDevices.userId, userId));
  await db.delete(backgroundTasks).where(eq(backgroundTasks.userId, userId));
  await db.delete(attachments).where(eq(attachments.userId, userId));
  await db.delete(messages).where(eq(messages.userId, userId));
  await db.delete(conversations).where(eq(conversations.userId, userId));
  await db.delete(projects).where(eq(projects.userId, userId));
  await db.delete(userSettings).where(eq(userSettings.userId, userId));
}

export async function renameConversation(userId: number, conversationId: number, title: string) {
  const db = await requireDb();
  await db
    .update(conversations)
    .set({ title: title.trim().slice(0, 255) || "New conversation" })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  return getConversationForUser(userId, conversationId);
}

export async function getMessagesForConversation(
  userId: number,
  conversationId: number,
): Promise<ChatMessage[]> {
  const db = await requireDb();
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId)))
    .orderBy(messages.createdAt);
}

export async function createMessage(
  userId: number,
  conversationId: number,
  role: "user" | "assistant",
  content: string,
  status: "complete" | "streaming" | "error" = "complete",
  metrics?: { generationDurationMs?: number | null; generatedWordCount?: number | null },
) {
  const db = await requireDb();
  const result = await db.insert(messages).values({
    userId,
    conversationId,
    role,
    content,
    status,
    generationDurationMs: metrics?.generationDurationMs ?? null,
    generatedWordCount: metrics?.generatedWordCount ?? null,
  });
  const id = Number((result[0] as { insertId: number }).insertId);

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

  const created = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!created[0]) throw new Error("Message could not be created");
  return created[0];
}

export async function getAttachmentsForConversation(
  userId: number,
  conversationId: number,
): Promise<Attachment[]> {
  const db = await requireDb();
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.userId, userId), eq(attachments.conversationId, conversationId)))
    .orderBy(attachments.createdAt);
}

export async function listAttachmentsForUser(userId: number): Promise<Attachment[]> {
  const db = await requireDb();
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.userId, userId))
    .orderBy(desc(attachments.createdAt))
    .limit(50);
}

export async function listCsvAttachmentsForUser(userId: number): Promise<Attachment[]> {
  const db = await requireDb();
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.userId, userId), eq(attachments.mimeType, "text/csv")))
    .orderBy(desc(attachments.createdAt))
    .limit(50);
}

export async function getCsvAttachmentForUser(userId: number, attachmentId: number): Promise<Attachment | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, userId), eq(attachments.mimeType, "text/csv")))
    .limit(1);
  return result[0];
}

function normalizeCsvFileName(fileName: string) {
  const normalized = fileName.trim().slice(0, 251) || "Untitled CSV";
  return normalized.toLowerCase().endsWith(".csv") ? normalized : `${normalized}.csv`;
}

export async function renameCsvAttachmentForUser(userId: number, attachmentId: number, fileName: string) {
  const db = await requireDb();
  const existing = await getCsvAttachmentForUser(userId, attachmentId);
  if (!existing) return undefined;

  await db
    .update(attachments)
    .set({ fileName: normalizeCsvFileName(fileName) })
    .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, userId), eq(attachments.mimeType, "text/csv")));
  return getCsvAttachmentForUser(userId, attachmentId);
}

export async function deleteCsvAttachmentForUser(userId: number, attachmentId: number) {
  const db = await requireDb();
  const existing = await getCsvAttachmentForUser(userId, attachmentId);
  if (!existing) return undefined;

  await db
    .delete(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, userId), eq(attachments.mimeType, "text/csv")));
  return existing;
}

export async function getAttachmentsByIds(
  userId: number,
  conversationId: number,
  attachmentIds: number[],
): Promise<Attachment[]> {
  if (attachmentIds.length === 0) return [];
  const db = await requireDb();
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.userId, userId),
        eq(attachments.conversationId, conversationId),
        inArray(attachments.id, attachmentIds),
      ),
    );
}

export async function createAttachment(input: {
  userId: number;
  conversationId: number;
  fileName: string;
  mimeType: string;
  storageKey: string;
  sizeBytes: number;
  extractedText?: string | null;
}) {
  const db = await requireDb();
  const result = await db.insert(attachments).values(input);
  const id = Number((result[0] as { insertId: number }).insertId);
  const created = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!created[0]) throw new Error("Attachment could not be created");
  return created[0];
}

export async function createBackgroundTask(input: {
  userId: number;
  conversationId: number;
  clientRequestId: string;
  prompt: string;
  attachmentIds: number[];
  provider: string;
  model?: string | null;
  userMessageId?: number | null;
}) {
  const db = await requireDb();
  await db.insert(backgroundTasks).values({
    ...input,
    attachmentIds: JSON.stringify(input.attachmentIds),
    model: input.model ?? null,
    userMessageId: input.userMessageId ?? null,
  }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const dbTask = await db
    .select()
    .from(backgroundTasks)
    .where(and(eq(backgroundTasks.userId, input.userId), eq(backgroundTasks.clientRequestId, input.clientRequestId)))
    .limit(1);
  const task = dbTask[0];
  if (!task) throw new Error("Background task could not be created");
  return task;
}

export async function listBackgroundTasksForUser(userId: number): Promise<BackgroundTask[]> {
  const db = await requireDb();
  return db
    .select()
    .from(backgroundTasks)
    .where(eq(backgroundTasks.userId, userId))
    .orderBy(desc(backgroundTasks.createdAt))
    .limit(30);
}

export async function getBackgroundTaskForUser(userId: number, taskId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(backgroundTasks)
    .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getBackgroundTaskForRequest(userId: number, clientRequestId: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(backgroundTasks)
    .where(and(eq(backgroundTasks.userId, userId), eq(backgroundTasks.clientRequestId, clientRequestId)))
    .limit(1);
  return result[0];
}

export async function setBackgroundTaskUserMessage(taskId: number, userId: number, userMessageId: number) {
  const db = await requireDb();
  await db
    .update(backgroundTasks)
    .set({ userMessageId })
    .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.userId, userId), isNull(backgroundTasks.userMessageId)));
  return getBackgroundTaskForUser(userId, taskId);
}

export async function claimNextBackgroundTask() {
  const db = await requireDb();
  const queued = await db
    .select()
    .from(backgroundTasks)
    .where(eq(backgroundTasks.status, "queued"))
    .orderBy(backgroundTasks.createdAt)
    .limit(1);
  const task = queued[0];
  if (!task) return undefined;

  const result = await db
    .update(backgroundTasks)
    .set({ status: "running", claimedAt: new Date(), attemptCount: task.attemptCount + 1 })
    .where(and(eq(backgroundTasks.id, task.id), eq(backgroundTasks.status, "queued")));
  const affectedRows = Number((result[0] as { affectedRows?: number }).affectedRows ?? 0);
  if (affectedRows !== 1) return undefined;

  return getBackgroundTaskForUser(task.userId, task.id);
}

export async function completeBackgroundTask(taskId: number, assistantMessageId: number) {
  const db = await requireDb();
  await db
    .update(backgroundTasks)
    .set({ status: "completed", assistantMessageId, completedAt: new Date() })
    .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.status, "running")));
}

export async function failBackgroundTask(taskId: number) {
  const db = await requireDb();
  await db
    .update(backgroundTasks)
    .set({ status: "failed", completedAt: new Date() })
    .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.status, "running")));
}

export async function upsertNotificationDevice(input: {
  userId: number;
  provider: "web_push" | "expo_push";
  tokenHash: string;
  expoPushToken?: string | null;
  webPushEndpoint?: string | null;
  webPushP256dh?: string | null;
  webPushAuth?: string | null;
}) {
  const db = await requireDb();
  await db.insert(notificationDevices).values({
    ...input,
    expoPushToken: input.expoPushToken ?? null,
    webPushEndpoint: input.webPushEndpoint ?? null,
    webPushP256dh: input.webPushP256dh ?? null,
    webPushAuth: input.webPushAuth ?? null,
    enabled: true,
    lastSeenAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      userId: input.userId,
      expoPushToken: input.expoPushToken ?? null,
      webPushEndpoint: input.webPushEndpoint ?? null,
      webPushP256dh: input.webPushP256dh ?? null,
      webPushAuth: input.webPushAuth ?? null,
      enabled: true,
      lastSeenAt: new Date(),
    },
  });
  const result = await db
    .select()
    .from(notificationDevices)
    .where(and(eq(notificationDevices.provider, input.provider), eq(notificationDevices.tokenHash, input.tokenHash)))
    .limit(1);
  if (!result[0]) throw new Error("Notification device could not be registered");
  return result[0];
}

export async function listEnabledNotificationDevicesForUser(userId: number): Promise<NotificationDevice[]> {
  const db = await requireDb();
  return db
    .select()
    .from(notificationDevices)
    .where(and(eq(notificationDevices.userId, userId), eq(notificationDevices.enabled, true)));
}

export async function disableNotificationDeviceForUser(userId: number, provider: "web_push" | "expo_push", tokenHash: string) {
  const db = await requireDb();
  await db
    .update(notificationDevices)
    .set({ enabled: false })
    .where(and(eq(notificationDevices.userId, userId), eq(notificationDevices.provider, provider), eq(notificationDevices.tokenHash, tokenHash)));
}

export async function createNotificationEvent(input: {
  userId: number;
  backgroundTaskId: number;
  deviceId: number;
  type: "task_complete" | "task_error";
}) {
  const db = await requireDb();
  const result = await db.insert(notificationEvents).values(input);
  const id = Number((result[0] as { insertId: number }).insertId);
  const event = await db.select().from(notificationEvents).where(eq(notificationEvents.id, id)).limit(1);
  if (!event[0]) throw new Error("Notification event could not be created");
  return event[0];
}

export async function markNotificationEventSent(eventId: number, receiptId?: string | null) {
  const db = await requireDb();
  await db.update(notificationEvents).set({ status: "sent", receiptId: receiptId ?? null, sentAt: new Date() }).where(eq(notificationEvents.id, eventId));
}

export async function markNotificationEventFailed(eventId: number, failureCode: string) {
  const db = await requireDb();
  await db.update(notificationEvents).set({ status: "failed", failureCode: failureCode.slice(0, 128) }).where(eq(notificationEvents.id, eventId));
}
