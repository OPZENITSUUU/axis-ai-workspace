# AXIS Installable PWA

AXIS can now be installed from a supported browser as an app-like private workspace. The release uses a standalone web app manifest, an AXIS-branded icon, browser service-worker registration, and a minimal offline screen. It does not replace the Expo Android companion; the PWA is the zero-download browser installation route.

| Surface | Behavior |
|---|---|
| Browser install prompt | When a browser exposes the standard install event, AXIS shows **Install** in the desktop workspace toolbar, Settings, command palette, and mobile workspace actions. |
| Browser menu fallback | If the browser does not expose an install event, AXIS explains that the user can use the browser menu to install the app. This covers browsers such as iOS Safari that use their own Add to Home Screen flow. |
| Installed state | AXIS detects standalone display mode and changes the settings action to **Installed**. |
| Offline fallback | A small offline screen provides a reconnect action without showing cached private chat content. |

## Privacy and update boundary

The service worker caches the application shell and static presentation assets. It explicitly bypasses `/api/` and OAuth traffic, so it does not cache private tRPC data, assistant messages, attachments, session responses, or provider calls. New deployments update the app-shell cache version and remove previous AXIS app-shell caches during activation.

## Installation steps

1. Open [AXIS](https://persaiassist-u5z3cgkj.manus.space) in Chrome, Edge, or another supported browser.
2. Select the visible **Install** control when offered, or choose **Install app** / **Add to Home screen** from the browser menu.
3. Launch AXIS from the new device icon and sign in normally. The same user-scoped OAuth and server-side provider boundary still applies.

TypeScript validation and the complete suite passed after the PWA release: **55 active tests passed** and two intentionally skipped external gateway probes.
