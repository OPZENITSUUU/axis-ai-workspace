import crypto from "node:crypto";
import webpush from "web-push";
import type { BackgroundTask, NotificationDevice } from "../drizzle/schema";
import {
  createNotificationEvent,
  disableNotificationDeviceForUser,
  getUserSettings,
  listEnabledNotificationDevicesForUser,
  markNotificationEventFailed,
  markNotificationEventSent,
} from "./db";
import { ENV } from "./_core/env";

type TaskNotificationType = "task_complete" | "task_error";

export function hashNotificationToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getWebPushPublicKey() {
  return ENV.vapidPublicKey || null;
}

function isWebPushReady() {
  return Boolean(ENV.vapidSubject && ENV.vapidPublicKey && ENV.vapidPrivateKey);
}

function isDeviceNotRegistered(error: unknown) {
  const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
  const details = typeof error === "object" && error && "details" in error ? (error as { details?: { error?: string } }).details : undefined;
  return statusCode === 404 || statusCode === 410 || details?.error === "DeviceNotRegistered";
}

function taskPayload(task: BackgroundTask, type: TaskNotificationType) {
  return {
    title: type === "task_complete" ? "AXIS task complete" : "AXIS task needs attention",
    body: type === "task_complete" ? "Your private task is ready. Open AXIS to view it." : "Your private task could not finish. Open AXIS to review it.",
    url: `/?conversation=${task.conversationId}&task=${task.id}`,
    taskId: task.id,
    conversationId: task.conversationId,
  };
}

async function sendWebPush(device: NotificationDevice, payload: ReturnType<typeof taskPayload>) {
  if (!isWebPushReady() || !device.webPushEndpoint || !device.webPushP256dh || !device.webPushAuth) {
    throw new Error("WEB_PUSH_NOT_CONFIGURED");
  }
  webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  await webpush.sendNotification(
    {
      endpoint: device.webPushEndpoint,
      keys: { p256dh: device.webPushP256dh, auth: device.webPushAuth },
    },
    JSON.stringify(payload),
    { TTL: 300, urgency: "normal" },
  );
}

async function sendExpoPush(device: NotificationDevice, payload: ReturnType<typeof taskPayload>) {
  if (!device.expoPushToken) throw new Error("EXPO_PUSH_TOKEN_MISSING");
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
      ...(ENV.expoPushAccessToken ? { Authorization: `Bearer ${ENV.expoPushAccessToken}` } : {}),
    },
    body: JSON.stringify({
      to: device.expoPushToken,
      title: payload.title,
      body: payload.body,
      data: { url: payload.url, taskId: payload.taskId, conversationId: payload.conversationId },
      channelId: "axis-tasks",
      priority: "default",
    }),
  });
  const result = await response.json().catch(() => ({})) as { data?: Array<{ status?: string; id?: string; details?: { error?: string } }>; errors?: Array<{ message?: string }> };
  if (!response.ok) throw new Error(result.errors?.[0]?.message || `EXPO_PUSH_HTTP_${response.status}`);
  const ticket = result.data?.[0];
  if (!ticket || ticket.status !== "ok") {
    const error = new Error(ticket?.details?.error || "EXPO_PUSH_REJECTED") as Error & { details?: { error?: string } };
    error.details = ticket?.details;
    throw error;
  }
  return ticket.id ?? null;
}

export async function sendTaskNotification(task: BackgroundTask, type: TaskNotificationType) {
  const settings = await getUserSettings(task.userId);
  if (type === "task_complete" && !settings.backgroundTaskNotifications) return { sent: 0, skipped: "disabled" as const };
  if (type === "task_error" && !settings.backgroundTaskErrors) return { sent: 0, skipped: "disabled" as const };

  const devices = await listEnabledNotificationDevicesForUser(task.userId);
  const payload = taskPayload(task, type);
  let sent = 0;
  for (const device of devices) {
    const event = await createNotificationEvent({ userId: task.userId, backgroundTaskId: task.id, deviceId: device.id, type });
    try {
      const receiptId = device.provider === "web_push"
        ? (await sendWebPush(device, payload), null)
        : await sendExpoPush(device, payload);
      await markNotificationEventSent(event.id, receiptId);
      sent += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message : "NOTIFICATION_DELIVERY_FAILED";
      await markNotificationEventFailed(event.id, code);
      if (isDeviceNotRegistered(error)) {
        await disableNotificationDeviceForUser(task.userId, device.provider, device.tokenHash);
      }
      console.warn("[Task notification] Delivery failed", { taskId: task.id, deviceId: device.id, provider: device.provider, code });
    }
  }
  return { sent };
}
