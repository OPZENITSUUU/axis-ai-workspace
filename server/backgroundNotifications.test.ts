import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AXIS private background notifications", () => {
  it("persists user-scoped tasks, devices, and delivery events without exporting private task prompts", async () => {
    const schema = await readFile(path.join(process.cwd(), "drizzle/schema.ts"), "utf8");
    const db = await readFile(path.join(process.cwd(), "server/db.ts"), "utf8");

    expect(schema).toContain('"background_tasks"');
    expect(schema).toContain('"notification_devices"');
    expect(schema).toContain('"notification_events"');
    expect(schema).toContain('"background_tasks_user_request_uq"');
    expect(db).toContain('backgroundTasks: userTasks.map(({ prompt, ...task })');
    expect(db).toContain('db.delete(notificationDevices).where(eq(notificationDevices.userId, userId))');
  });

  it("queues private work through an idempotent route and keeps notification copy free of task content", async () => {
    const routes = await readFile(path.join(process.cwd(), "server/backgroundTaskRoutes.ts"), "utf8");
    const notifications = await readFile(path.join(process.cwd(), "server/notificationService.ts"), "utf8");

    expect(routes).toContain('app.post("/api/chat/background"');
    expect(routes).toContain('getBackgroundTaskForRequest');
    expect(routes).toContain('clientRequestId');
    expect(routes).toContain('app.post("/api/scheduled/background-tasks"');
    expect(notifications).toContain('"Your private task is ready. Open AXIS to view it."');
    expect(notifications).not.toContain('task.prompt');
  });

  it("uses explicit opt-in and bridges both service-worker and Expo companion notification flows", async () => {
    const home = await readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const worker = await readFile(path.join(process.cwd(), "client/public/sw.js"), "utf8");
    const mobile = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app/index.tsx"), "utf8");
    const config = await readFile(path.join(process.cwd(), "mobile/axis-mobile/app.json"), "utf8");

    expect(home).toContain('Notification.requestPermission()');
    expect(home).toContain('axis-request-expo-push');
    expect(home).toContain('"/api/chat/background"');
    expect(home).toContain('Background task alerts');
    expect(worker).toContain('self.registration.showNotification');
    expect(worker).toContain('event.notification.data?.url');
    expect(mobile).toContain('Notifications.getExpoPushTokenAsync');
    expect(mobile).toContain('axis-expo-push-token');
    expect(config).toContain('"expo-notifications"');
  });
});
