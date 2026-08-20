import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS premium dark visual system", () => {
  it("uses a switchable dark-first theme and includes reduced-motion safeguards", async () => {
    const [app, css, home, themeContext, html] = await Promise.all([
      readFile(path.join(process.cwd(), "client/src/App.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/index.css"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/contexts/ThemeContext.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "client/index.html"), "utf8"),
    ]);

    expect(app).toContain('defaultTheme="dark"');
    expect(app).toContain("switchable");
    expect(app).toContain('path={"/"} component={Home}');
    expect(app).not.toContain("ComponentShowcase");
    expect(app).not.toContain("Tabs");
    expect(css).toContain(".axis-shell");
    expect(css).toContain(".axis-command");
    expect(css).toContain(".axis-warning");
    expect(css).toContain(".axis-message-assistant");
    expect(css).toContain(".axis-settings-choice");
    expect(css).toContain(".axis-entry-primary");
    expect(css).toContain(".axis-user-message");
    expect(css).toContain("--axis-glass");
    expect(css).toContain("--axis-aurora-cyan");
    expect(css).toContain(".axis-active-glass");
    expect(css).toContain("axis-aurora-drift");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("--axis-accent");
    expect(css).toContain(".axis-skeleton");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain(".axis-composer-dock");
    expect(css).toContain("overscroll-behavior: contain");
    expect(home).toContain("axis-shell");
    expect(home).toContain("axis-entry");
    expect(home).toContain("axis-settings-card");
    expect(home).toContain("axis-settings-choice");
    expect(home).toContain("axis-command");
    expect(home).toContain("axis-entry-primary");
    expect(home).toContain("axis-active-glass");
    expect(home).toContain("axis-warning");
    expect(home).toContain("axis-composer-dock");
    expect(home).toContain('enterKeyHint="send"');
    expect(home).toContain('aria-label="Message your AXIS assistant"');
    expect(home).not.toContain("GEMINI_KEY");
    expect(home).toContain("SpeechRecognition");
    expect(home).toContain("navigator.clipboard.writeText");
    expect(home).toContain("speechSynthesis");
    expect(home).toContain("Private voice focus");
    expect(home).toContain('capture="environment"');
    expect(home).toContain("assistantMode");
    expect(home).toContain("exportConversation");
    expect(home).toContain("Private conversation export is ready.");
    expect(home).toContain("/image");
    expect(home).not.toContain("generativelanguage.googleapis.com");
    expect(css).toContain(".axis-message-actions");
    expect(css).toContain(".axis-voice-recording");
    expect(home).toContain('className="axis-skeleton h-20 rounded-2xl"');
    expect(home).not.toContain('h-20 animate-pulse rounded-2xl bg-white');
    expect(themeContext).toContain('"axis:theme:v2"');
    expect(html).toContain("viewport-fit=cover");
    expect(html).not.toContain("maximum-scale=1");
  });
});
