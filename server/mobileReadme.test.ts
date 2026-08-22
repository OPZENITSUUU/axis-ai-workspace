import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS mobile release documentation", () => {
  it("documents the current secure sign-in flow, APK artifact, and owner device checklist", async () => {
    const [readme, deviceChecklist] = await Promise.all([
      readFile(path.join(process.cwd(), "mobile/axis-mobile/README.md"), "utf8"),
      readFile(path.join(process.cwd(), "docs/axis-android-device-validation.md"), "utf8"),
    ]);

    expect(readme).toContain("Continue securely");
    expect(readme).toContain("single-use handoff token");
    expect(readme).toContain("0.6.0");
    expect(readme).toContain("1d44952c-8c8a-4917-a932-f625a77916f7");
    expect(readme).toContain("Sw4G3-SXtwTyE2zkwYbIdsh9oNLwLYH8B60UmzRp-Mk.apk");
    expect(readme).toContain("Physical-device validation checklist");
    expect(deviceChecklist).toContain("Secure Manus OAuth return");
    expect(deviceChecklist).toContain("AXIS 0.6.0");
    expect(deviceChecklist).toContain("Continue securely");
    expect(deviceChecklist).not.toContain("0.5.0, sign in");
  });
});
