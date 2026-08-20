import { describe, expect, it } from "vitest";
import { getDirectProviderConfiguration, isDirectProviderId } from "./directProviderContracts";

describe("inactive direct-provider contracts", () => {
  it("requires a named server-only key before a future adapter can be configured", () => {
    expect(() => getDirectProviderConfiguration("groq", {})).toThrow("GROQ_API_KEY");
    expect(isDirectProviderId("mistral")).toBe(true);
    expect(isDirectProviderId("unknown")).toBe(false);
  });

  it("uses a model override only after the corresponding server secret exists", () => {
    expect(getDirectProviderConfiguration("mistral", {
      MISTRAL_API_KEY: "server-only-token",
      MISTRAL_MODEL: "mistral-large-latest",
    })).toMatchObject({
      id: "mistral",
      apiKey: "server-only-token",
      model: "mistral-large-latest",
      baseUrl: "https://api.mistral.ai/v1",
    });
  });
});
