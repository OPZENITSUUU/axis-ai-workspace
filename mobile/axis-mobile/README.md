# AXIS Mobile

This is the Android-first Expo companion for AXIS. Version `0.1.0` is a **native secure workspace shell**: it loads the published AXIS domain inside a native WebView so that Manus OAuth, account sessions, user-scoped chats, files, projects, settings, streaming chat, voice tools, and server-only provider keys remain in the established backend.

It does not bundle any provider token, database credential, or user data. Native screens can replace the shell incrementally after the server has a dedicated mobile OAuth token-exchange contract.

## Run on Android

```bash
cd mobile/axis-mobile
pnpm install
pnpm android
```

Use an Android emulator or a physical device with Expo Go. Sign in inside the app using the normal AXIS Manus OAuth flow. The trusted AXIS web origin owns the session cookie and every private API request; the native bundle never receives the session token or AI gateway credential.

The Android shell requests microphone access only when the loaded AXIS workspace asks for it, enabling the existing private voice-transcription flow. It grants only the Android audio-capture WebView resource, provides a branded loading state, an in-app retry state for connection failures, and follows browser history when the Android system back button is pressed. File inputs are handled by the Android WebView through the existing AXIS upload route; verify device permissions during the Expo preview before release.

## Validate the first mobile milestone

```bash
pnpm typecheck
pnpm exec expo export --platform web --output-dir /tmp/axis-mobile-web-export
```

The Android build route is `pnpm android`. An APK/AAB release is the next operational step and requires the owner’s Android signing and distribution configuration; no signing credential is stored in this repository.

## Build an installable APK

The companion includes a release-safe EAS preview profile that produces an installable Android APK rather than an app-store bundle. From this directory, run:

```bash
pnpm apk:preview
```

The first run opens or requests an Expo account session, then EAS handles the Android signing credential and returns a private build URL. Sign in only with the account intended to own AXIS releases. Do not create or commit a keystore manually. The `production` profile intentionally produces an Android App Bundle (`.aab`) for Play Store submission rather than an APK.

> This project environment does not include the Android SDK or an authenticated Expo/EAS build connection, so the cloud build needs the release owner to complete the Expo authentication step. The APK profile and source checks are included now to make that handoff deterministic.

### Current APK build status

On 20 August 2026, the available build environment was confirmed to have Java but no Android SDK, Gradle, or configured EAS session. `eas whoami` reported `Not logged in`, so no cloud build was submitted and no APK artifact exists yet. After the owner signs in to Expo/EAS, `pnpm apk:preview` will submit the prepared internal-distribution APK profile and return the private installer URL.

### Latest validated evidence

On 20 August 2026, the refined companion passed `pnpm typecheck` and a fresh `pnpm exec expo export --platform web --output-dir /tmp/axis-mobile-web-export-20260820`, producing `index.html`, metadata, and 21 exported files. The AXIS root type-check and full regression suite also passed with 44 active tests and one intentionally skipped external credential probe. The repository-level `server/mobileCompanion.test.ts` verifies that the shell targets the published AXIS origin, keeps provider credentials outside the native bundle, enables shared WebView cookies, declares Android microphone permission, limits runtime media permission handling to audio capture, handles Android browser-history back navigation, and provides a retry path for loading and HTTP failures.

> These checks verify the source and web bundle only. A physical Android device or emulator is still required to validate the Manus OAuth WebView session, file picker behavior, microphone permission prompt, and every private workspace action.

## Release direction

The next milestones are native conversation navigation, secure mobile token exchange, file picking, microphone transcription, and Android APK/AAB signing. The existing AXIS backend remains the only source of truth for private data and provider routing.
