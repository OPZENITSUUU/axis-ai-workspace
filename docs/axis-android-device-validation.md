# AXIS Android companion device-validation checklist

This checklist closes the validation gap that cannot be simulated by the web export: a real Android WebView must establish the owner’s Manus OAuth session, request native permissions, and hand every private action back to the cloud-hosted AXIS workspace.

> The companion never receives the OmniRoute key, database credential, or Manus session token directly. Do not enter secrets into the native source code or capture them in screenshots.

## Prepare the device or emulator

Use Android with Expo Go, keep the device online, and start the companion from the project folder:

```bash
cd mobile/axis-mobile
pnpm install
pnpm android
```

Open the AXIS companion and confirm its normal loading state resolves to the published AXIS workspace. If the app displays its connection-retry screen, test **Try again** only after the device has network access.

## Owner validation matrix

Complete every row using the same signed-in account. Do not use a second user’s conversations or files as a substitute for private-data verification.

| Flow | Device action | Expected result | Evidence to retain |
|---|---|---|---|
| Manus OAuth | Choose sign in, complete the normal Manus flow, and return to the app. Close and reopen once. | The AXIS WebView returns to the private workspace and keeps its authenticated session where the platform permits cookies. | One redacted screen recording or two screenshots: return from login and reopened signed-in state. |
| Private workspace | Confirm the conversation list, active conversation, and account label after the workspace loads. | Only the signed-in owner’s data appears; no unauthenticated entry screen is shown. | Screenshot with conversation text redacted if sensitive. |
| Chat and provider feedback | Send a harmless test message after the gateway is configured. If the gateway is unavailable, attempt one send instead. | A streamed reply appears, or AXIS shows the persistent gateway-unavailable guidance rather than silently failing. | Screenshot of the reply or of the clear guidance panel. |
| Projects and files | Open a project, create or resume a project conversation, then attach a non-sensitive small test file. | Project context remains scoped to the account and the upload is listed in AXIS. | Screenshot of project entry and attachment name only. |
| Settings and privacy | Open Settings, review theme/accent/privacy, then return to the workspace. | Settings remain responsive and account-scoped; no provider credential is displayed. | Screenshot of settings panel with sensitive fields absent. |
| Research | Run a non-sensitive research query from the AXIS tool. | Results are linked into the current private draft context and are not published as shared history. | Screenshot of sources with query text redacted if necessary. |
| Voice | Start voice input, accept Android microphone permission, record a short non-sensitive phrase, and stop. | Permission is requested only when used; transcription returns to the current private chat. | Screenshot of Android permission prompt or completed transcript. |
| Error recovery | Disable network briefly, observe the retry state, then restore network and retry. | The companion makes the recovery action obvious and restores the shell without exposing credentials. | Screenshot of retry state. |

## Acceptance and limitations

The companion is ready for the first Android milestone only when each relevant row has been observed on a physical device or emulator. A successful Expo type-check and web export confirm bundle health, but they do **not** prove Android cookie persistence, WebView OAuth return behavior, runtime microphone permission, or file-picker behavior.

Record any failed row with Android version, Expo Go version, device/emulator model, a redacted screenshot, and the exact action that triggered it. The owner can then supply that evidence for a targeted AXIS fix.
