import { describe, expect, it } from "vitest";

const expoToken = process.env.EXPO_TOKEN?.trim();
const validationTimeoutMs = 10_000;

describe("Expo build credential", () => {
  it.runIf(Boolean(expoToken))("validates the server-only Expo token with the current-user endpoint", async () => {
    const response = await fetch("https://api.expo.dev/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${expoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "query CurrentUser { meActor { __typename id ... on UserActor { username } } }",
      }),
      signal: AbortSignal.timeout(validationTimeoutMs),
    });

    expect(response.ok, `Expo current-user endpoint returned ${response.status}`).toBe(true);
    const payload = await response.json() as { data?: { meActor?: { id?: string; username?: string } | null }; errors?: unknown[] };
    expect(payload.errors ?? []).toHaveLength(0);
    expect(payload.data?.meActor?.id).toBeTruthy();
  }, validationTimeoutMs + 2_000);

  it.skipIf(Boolean(expoToken))("does not run an external credential request unless EXPO_TOKEN is configured", () => {
    expect(expoToken).toBeUndefined();
  });
});
