# Authenticated Browser Validation

## Desktop workspace and settings evidence

On 21 August 2026, the deployed AXIS workspace was opened in an already authenticated browser session. The workspace rendered an existing private conversation, and only pre-existing content was viewed; no new chat turn was submitted.

The desktop settings overlay rendered successfully above the existing private conversation. Visible controls included account-synced appearance, font-size, accent, assistant-mode, memory, privacy, and preferred-model settings; browser-local Listen speed and pitch controls; owner-approved OmniRoute status; and the private CSV manager entry point. The composer continued to expose private attachment, camera capture, voice input, Voice Focus, and tools actions.

This confirms the authenticated desktop workspace and settings overlay are reachable without a layout failure. It does not replace the remaining physical Android checks for WebView OAuth persistence, native file picking, microphone permission, or Android Back behavior. Command-palette and viewport-specific tablet/mobile overlay capture remain separately tracked.

## Desktop command palette evidence

The authenticated desktop command palette was opened without changing the conversation. It displayed a private-search field plus the expected actions for a new chat, private project, private upload, CSV management, workspace settings, and focus mode. The current private conversation appeared under recent chats; private-file and project result sections remained present without exposing another account’s content. Tablet and mobile authenticated overlay captures are still outstanding.

The same authenticated command-palette structure remained available after a deployed-workspace reload, confirming that the private workspace controls were not limited to a transient client state.

## Private CSV manager smoke check

The authenticated CSV manager opened from the command palette and settled into its scoped empty state: **No private CSV files yet**, with an explicit **Upload CSV** action. The manager stated that only uploads from the signed-in AXIS account appear there. No upload, rename, or deletion action was performed during this smoke check, so no private file data was changed.

## Tablet workspace

At a 768×1024 authenticated viewport, AXIS preserved its two-column private workspace: the conversation sidebar remained readable, the active new-conversation row stayed visually distinct, the empty workspace actions wrapped without overlap, and the composer remained visible above the lower status line. The responsive PWA **Install** action remained available in the tablet top bar. This captures the settled tablet workspace only; a tablet-specific settings or command overlay interaction still requires a viewport-controllable authenticated browser session.
