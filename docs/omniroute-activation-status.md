# AXIS OmniRoute activation status

## Active server configuration

AXIS is configured with the owner-supplied public OpenAI-compatible base URL:

```text
https://context-gravel-childcare.ngrok-free.dev/v1
```

The endpoint is stored only as the server-side `OMNIROUTE_BASE_URL` setting. AXIS appends `/models` only for its guarded authorization check and `/chat/completions` for normal streaming chat requests.

## Validation result

The explicit server-only credential probe completed successfully against `GET /v1/models`. This confirms that the public HTTPS tunnel is reachable and the configured Bearer credential is accepted by the gateway. The AXIS development server was restarted after configuration, and the application type-check plus full regression suite passed with 34 active tests and one intentionally skipped external probe.

> The readiness probe is non-billing: it does not send chat content or invoke a completion. AXIS has verified models authorization only; chat remains disabled in the activation checklist until the completion path returns a response successfully.

## Chat-path probe result

With explicit owner approval for one minimal request, AXIS sent a non-streaming `POST /v1/chat/completions` validation using `auto/fast`, a single short prompt, and a 30-second response limit. The public tunnel returned no response bytes before the limit elapsed. This is distinct from the successful `/v1/models` authorization: the gateway accepts the credential but the routed completion path still needs gateway-side diagnosis. No second completion probe was sent.

## Operational notes

The ngrok public URL must remain online and continue forwarding to the intended OmniRoute instance. If the tunnel changes or is restarted with a different address, replace the server-side `OMNIROUTE_BASE_URL` and rerun the guarded models check before relying on chat. Keep the gateway key server-only; never add it to browser code, the Expo bundle, source archives, or GitHub.

## Timeout diagnosis and owner checks

The authenticated models catalog is available through the active tunnel and advertises the dynamic `auto/*` families, including `auto/fast`, `auto/best-fast`, and `auto/best-free`. OmniRoute documents `auto/*` as a live-scored routing family, while its timeout issue notes that candidate probing and fallback can take 30–60 seconds before an upstream provider responds.[1] [2] The 30-second no-byte timeout is therefore consistent with a slow, unavailable, quota-exhausted, or unconfigured upstream route; it is not evidence that the AXIS credential or `/v1/models` endpoint is invalid.

The owner should inspect the OmniRoute dashboard and tunnel without sending another billable request:

1. Open the gateway request logs for the timed-out `POST /v1/chat/completions` and identify the selected provider, model, connection, and any upstream error or retry state.
2. In the Providers/Connections dashboard, confirm at least one chat-capable provider is active, authenticated, healthy, and within its quota. A successful `/v1/models` result can list route candidates even when their upstream connection later stalls.
3. Confirm the ngrok tunnel still forwards the long-lived completion response to the intended local OmniRoute process and inspect its local server logs for the same request timestamp.
4. After confirming a free/no-billing route, choose an explicit advertised free or fast model in the OmniRoute dashboard instead of relying on the broad `auto/fast` strategy, then authorize one new minimal AXIS probe against that specific model.

## Explicit Gemini route validation

The owner supplied `agy/gemini-3.6-flash-high`, which is present in the authorized gateway model catalog. AXIS now stores this identifier server-side as `OMNIROUTE_MODEL` and was restarted after the change. One owner-approved streaming `POST /v1/chat/completions` probe against that exact model returned HTTP `200`, `text/event-stream`, a normal assistant role chunk, the expected `AXIS explicit model check passed.` content chunk, a `stop` finish reason, and `[DONE]`.

This resolves the prior broad `auto/fast` timeout at the gateway level. The active public tunnel, Bearer credential, explicit Gemini routing, and streaming OpenAI-compatible response path are now verified. The remaining user-session validation is the existing private AXIS browser chat flow, which must be exercised with a signed-in account rather than by exposing any server credential.

## Latest public endpoint recheck

After the same `https://context-gravel-childcare.ngrok-free.dev/v1` URL was supplied again on 2026-08-20, AXIS ran its guarded non-billing `/v1/models` authorization probe. The endpoint produced no bytes within the 10-second bounded limit. This confirms the public tunnel was still not reachable from AXIS at the time of this check, so it is not eligible for live chat activation. No completion request was made.

## References

[1]: https://github.com/diegosouzapw/OmniRoute
[2]: https://github.com/diegosouzapw/OmniRoute/issues/9717
