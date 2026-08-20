# Resolving OmniRoute HTTP 401 in AXIS

AXIS reached the public OmniRoute gateway successfully, but its lightweight `GET /v1/models` validation returned HTTP 401. This indicates an authorization failure at the gateway rather than a network, URL-format, or whitespace problem.

## Owner checklist

1. Open the OmniRoute Dashboard and go to **API Manager**. Confirm the gateway key is still present and marked **Active**. If it was rotated, deleted, or created in another OmniRoute installation, create a replacement key.
2. Check whether **Require API Key** is enabled. When it is enabled, the same active key must be recognized by the OmniRoute instance serving the public hostname.
3. Use the OpenAI-compatible base path exactly as `https://cloud.omniroute.online/v1`. AXIS appends `/models` and `/chat/completions` itself; do not configure `/v1/models`, `/v1/completions`, or `/api/v1` as the AXIS base URL.
4. Test the public gateway from a different network with the new token, using the same Bearer scheme as AXIS:

   ```bash
   curl -i https://cloud.omniroute.online/v1/models \
     -H "Authorization: Bearer YOUR_NEW_GATEWAY_TOKEN"
   ```

   A `200` response with a JSON `data` model list confirms the token and public gateway are ready. A `401` means the key is still not authorized by the gateway.
5. Check Dashboard **Logs** for the rejected request and verify that the public tunnel/proxy routes to the intended OmniRoute instance. An Electron, npm, or Docker instance on the same machine may use a different local key database.
6. If needed, rotate the key, update it only in AXIS’s server-side `OMNIROUTE_API_KEY` secret field, and re-run the public `/v1/models` check. Never paste the new key in chat or client-side code.

## Confirmed recording diagnosis — 2026-08-19

The 2026-08-19 AXIS recording confirms that the user message is persisted, the streaming state starts, and the public OmniRoute gateway is reached. The assistant then receives this gateway response:

```text
OmniRoute request failed (401): Invalid API key format
```

Production logs contain the same stream error. The public base URL is therefore reachable and the AXIS chat route is working; the gateway is rejecting the current Bearer credential before model processing. This is not a `localhost` problem, an AXIS UI problem, or an unsupported endpoint-path problem.

Create a fresh **active gateway API key in the OmniRoute instance behind `cloud.omniroute.online`**, verify it returns `200` and a JSON model list with the command in step 4, then update only the secure `OMNIROUTE_API_KEY` project setting. AXIS will use the same validated key automatically for `/v1/chat/completions`.

## Latest guarded readiness probe

The AXIS credential test was re-run with its explicit live-check flag. The normal suite still correctly skips external authorization, while the intentional live `/v1/models` probe now reports only the actual gateway outcome: HTTP `401`. The public hostname remains reachable, but the currently stored server-only credential is still not accepted. No chat-completions request or paid-provider call was made during this check.

## References

- [OmniRoute 401 issue discussion and API Manager guidance](https://github.com/diegosouzapw/OmniRoute/issues/2257)
- [OmniRoute repository and OpenAI-compatible `/v1` quick start](https://github.com/diegosouzapw/OmniRoute)
