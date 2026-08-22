import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn() }));

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => database) }));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  desc: (column: unknown) => ({ type: "desc", column }),
  eq: (_column: unknown, value: unknown) => ({ type: "eq", value }),
  inArray: (_column: unknown, values: unknown[]) => ({ type: "inArray", values }),
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

function configureSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit, orderBy });
  const from = vi.fn().mockReturnValue({ where });
  database.select.mockReturnValue({ from });
  return { where, orderBy };
}

async function loadDb() {
  vi.resetModules();
  process.env.DATABASE_URL = "mysql://axis-test";
  return import("./db");
}

describe("private persistence helpers", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("creates a conversation with authenticated ownership and reloads it through the same user scope", async () => {
    const persisted = { id: 91, userId: 7, title: "Research plan", provider: "omniroute", model: "auto/fast" };
    configureSelect([persisted]);
    const values = vi.fn().mockResolvedValue([{ insertId: 91 }]);
    database.insert.mockReturnValue({ values });
    const { createConversation } = await loadDb();

    await expect(createConversation(7, "Research plan", undefined, "omniroute", "auto/fast")).resolves.toEqual(persisted);
    expect(values).toHaveBeenCalledWith({ userId: 7, title: "Research plan", projectId: null, provider: "omniroute", model: "auto/fast" });
  });

  it("loads messages through a matching user and conversation scope in chronological order", async () => {
    const persisted = [{ id: 4, userId: 7, conversationId: 91, role: "user", content: "Hello" }];
    const { where, orderBy } = configureSelect(persisted);
    const { getMessagesForConversation } = await loadDb();

    await expect(getMessagesForConversation(7, 91)).resolves.toEqual(persisted);
    expect(where.mock.calls[0]?.[0]).toMatchObject({ type: "and" });
    expect(orderBy).toHaveBeenCalledOnce();
  });

  it("creates an attachment with owner-scoped storage metadata", async () => {
    const persisted = { id: 55, userId: 7, conversationId: 91, fileName: "brief.txt", storageKey: "private/7/brief.txt", sizeBytes: 42 };
    configureSelect([persisted]);
    const values = vi.fn().mockResolvedValue([{ insertId: 55 }]);
    database.insert.mockReturnValue({ values });
    const { createAttachment } = await loadDb();

    await expect(createAttachment({ userId: 7, conversationId: 91, fileName: "brief.txt", mimeType: "text/plain", storageKey: "private/7/brief.txt", sizeBytes: 42 })).resolves.toEqual(persisted);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, conversationId: 91, storageKey: "private/7/brief.txt" }));
  });

  it("loads attachments only through a matching user and conversation scope", async () => {
    const persisted = [{ id: 55, userId: 7, conversationId: 91, fileName: "brief.txt" }];
    const { where, orderBy } = configureSelect(persisted);
    const { getAttachmentsForConversation } = await loadDb();

    await expect(getAttachmentsForConversation(7, 91)).resolves.toEqual(persisted);
    expect(where.mock.calls[0]?.[0]).toMatchObject({ type: "and" });
    expect(orderBy).toHaveBeenCalledOnce();
  });
});
