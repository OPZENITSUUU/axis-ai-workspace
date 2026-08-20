import { describe, expect, it } from "vitest";

const baseUrl = process.env.OMNIROUTE_BASE_URL?.trim().replace(/\/+$/, "");
const apiKey = process.env.OMNIROUTE_API_KEY?.trim();

function isCloudReachableGatewayUrl(value: string | undefined) {
  return Boolean(value && !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/i.test(value));
}

const isCloudReachableBaseUrl = isCloudReachableGatewayUrl(baseUrl);
const runLiveCredentialCheck = process.env.RUN_OMNIROUTE_CREDENTIAL_CHECK === "true";
const liveCredentialTimeoutMs = 10_000;

describe("OmniRoute gateway credential", () => {
  it.runIf(Boolean(runLiveCredentialCheck && isCloudReachableBaseUrl && apiKey))("lists gateway models with the server-only bearer token", async () => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(liveCredentialTimeoutMs),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`OmniRoute /models did not respond within ${liveCredentialTimeoutMs}ms: ${detail}`);
    }

    expect(response.ok, `OmniRoute /models returned ${response.status}`).toBe(true);
    const body = await response.json() as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  }, liveCredentialTimeoutMs + 2_000);

  it("distinguishes loopback development endpoints from public gateway addresses", () => {
    expect(isCloudReachableGatewayUrl("http://127.0.0.1:20128/v1")).toBe(false);
    expect(isCloudReachableGatewayUrl("http://localhost:20128/v1")).toBe(false);
    expect(isCloudReachableGatewayUrl("https://cloud.omniroute.online/v1")).toBe(true);
  });

  it.skipIf(runLiveCredentialCheck)("requires an explicit flag before running a real credential check during the normal regression suite", () => {
    expect(runLiveCredentialCheck).toBe(false);
  });
});
