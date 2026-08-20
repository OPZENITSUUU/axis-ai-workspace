# Adaptive Reference Integration

## Purpose

The supplied `pasted_content.txt` reference was reviewed as an **adaptive chat-interface pattern**, not as a replacement application. AXIS retains its private-workspace architecture, midnight-glass design system, user-scoped data model, and server-only provider configuration.

| Reference idea | AXIS update | Outcome |
|---|---|---|
| Edge-to-edge mobile layout | Added `viewport-fit=cover`, dynamic viewport sizing, and safe-area spacing for the top bar, sidebar, composer, and mobile sheet. | The workspace avoids notch and home-indicator collisions. |
| Compact scrolling chat surface | Added contained scroll regions and restrained thin scrollbars. | Conversation content scrolls without displacing the composer dock. |
| Mobile-friendly input dock | Kept the composer in a bounded flex shell; added safe bottom padding, 16px mobile input text, `enterKeyHint`, and clearer accessible labels. | The composer remains visible while empty states or conversations scroll. |
| Touch-first controls | Increased the mobile attach, voice, tools, and send targets to 40px while preserving compact desktop controls. | Mobile actions are easier to use without changing desktop density. |
| Theme adaptation | Retained AXIS’s account-synced dark-first theme with a user-controlled switch. | The user can choose a theme without a system-media override. |

## Intentional AXIS differences

The reference asks users to place a Gemini key in browser local storage and sends it directly from the page. AXIS intentionally does **not** adopt that pattern. Provider credentials remain server-only, chat requests use the authenticated AXIS backend, and conversations, files, projects, and settings stay scoped to the signed-in user.

The reference also prevents browser zoom with a fixed maximum scale. AXIS keeps mobile zoom available for accessibility. The safe-area viewport setting is retained without disabling user scaling.

> The reference can guide responsive interaction design, but it cannot weaken AXIS privacy boundaries or convert the private workspace into a client-key demo.

## Validation

The adapted workspace passed TypeScript validation and the complete AXIS regression suite: **44 active tests passed**, with one deliberately skipped live external credential probe. A 1280×720 desktop capture retained the spacious midnight-glass layout. A 375×812 mobile capture confirmed the corrected dynamic-height shell keeps the composer dock visible beneath the independently scrolling content region.

## Glass-chat interaction update

The later glass-chat reference contributed three additional interactions: an explicit browser voice-input control, private assistant-response **Listen** and **Copy** actions, and visible recording feedback. AXIS uses the browser’s speech-recognition capability only after the user activates the microphone control; a recognized transcript is placed in the existing private draft, where the user can review it before sending. When unsupported or denied, AXIS shows recovery guidance and preserves typing and attachment workflows.

Assistant Listen uses the browser’s local speech-synthesis capability, while Copy writes only the already-rendered assistant content to the user’s clipboard. Neither control sends content to a new third party or changes persisted messages. The mobile 375×812 review confirms the attach, voice, tools, and send controls remain visible in the safe-bottom composer dock.

AXIS deliberately does not add the reference’s client-side Gemini-key storage, direct browser provider fetch, or one-click clear-chat behavior. Provider credentials remain server-only, and permanent private-data deletion continues to require the existing explicit workspace confirmation flow.

## Pro Edition reference update

The Pro Edition reference contributed a contextual **Export** action and `/image` command discovery. AXIS now exports only the currently open private conversation as a local Markdown file, with clear `You` and `AXIS` sections. The original account-level private workspace export remains available in Settings for users who need their chats, projects, settings, and file metadata together.

AXIS recognizes `/image <description>` as an image-generation intent without sending it to an unapproved provider. Until an owner-approved, server-side image provider is integrated, AXIS leaves the prompt in the user’s private draft and gives explicit setup guidance. This intentionally excludes the reference’s direct Pollinations URL pattern, direct browser Gemini call, and any browser-held provider credential. Existing Streamdown rendering continues to handle AXIS Markdown and code presentation without adding external CDN scripts to the application shell.

## Cyber, Voice, Canvas, and Ultimate reference update

The four later references contributed a richer interaction vocabulary without changing AXIS’s privacy model. AXIS now offers an **account-synced assistant mode**—Balanced, Study, Developer, or Creative—inside Settings. The selected style is resolved server-side into a fixed AXIS instruction before a private conversation streams; it is not a browser-held system prompt, API key, or model endpoint selector.

The composer now adds a camera-aware private attachment entry. On supporting mobile browsers it requests an environment-facing image capture through the normal file chooser, then routes the selected image through the existing authenticated, user-scoped attachment upload path. Browser voice input remains explicit and review-first. A new Voice Focus overlay explains that speech stays in the editable draft until the user decides to send it; it does not create an automatic hands-free completion loop.

| Reference capability | AXIS equivalent | Privacy and safety boundary |
|---|---|---|
| Persona/mode selector | Account-synced Balanced, Study, Developer, and Creative response styles. | A server-controlled instruction is added at stream time; no provider credentials reach the browser. |
| Camera scan | Camera-aware private image attachment control. | Uses the existing authenticated attachment flow; no live video stream or unscoped media URL is created. |
| Voice call visualizer | Browser-gated Voice Focus with review-before-send messaging. | No auto-submit, no autonomous recursive listening, and no direct browser provider request. |
| Live code canvas | Existing Markdown/code rendering only. | AXIS does not execute arbitrary assistant HTML/JavaScript in an unsandboxed iframe. |
| Search and image toggles | Existing private research and safe `/image` discovery. | Inactive provider routes remain unavailable until separately approved and server-side integrated. |

The references’ direct API-key local storage, direct Gemini and image-service calls, one-click chat clearing, unsandboxed live-code execution, and automatic voice-to-provider loops remain intentionally excluded.

## Analytics Pro reference update

The latest Analytics Pro reference added two compatible refinements. AXIS now accepts **CSV** alongside its existing private PDF, TXT, Markdown, and image attachments. A CSV follows the same authenticated upload route as every other attachment, is stored under the signed-in user and conversation, and is text-extracted for the already-approved private chat stream. This enables table and dataset discussion without creating a public file link, client-side analytics endpoint, or a new provider route.

AXIS also adds **Browser voice tuning** in Settings. Speech rate and pitch affect only the existing local `Listen` action and are saved only in that signed-in browser’s local preference space. The controls do not transmit voice audio, tuning preferences, or assistant messages to an additional AI service; they simply configure the browser speech-synthesis utterance after the user selects Listen.

| Analytics Pro reference idea | AXIS equivalent | Intentionally excluded |
|---|---|---|
| CSV/document analysis | Private CSV attachment through the existing authenticated upload and user-scoped conversation flow. | Public dataset URLs, browser-held provider keys, and direct browser model calls. |
| Voice speed and pitch | Browser-local tuning for the existing assistant Listen action. | Autonomous voice-call sessions, background recording, and auto-send behavior. |
| Analytics charts | Assistant Markdown can explain or format uploaded data within the ordinary private chat flow. | A client-side chart runtime that fetches data or makes external analytics requests outside AXIS authorization. |
| Live canvas preview | Existing Markdown and code presentation remains available. | Rendering assistant-generated HTML/JavaScript in an unsandboxed iframe. |

Validation after this update passed the TypeScript check and the full suite with **47 active tests passing** and one deliberately skipped external credential probe. Desktop and mobile workspace captures continued to show a stable composer and responsive layout.
