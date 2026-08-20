# AXIS Android-First Companion Architecture

## First native milestone

The first mobile deliverable is an Expo Android shell in `mobile/axis-mobile`. It opens the published AXIS HTTPS workspace inside a native WebView rather than creating a duplicate database or embedding AI credentials. This gives the Android app the existing Manus OAuth sign-in, strict user-scoped data access, conversations, files, projects, settings, web research, voice transcription, streaming chat, and no-billing provider policy immediately.

| Boundary | Mobile responsibility | Existing AXIS responsibility |
|---|---|---|
| Authentication | Starts the trusted web sign-in flow inside the native shell | Manus OAuth callback, session creation, user lookup |
| Private data | Renders the owner’s authenticated workspace only | User-scoped database, storage, export, and deletion |
| AI routing | Displays provider status without possessing any key | OmniRoute/Gemini configuration, no-billing gate, streaming |
| Future native UX | Replaces screens incrementally after secure mobile token exchange | Stable authenticated API and data contract |

## Security posture

The Android bundle contains only the public AXIS domain. It contains no OmniRoute token, Gemini key, database URL, or user-secret configuration. The same browser-domain session used by the existing AXIS workspace carries authentication; the backend continues to enforce ownership on every private operation. This is an intentional mobile OAuth bridge for the first release, not a native bearer-token implementation.

## Native evolution

Before replacing the WebView with direct tRPC/mobile API calls, AXIS needs a dedicated mobile OAuth callback and short-lived bearer-token exchange designed for secure native storage. That future work will retain the same user-scoped backend rather than create a second identity or data system.
