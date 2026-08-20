import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS owner-side OmniRoute tunnel guide", () => {
  it("requires a named HTTPS tunnel with SSE-safe guidance and server-only AXIS configuration", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs", "omniroute-persistent-https-tunnel.md"),
      "utf8",
    );

    expect(guide).toContain("Named Cloudflare Tunnel");
    expect(guide).toContain("do not support Server-Sent Events (SSE)");
    expect(guide).toContain("cloudflared tunnel ingress validate");
    expect(guide).toContain("cloudflared service install");
    expect(guide).toContain("OMNIROUTE_BASE_URL");
    expect(guide).toContain("RUN_OMNIROUTE_CREDENTIAL_CHECK=true");
    expect(guide).toContain("Do not paste it into a tunnel configuration file");
    expect(guide).not.toContain("sk-");
  });
});
