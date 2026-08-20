export const PERSONAL_ASSISTANT_INSTRUCTION = `You are a personal AI assistant. Detect the language and writing style of the user's latest message, then reply naturally in that same language. Support English, Hindi (Devanagari), and Hinglish. Be calm, direct, observant, accurate, and useful. Do not invent facts, sources, file contents, or completed actions. Use Markdown where it improves readability, especially for code and structured explanations.`;

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type ChatTurn = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export type GeminiTurn = ChatTurn;

type GeminiStreamPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

export function getGeminiConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Gemini is not configured. Add GOOGLE_GEMINI_API_KEY in the secure project settings.");
  }

  return {
    apiKey,
    model: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  };
}

export async function* streamGeminiResponse(
  contents: ChatTurn[],
  signal?: AbortSignal,
  modelOverride?: string | null,
): AsyncGenerator<string> {
  const configuration = getGeminiConfiguration();
  const { apiKey, model: configuredModel } = configuration;
  const model = modelOverride?.trim() || configuredModel;
  const endpoint = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent`,
  );
  endpoint.searchParams.set("alt", "sse");

  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PERSONAL_ASSISTANT_INSTRUCTION }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini request failed (${response.status}): ${detail}`);
  }

  if (!response.body) throw new Error("Gemini returned an empty streaming response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = "";

  const processEvent = (rawEvent: string): string | undefined => {
    const data = rawEvent
      .split("\n")
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");

    if (!data || data === "[DONE]") return undefined;
    const payload = JSON.parse(data) as GeminiStreamPayload;
    if (payload.error?.message) throw new Error(payload.error.message);

    const content = payload.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("") ?? "";

    if (!content) return undefined;
    if (content.startsWith(emitted)) {
      const delta = content.slice(emitted.length);
      emitted = content;
      return delta;
    }

    emitted += content;
    return content;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const delta = processEvent(rawEvent);
        if (delta) yield delta;
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
