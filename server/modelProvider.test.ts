import { afterEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  streamGeminiResponse: vi.fn(),
  getGeminiConfiguration: vi.fn(),
  streamOmniRouteResponse: vi.fn(),
  getOmniRouteConfiguration: vi.fn(),
}));

vi.mock("./geminiProvider", () => ({
  streamGeminiResponse: providers.streamGeminiResponse,
  getGeminiConfiguration: providers.getGeminiConfiguration,
}));

vi.mock("./omniRouteProvider", () => ({
  streamOmniRouteResponse: providers.streamOmniRouteResponse,
  getOmniRouteConfiguration: providers.getOmniRouteConfiguration,
}));

import { isProviderId, streamModelResponse } from "./modelProvider";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

describe("AXIS model fallback", () => {
  it("falls back before any output when the preferred eligible provider fails", async () => {
    process.env = {
      ...originalEnv,
      OMNIROUTE_BASE_URL: "https://gateway.example/v1",
      OMNIROUTE_API_KEY: "gateway-token",
      GOOGLE_GEMINI_API_KEY: "gemini-token",
      ALLOW_PAID_PROVIDERS: "true",
    };
    providers.getOmniRouteConfiguration.mockReturnValue({ model: "auto/fast" });
    providers.getGeminiConfiguration.mockReturnValue({ model: "gemini-test" });
    providers.streamOmniRouteResponse.mockImplementation(async function* () {
      throw new Error("gateway unavailable");
    });
    providers.streamGeminiResponse.mockImplementation(async function* () {
      yield "Fallback response";
    });

    const chunks: string[] = [];
    for await (const chunk of streamModelResponse([{ role: "user", parts: [{ text: "Hello" }] }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Fallback response"]);
    expect(providers.streamOmniRouteResponse).toHaveBeenCalledTimes(1);
    expect(providers.streamGeminiResponse).toHaveBeenCalledTimes(1);
  });

  it("accepts only persisted provider identifiers known to AXIS", () => {
    expect(isProviderId("omniroute")).toBe(true);
    expect(isProviderId("gemini")).toBe(true);
    expect(isProviderId("untrusted-provider")).toBe(false);
  });
});
