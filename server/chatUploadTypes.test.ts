import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS private attachment types", () => {
  it("accepts CSV only through the existing authenticated upload route", async () => {
    const [route, workspace] = await Promise.all([
      readFile(path.join(process.cwd(), "server/chatRoutes.ts"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8"),
    ]);

    expect(route).toContain('"text/csv"');
    expect(route).toContain('app.post("/api/chat/upload"');
    expect(route).toContain("getAuthenticatedUser(req, res)");
    expect(route).toContain("getConversationForUser(user.id, id)");
    expect(workspace).toContain('accept=".pdf,.txt,.md,.csv,text/csv,image/jpeg,image/png,image/webp"');
    expect(workspace).toContain("text/csv");
  });
});
