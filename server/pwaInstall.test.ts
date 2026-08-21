import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS installable PWA shell", () => {
  it("registers the current worker while preserving the private API cache boundary", async () => {
    const main = await readFile(path.join(process.cwd(), "client/src/main.tsx"), "utf8");
    const worker = await readFile(path.join(process.cwd(), "client/public/sw.js"), "utf8");

    expect(main).toContain('navigator.serviceWorker.register("/sw.js"');
    expect(main).toContain('navigator.serviceWorker.addEventListener("controllerchange"');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('const CACHE_NAME = "axis-app-shell-v4"');
    expect(worker).toContain('caches.match("/offline.html")');
    expect(worker).toContain('self.addEventListener("push"');
    expect(worker).toContain('self.addEventListener("notificationclick"');
  });
});
