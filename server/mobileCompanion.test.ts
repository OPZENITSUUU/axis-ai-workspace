import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS Android companion foundation", () => {
  it("keeps the native shell pointed at the published AXIS domain without bundling provider credentials", async () => {
    const root = path.join(process.cwd(), "mobile", "axis-mobile");
    const [appConfig, config, screen, packageJson, readme, deviceChecklist, easConfig, theme] = await Promise.all([
      readFile(path.join(root, "app.json"), "utf8"),
      readFile(path.join(root, "src", "config.ts"), "utf8"),
      readFile(path.join(root, "app", "index.tsx"), "utf8"),
      readFile(path.join(root, "package.json"), "utf8"),
      readFile(path.join(root, "README.md"), "utf8"),
      readFile(path.join(process.cwd(), "docs", "axis-android-device-validation.md"), "utf8"),
      readFile(path.join(root, "eas.json"), "utf8"),
      readFile(path.join(root, "src", "theme.ts"), "utf8"),
    ]);

    expect(config).toContain("https://persaiassist-u5z3cgkj.manus.space");
    expect(config).not.toContain("OMNIROUTE_API_KEY");
    expect(screen).toContain("WebView");
    expect(screen).toContain("sharedCookiesEnabled");
    expect(screen).toContain("thirdPartyCookiesEnabled");
    expect(screen).toContain("onPermissionRequest");
    expect(screen).toContain("ANDROID_AUDIO_CAPTURE");
    expect(screen).toContain("onNavigationStateChange");
    expect(screen).toContain("hardwareBackPress");
    expect(screen).toContain("onHttpError");
    expect(screen).toContain("openAuthSessionAsync");
    expect(screen).toContain("axis-mobile-login");
    expect(screen).toContain("injectedJavaScriptBeforeContentLoaded");
    expect(screen).toContain("Continue securely");
    expect(screen).toContain("Try again");
    expect(screen).toContain("AXIS_WEB_URL");
    expect(appConfig).toContain("RECORD_AUDIO");
    expect(appConfig).toContain('"userInterfaceStyle": "dark"');
    expect(packageJson).toContain("react-native-webview");
    expect(packageJson).toContain("expo-web-browser");
    expect(packageJson).toContain("expo-linking");
    expect(packageJson).toContain("apk:preview");
    expect(readme).toContain("pnpm typecheck");
    expect(readme).toContain("expo export --platform web");
    expect(readme).toContain("pnpm apk:preview");
    expect(readme).toContain("physical Android device or emulator");
    expect(deviceChecklist).toContain("Manus OAuth");
    expect(deviceChecklist).toContain("Private workspace");
    expect(deviceChecklist).toContain("Voice");
    expect(deviceChecklist).toContain("Error recovery");
    expect(deviceChecklist).not.toContain("OMNIROUTE_API_KEY");
    expect(easConfig).toContain('"buildType": "apk"');
    expect(easConfig).toContain('"distribution": "internal"');
    expect(screen).toContain("axisMobileTheme");
    expect(screen).toContain("editorialTokens");
    expect(theme).toContain("iridescentSphere");
    expect(theme).toContain("radiusInteractive");
  });
});
