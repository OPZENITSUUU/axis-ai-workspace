# OmniRoute Endpoint Mapping for AXIS

AXIS configures only an OmniRoute **base URL**, never a full endpoint. The active base must be public HTTPS in production, for example `https://cloud.omniroute.online/v1`. A local `http://localhost:20128/v1` base is suitable only when AXIS runs on the same computer.

| Supplied route | AXIS status | Use in AXIS |
|---|---|---|
| `/v1/models` | Validation only | Confirms the configured public gateway and authorized token return a model list. It is not placed in `OMNIROUTE_BASE_URL`. |
| `/v1/chat/completions` | Active | The current streaming adapter appends this route automatically to the configured base URL. |
| `/v1/messages` | Inactive | Not used by the current OpenAI-compatible AXIS adapter. |
| `/v1/images/edits` | Inactive | Potential future media adapter; AXIS currently does not call it. |
| `/v1/search` | Inactive | AXIS’s current web research route is separate from OmniRoute. |
| `/v1/videos/generations` | Inactive | Potential future media feature; AXIS currently does not call it. |

## Required production configuration

```text
OMNIROUTE_BASE_URL=https://cloud.omniroute.online/v1
OMNIROUTE_API_KEY=active_gateway_token
OMNIROUTE_MODEL=auto
```

The gateway must accept `Authorization: Bearer` requests for both `/v1/models` and `/v1/chat/completions`. AXIS deliberately remains paused until the token succeeds on `/v1/models`, preventing a failed or accidental provider request.
