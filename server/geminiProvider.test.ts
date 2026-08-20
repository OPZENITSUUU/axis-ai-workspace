import { describe, expect, it } from "vitest";
import { getGeminiConfiguration, PERSONAL_ASSISTANT_INSTRUCTION } from "./geminiProvider";

describe("Gemini provider configuration", () => {
  it("refuses to run when the server-only API key is absent", () => {
    expect(() => getGeminiConfiguration({})).toThrow("GOOGLE_GEMINI_API_KEY");
  });

  it("reads the key and model from server environment variables", () => {
    expect(
      getGeminiConfiguration({
        GOOGLE_GEMINI_API_KEY: "server-only-test-key",
        GEMINI_MODEL: "gemini-test-model",
      }),
    ).toEqual({
      apiKey: "server-only-test-key",
      model: "gemini-test-model",
    });
  });

  it("preserves the user’s language in the assistant instruction", () => {
    expect(PERSONAL_ASSISTANT_INSTRUCTION).toContain("reply naturally in that same language");
    expect(PERSONAL_ASSISTANT_INSTRUCTION).toContain("Hinglish");
  });
});
