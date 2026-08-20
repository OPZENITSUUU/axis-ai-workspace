# AXIS chat duplicate-prevention validation

## Scope

AXIS uses a single client-side chat submission lifecycle for temporary user/assistant previews and the active-stream lock. This closes the two duplicate paths found in the workspace UI: a rapid second submission before React disables the composer, and stale temporary previews remaining visible after the persisted conversation refreshes.

| Lifecycle stage | Safeguard | Verified result |
|---|---|---|
| Prompt submission | `tryStart()` acquires one in-memory stream lock | A second rapid start returns `null` and cannot begin another request. |
| Streaming | `append()` owns the temporary assistant preview | Token text is associated with the single active lifecycle. |
| Persisted refresh | `finishAfterPersistedRefresh()` clears both preview fields and releases the lock | Persisted user and assistant messages replace the temporary pair without a second visual copy. |
| Failed request | `release()` runs in the `finally` block | A later deliberate retry remains possible without retaining the duplicate lock. |
| Data recovery | `chatDataReloadActions` owns both recovery callbacks | Conversation and list retries invoke their corresponding query reload only; neither receives or calls a chat submission function. |

## Retry and refetch boundary

The workspace has no resend control that calls `submitPrompt`. Conversation recovery and conversations-list recovery both use the explicit `chatDataReloadActions` helper, whose only dependencies are the two query-reload callbacks. These data reloads do not create messages or invoke the chat streaming endpoint.

## Automated evidence

`server/chatDuplicate.test.ts` directly verifies the stream guard, the lifecycle’s rapid double-start rejection, streamed-preview accumulation, persisted-refresh cleanup, and retry/refetch data-reload actions. `server/chatRoutePersistence.test.ts` invokes the authenticated server streaming route with a mocked private user and verifies that one request persists exactly one user message and one assistant message while emitting the expected stream completion. The full project validation command is:

```bash
pnpm check && pnpm test
```

The latest validation passed with 15 test files, 40 active tests, and one intentionally skipped external credential probe.

## Remaining manual check

One signed-in browser check remains: send a normal AXIS message, wait for the persisted response, refresh the page, and confirm that exactly one user bubble and one assistant bubble remain. This check verifies the private authenticated browser session rather than the server-only provider credentials.

## Current browser-session readiness

On 2026-08-20, the published AXIS workspace was confirmed to have a retained signed-in owner session with an existing private conversation visible. The send-and-refresh portion was intentionally not run because the immediately preceding bounded, non-billing OmniRoute `/v1/models` probe timed out without response bytes. AXIS therefore remains in its no-persistence recovery state; sending a test prompt would not produce a valid assistant response and would not constitute duplicate-lifecycle evidence. Once the provider readiness probe returns successfully, this existing signed-in session can complete the manual check without another login step.
