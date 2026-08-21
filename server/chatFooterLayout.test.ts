import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const mobileSource = readFileSync(new URL("../mobile/axis-mobile/app/index.tsx", import.meta.url), "utf8");

describe("AXIS shared webview chat footer", () => {
  it("uses the former mobile footer space for the composer without rendering a status or disclaimer", () => {
    expect(homeSource).toContain('min-h-[84px]');
    expect(homeSource).not.toContain("AI can make mistakes. Check important information.");
    expect(homeSource).not.toContain("Online · synced");
    expect(homeSource).not.toContain("WorkspaceStatus");
    expect(stylesSource).toContain("padding-bottom: max(0.5rem, env(safe-area-inset-bottom));");
  });

  it("continues to load the hosted AXIS workspace in the Android WebView", () => {
    expect(mobileSource).toContain("<WebView<{}>");
    expect(mobileSource).toContain("source={{ uri: AXIS_WEB_URL }}");
  });
});
