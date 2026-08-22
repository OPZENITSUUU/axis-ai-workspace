import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android APK website download", () => {
  it("offers the current Android APK across entry, workspace, and mobile controls", async () => {
    const home = await readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(home).toContain("iW1GkaK1bBhe3d6HYg1qljvzEtnX24PQnYTBWA7nDZc.apk");
    expect(home).toContain("window.location.assign(AXIS_ANDROID_APK_URL)");
    expect(home).toContain("Download Android APK");
    expect(home).toContain('label="Android APK"');
    expect(home).toContain("Download AXIS 0.6.1 directly for Android.");
  });
});
