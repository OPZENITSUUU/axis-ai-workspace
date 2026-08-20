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
  return {
    baseUrl,
    apiKey,
    model: env.OMNIROUTE_MODEL?.trim() || "auto/fast",
  };
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
  const response = await fetch(`${baseUrl}/chat/completions`, {
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

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`OmniRoute request failed (${response.status}): ${detail}`);
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
