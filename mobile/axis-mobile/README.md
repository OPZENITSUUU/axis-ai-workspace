# AXIS Mobile

AXIS Mobile is the Android-first Expo companion for the private AXIS workspace. The native shell loads the published AXIS web workspace, while the existing server remains the source of truth for authentication, user-scoped conversations, files, settings, streaming responses, and provider routing.

The companion contains **no AI-provider key, database credential, or private workspace data**.

## Secure Android sign-in

Android WebView cookie storage is not reliable across OAuth redirects. AXIS therefore uses a system-browser sign-in flow rather than asking a user to retry the same WebView login screen.

1. An unauthenticated user taps **Continue securely** in the companion.
2. The system browser completes the normal AXIS OAuth flow.
3. AXIS creates a short-lived, single-use handoff token and returns through the `axis://` deep link.
4. The native shell exchanges that value with AXIS and injects only the resulting Bearer session into the WebView before content loads.

The one-time handoff is SHA-256 hashed server-side, expires in five minutes, and is marked consumed after use. The native app never receives an AI gateway credential.

## Install AXIS 0.6.0

The current internal Android APK includes the secure system-browser sign-in handoff.

| Item | Value |
| --- | --- |
| App version | `0.6.0` |
| Android version code | `6` |
| EAS build | `1d44952c-8c8a-4917-a932-f625a77916f7` |
| APK | [Download AXIS 0.6.0](https://expo.dev/artifacts/eas/Sw4G3-SXtwTyE2zkwYbIdsh9oNLwLYH8B60UmzRp-Mk.apk) |

The same download is available inside the AXIS website from the entry screen, desktop header, mobile actions, Settings, and command palette.

## Local development

```bash
cd mobile/axis-mobile
pnpm install
pnpm typecheck
pnpm exec expo export --platform web --output-dir /tmp/axis-mobile-web-export
pnpm android
```

To submit a new internal Android APK after validating source changes:

```bash
pnpm apk:preview
```

The release profile uses managed remote Android credentials. Do not add a keystore, Firebase client file, service account, API key, or device token to source control.

## Physical-device validation checklist

This remaining validation requires a physical Android device or emulator because desktop browser checks cannot prove the browser-to-app deep-link return or native permissions.

1. Install AXIS 0.6.0 from the APK link and open it.
2. Tap **Continue securely**, complete the browser sign-in, and confirm AXIS returns directly to the workspace without a loop.
3. Confirm only the signed-in user’s conversations, projects, files, settings, and account memory are visible.
4. Try a chat turn, upload/file picker, voice-note microphone prompt, settings, projects, and workspace export; confirm usable success and error states.
5. Enable generic background-task alerts, then verify notification permission, completion alert, and tap routing without private prompt or reply text in the notification.

## Current validation status

Web TypeScript, companion TypeScript, and the AXIS regression suite validate the source contract. The system-browser OAuth handoff, deep-link scheme, one-time exchange, response bootstrap, and automatic-update configuration are covered by regression tests. The final remaining proof is the physical-device checklist above.
