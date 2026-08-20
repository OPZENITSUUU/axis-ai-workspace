# AXIS OmniRoute ngrok outage recovery

## Confirmed state

On 2026-08-20, the configured AXIS gateway URL returned HTTP `404` with an ngrok HTML document on `GET /v1/models`. The mobile browser showed the same `ERR_NGROK_3200` message: the named public endpoint is offline. The AXIS server credential and explicit Gemini model were previously validated when the tunnel was available; this failure is a tunnel availability issue, not a user workspace or duplicate-message issue.

## Owner recovery steps

1. On the machine that runs OmniRoute, confirm the local service responds at `http://localhost:20128/v1/models`.
2. Start or restart the named ngrok tunnel that forwards the public HTTPS hostname to the local OmniRoute service.
3. Verify the public route before returning to AXIS:

   ```bash
   curl -H "Authorization: Bearer YOUR_GATEWAY_KEY" \
     https://YOUR_PUBLIC_NGROK_HOST/v1/models
   ```

   The response must be JSON with HTTP `200`, not ngrok HTML.
4. If ngrok supplies a new public hostname, update the server-only `OMNIROUTE_BASE_URL` to that hostname plus exactly `/v1`. Do not append the model name, `/chat/completions`, or any other route segment.
5. Run the guarded AXIS models check again. Only after it succeeds should a chat message be attempted.

## AXIS behavior while offline

AXIS now rejects malformed base URLs that do not end exactly in `/v1`. It also converts offline ngrok HTML, network failures, authorization failures, and unknown chat-route errors into concise recovery guidance instead of exposing raw provider HTML or an opaque `OmniRoute request failed (404)` message. Provider credentials remain server-only throughout this recovery flow.

Before AXIS creates a new conversation or persists a user message, it runs a short-lived, server-side `GET /v1/models` readiness preflight. The result is cached for 15 seconds and does not invoke a model completion. When the tunnel is offline, AXIS returns a `503` recovery response and leaves the conversation and message store unchanged; it does not create a failed user turn that could later look like a duplicate. Regression coverage verifies both the cached preflight behavior and the authenticated route’s no-persistence result.
