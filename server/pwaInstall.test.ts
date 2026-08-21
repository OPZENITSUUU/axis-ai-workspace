import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS installable PWA shell", () => {
  it("registers a service worker and preserves private API requests outside the cache", async () => {
    const main = await readFile(path.join(process.cwd(), "client/src/main.tsx"), "utf8");
    const worker = await readFile(path.join(process.cwd(), "client/public/sw.js"), "utf8");
    const offline = await readFile(path.join(process.cwd(), "client/public/offline.html"), "utf8");

    expect(main).toContain('navigator.serviceWorker.register("/sw.js"');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('caches.match("/offline.html")');
    expect(offline).toContain("AXIS is offline");
    expect(offline).toContain("never shows cached chat content");
  });

  it("exposes install controls only through the guarded browser install event", async () => {
    const hook = await readFile(path.join(process.cwd(), "client/src/hooks/useInstallPrompt.ts"), "utf8");
    const home = await readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(hook).toContain('window.addEventListener("beforeinstallprompt"');
    expect(hook).toContain('window.addEventListener("appinstalled"');
    expect(home).toContain("Install AXIS");
    expect(home).toContain("handleInstall");
  });
});
