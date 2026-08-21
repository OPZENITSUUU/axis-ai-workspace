import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import webpush from "web-push";

describe("AXIS web-push credentials", () => {
  it("creates a signed push-service request with the configured VAPID credentials", () => {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    expect(subject).toMatch(/^https:\/\//);
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    const subscriptionKey = crypto.createECDH("prime256v1");
    subscriptionKey.generateKeys();
    const request = webpush.generateRequestDetails({
      endpoint: "https://example.push.invalid/axis-test",
      keys: {
        p256dh: subscriptionKey.getPublicKey().toString("base64url"),
        auth: crypto.randomBytes(16).toString("base64url"),
      },
    }, JSON.stringify({ title: "AXIS task complete" }));

    expect(request.headers.Authorization).toContain("vapid");
  });
});
