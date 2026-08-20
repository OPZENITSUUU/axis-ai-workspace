import type { ChatTurn } from "./geminiProvider";

type OmniRouteStreamPayload = {
  choices?: Array<{
    delta?: { content?: string | Array<{ text?: string }> };
  }>;
  error?: { message?: string } | string;
};

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getOmniRouteConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = env.OMNIROUTE_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.OMNIROUTE_API_KEY?.trim();
  if (!baseUrl) {
    throw new Error("OmniRoute is not configured. Add OMNIROUTE_BASE_URL as a server-only project secret.");
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("OMNIROUTE_BASE_URL must start with http:// or https://.");
  }
  const endpoint = new URL(baseUrl);
  if (env.NODE_ENV === "production" && (endpoint.protocol !== "https:" || isLoopbackHost(endpoint.hostname))) {
    throw new Error("Production AXIS requires a public HTTPS OmniRoute /v1 gateway URL; localhost and 127.0.0.1 are local-development only.");
  }
  if (!apiKey) {
    throw new Error("OmniRoute is not configured. Add OMNIROUTE_API_KEY as a server-only project secret.");
  }
  if (endpoint.pathname.replace(/\/+$/, "") !== "/v1") {
    throw new Error("OMNIROUTE_BASE_URL must end with the OpenAI-compatible /v1 path and must not include a model name or endpoint suffix.");
  }
  return {
    baseUrl,
    apiKey,
    model: env.OMNIROUTE_MODEL?.trim() || "auto/fast",
  };
}

function getSafeGatewayError(status: number, detail: string) {
  const normalized = detail.toLowerCase();
  if (normalized.includes("err_ngrok") || (normalized.includes("endpoint") && normalized.includes("offline"))) {
    return "The OmniRoute tunnel is offline. Ask the workspace owner to restart the tunnel and keep the public /v1 URL active.";
  }
  if (status === 401 || status === 403) {
    return "The OmniRoute gateway rejected its server-side credential. Ask the workspace owner to update the gateway key.";
  }
  if (status === 404) {
    return "The OmniRoute chat route was not found. Ask the workspace owner to confirm that the public base URL ends exactly with /v1.";
  }
  if (status === 408 || status === 429 || status >= 500) {
    return "The OmniRoute gateway is temporarily unavailable. Please try again after the owner confirms the tunnel and provider are healthy.";
  }
  return "The OmniRoute gateway could not complete this response. Please try again after the workspace owner checks the gateway.";
}

type OmniRouteReadiness = { ready: true } | { ready: false; message: string };

let readinessCache: { checkedAt: number; value: OmniRouteReadiness } | null = null;
const READINESS_CACHE_MS = 15_000;

export function resetOmniRouteReadinessCacheForTests() {
  readinessCache = null;
}

export async function getOmniRouteReadiness(): Promise<OmniRouteReadiness> {
  const now = Date.now();
  if (readinessCache && now - readinessCache.checkedAt < READINESS_CACHE_MS) return readinessCache.value;

  let configuration: ReturnType<typeof getOmniRouteConfiguration>;
  try {
    configuration = getOmniRouteConfiguration();
  } catch {
    return { ready: false, message: "The approved OmniRoute gateway is not configured. Ask the workspace owner to review the server settings." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  let value: OmniRouteReadiness;
  try {
    const response = await fetch(`${configuration.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${configuration.apiKey}` },
      signal: controller.signal,
    });
    if (response.ok) {
      value = { ready: true };
    } else {
      const detail = await response.text().catch(() => response.statusText);
      value = { ready: false, message: getSafeGatewayError(response.status, detail) };
    }
  } catch {
    value = { ready: false, message: "The OmniRoute tunnel is unreachable. Ask the workspace owner to restart the public tunnel and confirm the /v1 URL." };
  } finally {
    clearTimeout(timer);
  }
  readinessCache = { checkedAt: now, value };
  return value;
}

function toOpenAIContent(turn: ChatTurn) {
  const parts = turn.parts.map(part => {
    if ("text" in part) return { type: "text", text: part.text };
    if (part.inlineData.mimeType.startsWith("image/")) {
      return {
        type: "image_url",
        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
      };
    }
    return {
      type: "text",
      text: "[A non-image binary attachment was provided. This experimental route may not support it directly; use the Gemini fallback for guaranteed PDF handling.]",
    };
  });
  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

function readDelta(payload: OmniRouteStreamPayload) {
  const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
  if (error) throw new Error(error);
  const content = payload.choices?.[0]?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part.text ?? "").join("");
  return "";
}

export async function* streamOmniRouteResponse(
  contents: ChatTurn[],
  signal?: AbortSignal,
  modelOverride?: string | null,
): AsyncGenerator<string> {
  const configuration = getOmniRouteConfiguration();
  const { baseUrl, apiKey, model: configuredModel } = configuration;
  const model = modelOverride?.trim() || configuredModel;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are a personal AI assistant. Reply in the same language and style as the user's latest message. Support English, Hindi, and Hinglish. Be direct, honest, and useful. Do not invent facts or sources. Use Markdown when helpful.",
          },
          ...contents.map(turn => ({
            role: turn.role === "model" ? "assistant" : "user",
            content: toOpenAIContent(turn),
          })),
        ],
      }),
    });
  } catch {
    throw new Error("The OmniRoute tunnel is unreachable. Ask the workspace owner to restart the public tunnel and confirm the /v1 URL.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(getSafeGatewayError(response.status, detail));
  }
  if (!response.body) throw new Error("OmniRoute returned an empty streaming response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = rawEvent
          .split("\n")
          .filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trim())
          .join("\n");
        if (data && data !== "[DONE]") {
          const delta = readDelta(JSON.parse(data) as OmniRouteStreamPayload);
          if (delta) yield delta;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
