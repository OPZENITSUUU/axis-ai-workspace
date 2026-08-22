import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android companion launch path", () => {
  it("defers background update work until the hosted workspace is available", async () => {
    const screen = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app/index.tsx"), "utf8");

    expect(screen).toContain("if (!isUpdateAvailable || isLoading || loadError) return;");
    expect(screen).toContain("[isUpdateAvailable, isUpdatePending, isLoading, loadError]");
  });

  it("uses one progress-aware loading layer with Android WebView cache and hardware rendering", async () => {
    const screen = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app/index.tsx"), "utf8");
    const packageJson = await readFile(path.join(process.cwd(), "mobile/axis-mobile/package.json"), "utf8");

    expect(screen).toContain('cacheMode="LOAD_DEFAULT"');
    expect(screen).toContain('androidLayerType="hardware"');
    expect(screen).toContain("onLoadProgress");
    expect(screen).toContain("<LoadingState progress={loadProgress} />");
    expect(screen).not.toContain("startInLoadingState");
    expect(screen).not.toContain("renderLoading=");
    expect(packageJson).toContain('"version": "0.6.1"');
  });
});
