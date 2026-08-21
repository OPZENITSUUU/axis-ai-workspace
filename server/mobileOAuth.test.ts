import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS mobile OAuth handoff", () => {
  it("uses a short-lived one-time handoff instead of placing a session token in an Android deep link", async () => {
    const source = await readFile(path.join(process.cwd(), "server", "_core", "oauth.ts"), "utf8");
    const schema = await readFile(path.join(process.cwd(), "drizzle", "schema.ts"), "utf8");

    expect(source).toContain('"/api/mobile/oauth/start"');
    expect(source).toContain('"/api/mobile/oauth/exchange"');
    expect(source).toContain("MOBILE_HANDOFF_TTL_MS");
    expect(source).toContain("randomBytes(32)");
    expect(source).toContain("createMobileAuthHandoff");
    expect(source).not.toContain("MOBILE_RETURN_URL}?sessionToken=");
    expect(schema).toContain("mobile_auth_handoffs");
    expect(schema).toContain("handoffHash");
    expect(schema).toContain("consumedAt");
  });
});
