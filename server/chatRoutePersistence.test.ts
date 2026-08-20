import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  getAttachmentsByIds: vi.fn(),
  getConversationForUser: vi.fn(),
  getMessagesForConversation: vi.fn(),
  getUserSettings: vi.fn(),
  renameConversation: vi.fn(),
}));
const gateway = vi.hoisted(() => ({ getOmniRouteReadiness: vi.fn().mockResolvedValue({ ready: true }) }));

vi.mock("./db", () => db);
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn().mockResolvedValue({ id: 42 }) } }));
vi.mock("./modelProvider", () => ({
  getProviderStatus: vi.fn(() => ({ ready: true, id: "omniroute", model: "agy/gemini-3.6-flash-high" })),
  isProviderId: vi.fn(() => true),
  streamModelResponse: async function* () {
    yield "One ";
    yield "response.";
  },
}));
vi.mock("./omniRouteProvider", () => gateway);
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn(), storagePut: vi.fn() }));

import { registerChatRoutes } from "./chatRoutes";

describe("AXIS chat route persistence", () => {
  it("streams one turn and persists exactly one user and one assistant message for the authenticated user", async () => {
    const handlers = new Map<string, (request: any, response: any) => Promise<void>>();
    registerChatRoutes({ post: (path: string, handler: any) => handlers.set(path, handler) } as any);

    const conversation = { id: 91, title: "New conversation", provider: "omniroute", model: "agy/gemini-3.6-flash-high" };
    db.getConversationForUser.mockResolvedValue(conversation);
    db.getAttachmentsByIds.mockResolvedValue([]);
    db.getMessagesForConversation.mockResolvedValue([]);
    db.getUserSettings.mockResolvedValue({ assistantMode: "balanced" });
    db.createMessage.mockResolvedValue({});

    const writes: string[] = [];
    const response = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      write: vi.fn((value: string) => writes.push(value)),
      end: vi.fn(),
      json: vi.fn(),
    };
    const request = { body: { conversationId: 91, content: "Private prompt", attachmentIds: [] } };

    await handlers.get("/api/chat/stream")!(request, response);

    expect(db.createMessage).toHaveBeenCalledTimes(2);
    expect(db.createMessage).toHaveBeenNthCalledWith(1, 42, 91, "user", "Private prompt");
    expect(db.createMessage).toHaveBeenNthCalledWith(2, 42, 91, "assistant", "One response.");
    expect(writes.filter(value => value.includes("event: token"))).toHaveLength(2);
    expect(writes.some(value => value.includes("event: done"))).toBe(true);
  });

  it("rejects an offline OmniRoute tunnel before it creates a conversation or persists a user message", async () => {
    const handlers = new Map<string, (request: any, response: any) => Promise<void>>();
    registerChatRoutes({ post: (path: string, handler: any) => handlers.set(path, handler) } as any);
    db.createConversation.mockClear();
    db.createMessage.mockClear();
    gateway.getOmniRouteReadiness.mockResolvedValueOnce({ ready: false, message: "The OmniRoute tunnel is offline. Ask the workspace owner to restart it." });

    const response = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn(),
    };
    await handlers.get("/api/chat/stream")!({ body: { content: "Do not persist this" } }, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ error: "The OmniRoute tunnel is offline. Ask the workspace owner to restart it." });
    expect(db.createConversation).not.toHaveBeenCalled();
    expect(db.createMessage).not.toHaveBeenCalled();
  });
});
