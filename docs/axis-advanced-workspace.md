# AXIS Advanced Workspace Features

AXIS now includes advanced study, developer, and research tools while keeping provider access server-side and all saved workspace records account-scoped. The interaction model remains deliberate: templates populate a draft rather than sending it, focus audio starts only from a user gesture, and page-summary extraction is performed by the server rather than from browser-held credentials.

| Capability | AXIS behavior | Privacy and safety boundary |
|---|---|---|
| **Math and diagrams** | Assistant Markdown renders KaTeX equations and Mermaid diagrams in the message surface. | Mermaid is configured with strict security mode; AXIS does not run arbitrary browser code. |
| **Code-file export** | Each fenced code block receives a local save action using an inferred common extension such as `.py`, `.html`, `.js`, `.ts`, or `.cpp`. | Download generation runs entirely in the browser and never uploads the code block. |
| **Prompt library** | Code review, YouTube script, resume, and simple-explanation templates populate the composer. | Choosing a template never sends a message automatically. |
| **Response metrics** | Completed assistant messages record elapsed model-generation time and generated-word count. | AXIS labels the value as **words**, not a provider token count that it cannot verify accurately. |
| **Memory bank** | Users can save editable private account instructions that influence future conversations when memory is enabled. | The server injects the scoped memory alongside existing account instructions; users can disable it or clear it from Settings. |
| **`/url` summary** | `/url https://example.com optional question` fetches readable page text server-side and asks the configured provider for a summary. | AXIS accepts only public HTTP(S) destinations, blocks local/private addresses and redirects, applies byte and time limits, and treats extracted page text as untrusted reference. |
| **Focus audio** | A user can start or stop low-volume ambient noise generated through the browser audio API. | There are no external audio files, autoplay behavior, listening analytics, or audio uploads. |

> **Deliberate exclusion:** AXIS does not add browser-held API keys, direct browser-to-model calls, autonomous voice loops, arbitrary code execution, fake token accounting, or unrestricted server-side URL proxying.

The `/url` guardrails follow OWASP guidance that user-controlled server fetches need normalized URLs, protocol restrictions, public-destination/IP validation, redirect handling, and strict network bounds. [1] [2]

## Validation

The TypeScript check passed. The full deterministic suite passed with **24 test files**, **65 active tests**, and **2 intentional external-provider skips**. Desktop and Android-WebView-like mobile previews showed stable empty-workspace actions, the prompt and focus controls, expanded composer guidance, and safe bottom-composer spacing. Physical-device validation remains separately tracked because a browser viewport is not a substitute for an installed Android companion.

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP Server-Side Request Forgery Prevention Cheat Sheet"
[2]: https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs "OWASP SSRF Prevention in Node.js"
