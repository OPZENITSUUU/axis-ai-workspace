import { beforeEach, describe, expect, it, vi } from "vitest";

const conversation = {
  id: 12,
  userId: 44,
  title: "Private thread",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastMessageAt: new Date(),
};

const dbMocks = vi.hoisted(() => ({
  getConversationForUser: vi.fn(),
  getMessagesForConversation: vi.fn(),
  getAttachmentsForConversation: vi.fn(),
  listConversationsForUser: vi.fn(),
  createConversation: vi.fn(),
  renameConversation: vi.fn(),
  setConversationProject: vi.fn(),
  listProjectsForUser: vi.fn(),
  createProject: vi.fn(),
  updateProjectForUser: vi.fn(),
  deleteProjectForUser: vi.fn(),
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  exportWorkspaceForUser: vi.fn(),
  deleteWorkspaceDataForUser: vi.fn(),
  listAttachmentsForUser: vi.fn(),
  listCsvAttachmentsForUser: vi.fn(),
  renameCsvAttachmentForUser: vi.fn(),
  deleteCsvAttachmentForUser: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(userId: number | null): TrpcContext {
  return {
    user: userId === null ? null : {
      id: userId,
      openId: `user-${userId}`,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("conversations router privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getConversationForUser.mockResolvedValue(conversation);
    dbMocks.getMessagesForConversation.mockResolvedValue([]);
    dbMocks.getAttachmentsForConversation.mockResolvedValue([]);
    dbMocks.createConversation.mockResolvedValue(conversation);
    dbMocks.listProjectsForUser.mockResolvedValue([]);
    dbMocks.getUserSettings.mockResolvedValue({
      id: 1,
      userId: 44,
      theme: "light",
      fontSize: "comfortable",
      accent: "lime",
      preferredModel: null,
      memoryEnabled: true,
      privacy: "strict",
      updatedAt: new Date(),
    });
    dbMocks.exportWorkspaceForUser.mockResolvedValue({ conversations: [], projects: [] });
    dbMocks.listAttachmentsForUser.mockResolvedValue([]);
    dbMocks.listCsvAttachmentsForUser.mockResolvedValue([]);
    dbMocks.renameCsvAttachmentForUser.mockResolvedValue({ id: 22, userId: 44, fileName: "renamed.csv", mimeType: "text/csv" });
    dbMocks.deleteCsvAttachmentForUser.mockResolvedValue({ id: 22, userId: 44, fileName: "renamed.csv", mimeType: "text/csv" });
  });

  it("loads a conversation only through the authenticated user scope", async () => {
    const caller = appRouter.createCaller(createContext(44));
    const result = await caller.conversations.get({ conversationId: 12 });

    expect(dbMocks.getConversationForUser).toHaveBeenCalledWith(44, 12);
    expect(dbMocks.getMessagesForConversation).toHaveBeenCalledWith(44, 12);
    expect(dbMocks.getAttachmentsForConversation).toHaveBeenCalledWith(44, 12);
    expect(result.conversation).toEqual(conversation);
  });

  it("creates a private conversation under the authenticated user with server-approved provider metadata", async () => {
    const caller = appRouter.createCaller(createContext(44));

    await caller.conversations.create({ title: "Private thread" });

    const configuredModel = process.env.OMNIROUTE_MODEL?.trim() || "auto/fast";
    expect(dbMocks.createConversation).toHaveBeenCalledWith(44, "Private thread", undefined, "omniroute", configuredModel);
  });

  it("rejects anonymous requests before any conversation data is queried", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.conversations.get({ conversationId: 12 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(dbMocks.getConversationForUser).not.toHaveBeenCalled();
  });

  it("scopes projects, settings, and exports to the authenticated account", async () => {
    const caller = appRouter.createCaller(createContext(44));

    await caller.projects.list();
    await caller.workspace.settings();
    await caller.workspace.export();

    expect(dbMocks.listProjectsForUser).toHaveBeenCalledWith(44);
    expect(dbMocks.getUserSettings).toHaveBeenCalledWith(44);
    expect(dbMocks.exportWorkspaceForUser).toHaveBeenCalledWith(44);
  });

  it("lists private file metadata only through the authenticated user scope", async () => {
    const caller = appRouter.createCaller(createContext(44));

    await caller.files.list();

    expect(dbMocks.listAttachmentsForUser).toHaveBeenCalledWith(44);
  });

  it("manages CSV metadata only through the authenticated user scope", async () => {
    const caller = appRouter.createCaller(createContext(44));

    await caller.files.listCsv();
    await caller.files.renameCsv({ attachmentId: 22, fileName: "renamed.csv" });
    await caller.files.deleteCsv({ attachmentId: 22, confirmation: "DELETE CSV" });

    expect(dbMocks.listCsvAttachmentsForUser).toHaveBeenCalledWith(44);
    expect(dbMocks.renameCsvAttachmentForUser).toHaveBeenCalledWith(44, 22, "renamed.csv");
    expect(dbMocks.deleteCsvAttachmentForUser).toHaveBeenCalledWith(44, 22);
  });

  it("rejects unknown or improperly confirmed CSV deletion without exposing another user's data", async () => {
    dbMocks.renameCsvAttachmentForUser.mockResolvedValueOnce(undefined);
    dbMocks.deleteCsvAttachmentForUser.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext(55));

    await expect(caller.files.renameCsv({ attachmentId: 22, fileName: "other.csv" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.files.deleteCsv({ attachmentId: 22, confirmation: "DELETE CSV" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.files.deleteCsv({ attachmentId: 22, confirmation: "delete" as "DELETE CSV" })).rejects.toBeDefined();
    expect(dbMocks.renameCsvAttachmentForUser).toHaveBeenCalledWith(55, 22, "other.csv");
    expect(dbMocks.deleteCsvAttachmentForUser).toHaveBeenCalledWith(55, 22);
  });

  it("does not load messages or attachments when another user cannot access a conversation", async () => {
    dbMocks.getConversationForUser.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext(55));

    await expect(caller.conversations.get({ conversationId: 12 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMocks.getConversationForUser).toHaveBeenCalledWith(55, 12);
    expect(dbMocks.getMessagesForConversation).not.toHaveBeenCalled();
    expect(dbMocks.getAttachmentsForConversation).not.toHaveBeenCalled();
  });

  it("rejects anonymous project and workspace access before private data is queried", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.projects.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.workspace.export()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.listProjectsForUser).not.toHaveBeenCalled();
    expect(dbMocks.exportWorkspaceForUser).not.toHaveBeenCalled();
  });

  it("deletes only the authenticated user workspace after explicit confirmation", async () => {
    const caller = appRouter.createCaller(createContext(44));

    await caller.workspace.deleteData({ confirmation: "DELETE MY AXIS DATA" });

    expect(dbMocks.deleteWorkspaceDataForUser).toHaveBeenCalledWith(44);
    await expect(caller.workspace.deleteData({ confirmation: "delete" as "DELETE MY AXIS DATA" })).rejects.toBeDefined();
  });
});
