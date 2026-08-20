import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description"),
    isPinned: boolean("isPinned").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("projects_user_pinned_updated_idx").on(table.userId, table.isPinned, table.updatedAt)],
);

export const themePreference = mysqlEnum("theme_preference", ["light", "dark", "system"]);
export const fontSizePreference = mysqlEnum("font_size_preference", ["compact", "comfortable", "large"]);
export const accentPreference = mysqlEnum("accent_preference", ["lime", "sky", "violet"]);
export const privacyMode = mysqlEnum("privacy_mode", ["strict", "standard"]);
export const assistantModePreference = mysqlEnum("assistant_mode", ["balanced", "study", "developer", "creative"]);

export const userSettings = mysqlTable(
  "user_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    theme: themePreference.notNull().default("light"),
    fontSize: fontSizePreference.notNull().default("comfortable"),
    accent: accentPreference.notNull().default("lime"),
    assistantMode: assistantModePreference.notNull().default("balanced"),
    preferredModel: varchar("preferredModel", { length: 128 }),
    memoryEnabled: boolean("memoryEnabled").notNull().default(true),
    privacy: privacyMode.notNull().default("strict"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("user_settings_user_idx").on(table.userId)],
);

export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    projectId: int("projectId"),
    provider: varchar("provider", { length: 32 }).notNull().default("omniroute"),
    model: varchar("model", { length: 128 }),
    title: varchar("title", { length: 255 }).notNull().default("New conversation"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  },
  table => [
    index("conversations_user_last_message_idx").on(table.userId, table.lastMessageAt),
    index("conversations_user_project_idx").on(table.userId, table.projectId),
  ],
);

export const messageRole = mysqlEnum("message_role", ["user", "assistant"]);
export const messageStatus = mysqlEnum("message_status", ["complete", "streaming", "error"]);

export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    userId: int("userId").notNull(),
    role: messageRole.notNull(),
    content: text("content").notNull(),
    status: messageStatus.notNull().default("complete"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    index("messages_user_conversation_idx").on(table.userId, table.conversationId),
  ],
);

export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    conversationId: int("conversationId").notNull(),
    messageId: int("messageId"),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 127 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    extractedText: text("extractedText"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("attachments_user_conversation_idx").on(table.userId, table.conversationId),
    index("attachments_message_idx").on(table.messageId),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type ChatMessage = typeof messages.$inferSelect;
export type InsertChatMessage = typeof messages.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;
