import { afterEach, describe, expect, it, vi } from "vitest";
import { getEligibleProviders, getFallbackOrder, getProviderId, paidProvidersEnabled } from "./modelProvider";
import { getOmniRouteConfiguration, getOmniRouteReadiness, resetOmniRouteReadinessCacheForTests, streamOmniRouteResponse } from "./omniRouteProvider";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  resetOmniRouteReadinessCacheForTests();
});

describe("OmniRoute provider configuration", () => {
  it("requires a server-only base URL and token", () => {
    expect(() => getOmniRouteConfiguration({})).toThrow("OMNIROUTE_BASE_URL");
    expect(() => getOmniRouteConfiguration({ OMNIROUTE_BASE_URL: "https://gateway.example" })).toThrow("OMNIROUTE_API_KEY");
  });

  it("rejects a malformed upstream endpoint", () => {
    expect(() => getOmniRouteConfiguration({ OMNIROUTE_BASE_URL: "gateway.example", OMNIROUTE_API_KEY: "token" })).toThrow("must start with");
    expect(() => getOmniRouteConfiguration({ OMNIROUTE_BASE_URL: "https://gateway.example/v1agy/gemini", OMNIROUTE_API_KEY: "token" })).toThrow("must end with");
  });

  it("allows loopback only for same-machine development and rejects it from production AXIS", () => {
    expect(getOmniRouteConfiguration({
      NODE_ENV: "development",
      OMNIROUTE_BASE_URL: "http://127.0.0.1:20128/v1",
      OMNIROUTE_API_KEY: "local-token",
    })).toMatchObject({ baseUrl: "http://127.0.0.1:20128/v1" });

    expect(() => getOmniRouteConfiguration({
      NODE_ENV: "production",
      OMNIROUTE_BASE_URL: "http://127.0.0.1:20128/v1",
      OMNIROUTE_API_KEY: "local-token",
    })).toThrow("public HTTPS");
  });

  it("uses a server-only OpenAI-compatible gateway configuration", () => {
    expect(getOmniRouteConfiguration({
      OMNIROUTE_BASE_URL: "https://gateway.example/v1/",
      OMNIROUTE_API_KEY: "server-token",
      OMNIROUTE_MODEL: "auto/fast",
    })).toEqual({
      baseUrl: "https://gateway.example/v1",
      apiKey: "server-token",
      model: "auto/fast",
    });
  });

  it("selects OmniRoute only in no-billing safe mode", () => {
    expect(getProviderId({})).toBe("omniroute");
    expect(() => getProviderId({ AI_PROVIDER: "gemini" })).toThrow("no-billing mode");
    expect(() => getProviderId({ AI_PROVIDER: "openai" })).toThrow("no-billing mode");
    expect(paidProvidersEnabled({})).toBe(false);
    expect(paidProvidersEnabled({ ALLOW_PAID_PROVIDERS: "true" })).toBe(true);
    expect(getProviderId({ AI_PROVIDER: "gemini", ALLOW_PAID_PROVIDERS: "true" })).toBe("gemini");
  });

  it("exposes only configured and owner-approved providers in fallback order", () => {
    expect(getEligibleProviders({
      OMNIROUTE_BASE_URL: "https://gateway.example/v1",
      OMNIROUTE_API_KEY: "gateway-token",
    }).map(provider => provider.id)).toEqual(["omniroute"]);

    expect(getFallbackOrder({
      OMNIROUTE_BASE_URL: "https://gateway.example/v1",
      OMNIROUTE_API_KEY: "gateway-token",
      GOOGLE_GEMINI_API_KEY: "gemini-token",
      ALLOW_PAID_PROVIDERS: "true",
    })).toEqual(["omniroute", "gemini"]);
  });

  it("streams OpenAI-compatible chunks with a server-only gateway token", async () => {
    process.env.OMNIROUTE_BASE_URL = "https://gateway.example/v1";
    process.env.OMNIROUTE_API_KEY = "server-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    for await (const chunk of streamOmniRouteResponse([{ role: "user", parts: [{ text: "Hi" }] }])) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Hello world");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.example/v1/chat/completions",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer server-token" }) }),
    );
  });

  it("replaces an offline ngrok HTML response with tunnel recovery guidance", async () => {
    process.env.OMNIROUTE_BASE_URL = "https://gateway.example/v1";
    process.env.OMNIROUTE_API_KEY = "server-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ERR_NGROK_3200 endpoint is offline", { status: 404 })));

    await expect(async () => {
      for await (const _chunk of streamOmniRouteResponse([{ role: "user", parts: [{ text: "Hi" }] }])) {
        // The response is expected to fail before it emits a chunk.
      }
    }).rejects.toThrow("tunnel is offline");
  });

  it("replaces unknown route and network failures with safe owner guidance", async () => {
    process.env.OMNIROUTE_BASE_URL = "https://gateway.example/v1";
    process.env.OMNIROUTE_API_KEY = "server-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not found", { status: 404 })).mockRejectedValueOnce(new Error("network")));

    await expect(async () => {
      for await (const _chunk of streamOmniRouteResponse([{ role: "user", parts: [{ text: "Hi" }] }])) {
        // The response is expected to fail before it emits a chunk.
      }
    }).rejects.toThrow("chat route was not found");
    await expect(async () => {
      for await (const _chunk of streamOmniRouteResponse([{ role: "user", parts: [{ text: "Hi" }] }])) {
        // The response is expected to fail before it emits a chunk.
      }
    }).rejects.toThrow("tunnel is unreachable");
  });

  it("uses a bounded non-billing models preflight and caches an offline result briefly", async () => {
    process.env.OMNIROUTE_BASE_URL = "https://gateway.example/v1";
    process.env.OMNIROUTE_API_KEY = "server-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response("ERR_NGROK_3200 endpoint is offline", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOmniRouteReadiness()).resolves.toMatchObject({ ready: false, message: expect.stringContaining("tunnel is offline") });
    await expect(getOmniRouteReadiness()).resolves.toMatchObject({ ready: false });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("https://gateway.example/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer server-token" } }));
  });
});
