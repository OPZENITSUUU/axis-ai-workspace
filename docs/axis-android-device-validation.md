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

Open the AXIS companion and confirm its branded dark loading state resolves to the published AXIS workspace. If the app displays its connection-retry screen, test **Try again** only after the device has network access. When a linked page or OAuth page is in the WebView history, Android’s system Back control should return through that history before leaving the companion.

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
| Android Back | Open an in-workspace link or OAuth page, then press the Android system Back control once. | The companion returns through WebView history before Android exits the app. | Short redacted screen recording. |

## Acceptance and limitations

The companion is ready for the first Android milestone only when each relevant row has been observed on a physical device or emulator. A successful Expo type-check and web export confirm bundle health, but they do **not** prove Android cookie persistence, WebView OAuth return behavior, runtime microphone permission, or file-picker behavior.

The source and web-bundle validation was refreshed on 20 August 2026 after adding a dark AXIS loading surface, explicit retry handling for loading and HTTP failures, least-privilege audio-capture WebView permission handling, and Android browser-history Back support. These improvements remain subject to the physical-device checks above.

Record any failed row with Android version, Expo Go version, device/emulator model, a redacted screenshot, and the exact action that triggered it. The owner can then supply that evidence for a targeted AXIS fix.

## Personal preview APK build

On 20 August 2026, AXIS was initialized as the owner’s **personal** Expo project, `@opzenitsu/axis-mobile`, with EAS project ID `b1ee2df9-96a8-4d00-b59d-6dde1b3adc66`. The previously supplied project ID was intentionally not reused because it belonged to a different app slug, `opzenitsu69-`; AXIS retains the `axis-mobile` app identity and Android package `space.manus.axis.mobile`.

The internal-distribution Android **preview APK** build completed successfully. Install it on an Android test device from the authenticated Expo build page:

```text
https://expo.dev/accounts/opzenitsu/projects/axis-mobile/builds/4d209b28-68e6-42bb-9783-a9a467ed5a70
```

Expo generated and retained the remote Android signing keystore. The short-lived access token used for setup remains server-side and should be revoked in Expo once no further builds are needed. Completing the physical-device matrix above is still required before claiming native OAuth, microphone, file-picker, and WebView behavior as validated.

## Build-usage export evidence

The owner-provided Expo build-usage export covers 1 August through 1 September 2026. It contains **one Android Medium build** on `2026-08-21T00:00:00.000Z` and zero Android Large, iOS Medium, and iOS Large builds. The export is account-level and does not identify a project or build ID, so it does not independently attribute the row to AXIS; however, its single Android build entry is consistent with the completed AXIS preview APK submission in this period.

Project-scoped Expo evidence then confirmed the attribution: build `4d209b28-68e6-42bb-9783-a9a467ed5a70` belongs to `@opzenitsu/axis-mobile`, is an **Android internal distribution** APK using the `preview` profile, and finished on 21 August 2026. Expo reports a total build time of **9 minutes 17 seconds** and a 13-day artifact availability window. This verifies the completed APK independently of the account-level CSV export.
