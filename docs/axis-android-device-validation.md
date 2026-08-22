# AXIS Android companion device-validation checklist

This checklist captures the verification that cannot be proven by source checks alone: a physical Android device or emulator must complete the system-browser sign-in return, establish the private workspace, request native permissions, and use AXIS features without crossing account boundaries.

> The companion never contains an OmniRoute key, database credential, Firebase service-account key, or private chat data. The Manus OAuth session remains in the system browser; AXIS uses a short-lived, single-use server handoff to initialize the WebView session after the app return.

## Install the current preview

Install **AXIS 0.6.0** (Android version code `6`) from the current internal preview artifact:

<https://expo.dev/artifacts/eas/Sw4G3-SXtwTyE2zkwYbIdsh9oNLwLYH8B60UmzRp-Mk.apk>

The tested remote build is `1d44952c-8c8a-4917-a932-f625a77916f7`. It includes the system-browser secure sign-in fix and the Android notification configuration. Do not install the older 0.5.0 build for OAuth-loop validation.

## Prepare the device or emulator

Use a device or emulator with network access. Install the APK, open AXIS, and expect its branded dark loading state to lead to either the workspace or an explicit **Continue securely** action. If the app displays a connection-retry screen, use **Try again** only after network access is restored.

## Owner validation matrix

Complete each applicable row using the same non-sensitive test account. Do not use another person’s conversations or files as a substitute for verifying private-data isolation.

| Flow | Device action | Expected result | Evidence to retain |
| --- | --- | --- | --- |
| Secure Manus OAuth return | Tap **Continue securely**, complete normal sign-in in the system browser, then return through `axis://`. Close and reopen AXIS once. | AXIS returns directly to the private workspace without a login loop. The expired or reused browser-return handoff is rejected safely. | Two redacted screenshots: successful app return and reopened signed-in workspace. |
| Private workspace | Confirm the account label, conversation list, and active workspace after loading. | Only the signed-in account’s conversations, projects, files, settings, and account memory appear. | Screenshot with conversation content redacted if needed. |
| Chat and provider feedback | Send a harmless test prompt after the approved gateway is ready. If it is unavailable, attempt one prompt. | A streamed response appears, or AXIS gives clear persistent gateway-unavailable guidance instead of silently failing. | Redacted reply or guidance panel. |
| Projects and files | Create or resume a project conversation and attach a small non-sensitive file. | Project context and file metadata remain user-scoped. | Project entry and attachment-name screenshot only. |
| Settings and privacy | Open Settings, change a non-sensitive preference, then return to the workspace. | Settings remain responsive and account-scoped; no provider credential is shown. | Redacted settings screenshot. |
| Voice Note | Start voice input, approve Android microphone permission, record a non-sensitive phrase, stop, and review before sending. | Permission is requested only when used; text returns to the draft and is not auto-sent. | Permission prompt or reviewed draft screenshot. |
| Background-task notification | Enable task alerts, start a harmless background task, then background the app. | AXIS privately registers the device and shows a generic completion alert without task content. Tapping the alert returns to AXIS. | Redacted notification and return-to-workspace evidence. |
| Error recovery | Disable network briefly, observe the retry state, restore network, and tap **Try again**. | The companion recovers without exposing credentials or looping between screens. | Retry-state screenshot. |
| Android Back | Open a safe in-workspace link, then press Android Back once. | AXIS returns through WebView history before leaving the app. | Short redacted recording. |

## Acceptance and reporting

The companion passes the Android milestone only after the Secure Manus OAuth return, Private workspace, Voice Note, notification, and Error recovery rows have been observed on a physical Android device or emulator. Web TypeScript, companion TypeScript, and regression tests verify source contracts, but they cannot prove deep-link return, runtime permissions, file-picker behavior, or actual notification delivery.

When a row fails, retain only redacted evidence alongside the Android version, device or emulator model, AXIS version, and exact action. Do not capture a session token, handoff value, private prompt, provider credential, or Firebase configuration.
