import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS automatic Android companion updates", () => {
  it("configures the compatible preview channel for AXIS 0.6.0", async () => {
    const appConfig = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app.json"), "utf8");
    const easConfig = await readFile(path.join(process.cwd(), "mobile/axis-mobile/eas.json"), "utf8");
    const packageJson = await readFile(path.join(process.cwd(), "mobile/axis-mobile/package.json"), "utf8");

    expect(appConfig).toContain('"version": "0.6.0"');
    expect(appConfig).toContain('"versionCode": 6');
    expect(appConfig).toContain('"expo-notifications"');
    expect(appConfig).toContain('"policy": "appVersion"');
    expect(appConfig).toContain('"checkAutomatically": "ON_LOAD"');
    expect(easConfig).toContain('"channel": "preview"');
    expect(packageJson).toContain('"update:preview"');
  });

  it("checks for and applies a compatible update with a visible transient status", async () => {
    const screen = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app/index.tsx"), "utf8");

    expect(screen).toContain("Updates.useUpdates()");
    expect(screen).toContain("Updates.fetchUpdateAsync()");
    expect(screen).toContain("Updates.reloadAsync()");
    expect(screen).toContain("Updating AXIS to the latest version…");
    expect(screen).toContain("Latest AXIS version ready. Restarting…");
  });
});
