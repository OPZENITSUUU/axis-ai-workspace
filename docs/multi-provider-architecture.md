# AXIS Multi-Provider Architecture

## Purpose

AXIS will keep one private conversation history while allowing the owner to configure multiple AI providers. The browser selects from providers the server has explicitly enabled; the browser never receives a provider API key.

## Current runtime provider set

| Provider ID | Primary role | Interface | Server-only secret |
|---|---|---|---|
| `omniroute` | Experimental multi-provider gateway | OpenAI-compatible chat completions | `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY` |
| `gemini` | Multimodal fallback for image/PDF-aware chat | Gemini GenerateContent streaming | `GOOGLE_GEMINI_API_KEY` |

## Future adapter queue

Groq, DeepSeek, OpenAI, Anthropic, Mistral, and future compatible services remain planned adapters. They are **not** currently active runtime providers and cannot be selected by the client. Each will require a dedicated server adapter, explicit owner approval, a server-only key, a documented cost/data policy, and tests before being exposed in AXIS.

## Active no-billing policy

AXIS currently runs in **OmniRoute-only safe mode**. It rejects all direct-provider selections, including Gemini and OpenAI, rather than making a potentially billable request. The server will expose only the OmniRoute readiness state to the signed-in user.

This policy protects the AXIS application from directly invoking a paid provider. It does not change any billing or routing settings inside an independently deployed OmniRoute instance; the owner must configure that gateway with only routes they accept.

## Provider selection rules

1. While no-billing safe mode is enabled, AXIS exposes only the owner-configured OmniRoute gateway.
2. A user can select an available provider for a conversation; the selected provider and model are stored with that conversation.
3. The server validates the requested provider against its configured registry before sending any model request.
4. If a provider is unavailable or limited, AXIS reports a clear error and offers the configured fallback rather than silently redirecting private text to another provider.
5. Gemini remains the preferred fallback for direct image/PDF understanding. Text and extracted document content can use any OpenAI-compatible provider.

## Security boundary

```text
React browser → authenticated AXIS server → selected provider API
                         │
                         ├── provider credentials stay here
                         └── private conversation ownership is checked here
```

No provider API key, OmniRoute token, browser cookie, or Manus OAuth token is exposed to the frontend or forwarded to an upstream model provider.

## Compatibility evidence

Groq documents an OpenAI-compatible `/openai/v1/chat/completions` endpoint with Server-Sent Events when `stream: true`. DeepSeek documents an OpenAI-compatible Chat Completions endpoint and streaming through `stream: true`. OpenAI documents streaming chat-completion chunks. [1] [2] [3]

## References

[1]: https://console.groq.com/docs/api-reference "Groq API reference"
[2]: https://api-docs.deepseek.com/ "DeepSeek API documentation"
[3]: https://platform.openai.com/docs/api-reference/chat "OpenAI Chat API reference"
