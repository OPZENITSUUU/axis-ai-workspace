# AXIS Background Task Alerts

AXIS can queue a private task, finish it outside the active chat stream, and deliver a minimal completion or error alert to the same signed-in user. The notification intentionally contains no prompt, attachment name, generated reply, account identifier, or provider detail. Opening it returns the user to the linked private conversation, where the result remains protected by the normal ownership check.

| Surface | Completion experience | Required opt-in |
| --- | --- | --- |
| AXIS web and installed PWA | The service worker displays a generic task-complete or task-error notification. | The user presses **Enable** in Settings → Background task alerts and grants browser permission. |
| AXIS Android companion | The WebView asks the native companion to request Android notification permission and register an Expo push token for that signed-in AXIS account. | The user presses **Enable** inside the companion and grants Android permission. |
| In-app fallback | A queued or running task remains visible through the account-scoped task status, even if notification permission is declined. | No permission required. |

## Background execution

AXIS persists a user-scoped task before work begins. A platform-managed scheduled worker claims at most one queued task at a time, writes the assistant result back into the original private conversation, and records each delivery attempt. The task request has an idempotency key, so a client retry cannot create a second queued task for the same action.

Browser push subscriptions are tied to the signed-in account and kept server-side. Their endpoint and keys are never returned to a browser list API. When a user deletes workspace data, AXIS removes their task rows, notification devices, and delivery events.

## Android release requirement

The notification capability requires the **AXIS 0.3.0** Android companion (version code 3) because it adds the native notification library and Android channel configuration. It cannot be delivered to the prior APK solely through an over-the-air JavaScript update; the owner must publish and install the new preview APK once. Compatible future JavaScript updates continue using AXIS’s automatic launch-time update behavior.

Android remote delivery also needs Firebase Cloud Messaging (FCM) V1 credentials attached to the existing Expo project. Expo’s official setup requires notification permission, an Expo push token, and Android FCM configuration. Once the project credentials are configured, the server uses the Expo Push Service for the registered device token. [1] [2]

## Testing boundary

The implementation includes deterministic checks for task isolation, idempotency, secret-backed VAPID request signing, PWA push handling, Android registration bridge, and foreground UI. Physical-device confirmation remains necessary for the final Android permission prompt, FCM credential delivery, notification tap handling, and companion WebView behavior.

## References

[1] [Expo, *Push notifications setup*](https://docs.expo.dev/push-notifications/push-notifications-setup/)

[2] [Expo, *Send notifications with the Expo Push Service*](https://docs.expo.dev/push-notifications/sending-notifications/)

[3] [MDN, *Push API*](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
