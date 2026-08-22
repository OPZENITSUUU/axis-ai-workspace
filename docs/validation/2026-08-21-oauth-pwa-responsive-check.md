# AXIS OAuth/PWA Responsive Check — 2026-08-21

## Scope

This passive visual verification checked the published AXIS workspace shell after the system-browser OAuth handoff and service-worker registration updates. No private conversation content was created, viewed, changed, or exported.

## Findings

| Viewport | Result |
| --- | --- |
| Desktop, 1280×720 | The authenticated workspace rendered its midnight-glass sidebar, header controls, empty-state actions, prompt suggestions, and bottom-docked composer without an observable layout break. |
| Narrow mobile, 375×812 | The responsive header, compact action stack, suggestions, and composer rendered within the viewport. The menu entry remained visible and no horizontal overflow was observed in the captured view. |
| Desktop, 1280×720 after APK action update | The top bar rendered a visible **Android APK** action between Focus and Export without crowding or obscuring existing workspace controls. |
| Post-publish mobile, 375×812 | The responsive header and bottom-docked composer remained within the narrow viewport while workspace data loaded; the mobile actions menu remains the entry point for the Android APK option at this width. |
| Authenticated desktop Settings overlay | The live workspace opened the Settings drawer with account-scoped appearance, memory, privacy, notification, model, local voice tuning, Android APK download, CSV management, export, and delete controls. No provider secret was rendered in the exposed controls. |
| Authenticated desktop command palette | The live command palette opened from the workspace header and offered scoped actions for chats, projects, uploads, CSV management, prompts, local focus audio, the Android APK, settings, and focus mode. |
| Authenticated tablet, 768×1024 | The settled midnight-glass workspace retained the sidebar, active conversation state, editorial empty state, quick actions, prompt suggestions, and bottom-docked composer without horizontal overflow. |
| Authenticated narrow mobile, 375×812 | The settled workspace condensed to the menu-led header, stacked quick actions and prompt suggestions, and a visible bottom-docked composer; no horizontal overflow appeared. |
| Authenticated loading and overlay coverage | Captured workspace checks included the neutral message-loading skeleton, the Settings drawer, and the command palette. Animation/entrance effects were not treated as layout evidence. |
| Authenticated passive reload | A direct workspace reload returned to the authenticated AXIS shell; once data settled, the existing private conversation restored without a new prompt, provider request, or temporary duplicate stream preview. This is passive refresh evidence only; the error-state retry control remains separately unverified. |
| Authenticated availability recheck | A later live-session recheck again resolved the signed-in workspace, its private conversation list, Android APK action, Voice Note entry, and bottom composer without issuing a chat request. |
| Public entry APK action | The signed-out AXIS entry screen rendered its `Download Android APK 0.6.0` action alongside the private-workspace sign-in path. The artifact redirect itself is separately verified by HTTP redirect-chain checks. |

## Boundary

This confirms responsive web rendering only. Native Android device verification of the system-browser sign-in return, one-time session handoff, and private workspace loading remains an owner-controlled physical-device test.
