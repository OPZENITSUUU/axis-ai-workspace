import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android-first PWA manifest", () => {
  it("declares standalone private-workspace metadata for installable browser shells", async () => {
    const manifestPath = path.join(process.cwd(), "client/public/manifest.webmanifest");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, string>;

    expect(manifest.name).toContain("AXIS");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#20231d");
  });
});
