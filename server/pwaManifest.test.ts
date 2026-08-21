import { readFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android-first PWA manifest", () => {
  it("declares standalone private-workspace metadata for installable browser shells", async () => {
    const manifestPath = path.join(process.cwd(), "client/public/manifest.webmanifest");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { name: string; display: string; start_url: string; scope: string; theme_color: string; background_color: string; icons: Array<{ src: string; sizes: string; purpose: string }> };

    expect(manifest.name).toContain("AXIS");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBe("#060914");
    expect(manifest.background_color).toBe("#060914");
    expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({ src: expect.stringContaining("axis-pwa-icon-master"), sizes: "1024x1024", purpose: "any maskable" })]));
  });
});
