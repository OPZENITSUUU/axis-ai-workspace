import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android APK website download", () => {
  it("offers the current Android APK across entry, workspace, and mobile controls", async () => {
    const home = await readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(home).toContain("Sw4G3-SXtwTyE2zkwYbIdsh9oNLwLYH8B60UmzRp-Mk.apk");
    expect(home).toContain("window.location.assign(AXIS_ANDROID_APK_URL)");
    expect(home).toContain("Download Android APK");
    expect(home).toContain('label="Android APK"');
    expect(home).toContain("Download AXIS 0.6.0 directly for Android.");
  });
});
