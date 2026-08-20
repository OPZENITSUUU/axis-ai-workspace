# OmniRoute Endpoint Mapping for AXIS

AXIS configures only an OmniRoute **base URL**, never a full endpoint. The active base must be public HTTPS in production. The owner-supplied public gateway is `https://context-gravel-childcare.ngrok-free.dev/v1`; its guarded, non-billing `GET /v1/models` check returned HTTP 200 on 20 August 2026. A local `https://localhost:20128/v1` base remains suitable only when AXIS runs on the same computer.

| Supplied route | AXIS status | Use in AXIS |
|---|---|---|
| `/v1/models` | Validation only | Confirms the configured public gateway and authorized token return a model list. It is not placed in `OMNIROUTE_BASE_URL`. |
| `/v1/chat/completions` | Active | The current streaming adapter appends this route automatically to the configured base URL. |
| `/v1/responses` | Inactive | Potential future OpenAI Responses-compatible adapter. AXIS will not send private chat data to it until request/stream semantics and a no-billing model route are validated. |
| `/v1/messages` | Inactive | Potential vendor-compatible messages adapter. It is not used by the current OpenAI-compatible AXIS streaming route. |
| `/v1/images/generations` | Inactive | Potential per-user image-creation feature. It requires a dedicated private gallery, storage metadata, a verified zero-billing model, and owner approval before AXIS sends prompts. |
| `/v1/images/edits` | Inactive | Potential private image-edit feature. It requires file-type limits, user-scoped object references, and the same cost/model approval as image generation. |
| `/v1/videos/generations` | Inactive | Potential asynchronous media job. It is not enabled because video generation may be slow or billable and needs private job tracking and storage controls. |
| `/v1/files` | Inactive | AXIS continues to use its managed user-scoped object storage as the source of truth; no provider file upload is required for the current workspace. |
| `/v1/search` | Inactive | AXIS’s current private web-research route remains separate. Any future gateway search integration must keep queries user-scoped and show sources clearly. |

## Required production configuration

```text
OMNIROUTE_BASE_URL=https://context-gravel-childcare.ngrok-free.dev/v1
OMNIROUTE_API_KEY=active_gateway_token
OMNIROUTE_MODEL=agy/gemini-3.6-flash-high
```

The gateway must accept `Authorization: Bearer` requests for both `/v1/models` and `/v1/chat/completions`. AXIS deliberately runs the non-billing models readiness check before persisting a new user turn, preventing a failed or accidental provider request while the public tunnel is unavailable.

> AXIS remains free-first and private-by-default. Listing an available gateway route does not enable it in the product or authorize a potentially billable media request. Each inactive route needs explicit owner approval, a validated zero-billing model, and user-scoped persistence before implementation.
