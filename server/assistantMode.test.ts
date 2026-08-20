import { describe, expect, it } from "vitest";
import { getAssistantModeInstruction } from "./assistantMode";

describe("AXIS account-synced assistant modes", () => {
  it("uses a safe balanced fallback for unknown or missing preferences", () => {
    expect(getAssistantModeInstruction(undefined)).toContain("balanced mode");
    expect(getAssistantModeInstruction("untrusted" as never)).toContain("balanced mode");
  });

  it("uses server-controlled style instructions without credentials", () => {
    const instruction = getAssistantModeInstruction("developer");
    expect(instruction).toContain("developer mode");
    expect(instruction).toContain("Never request, expose, or invent provider credentials");
    expect(instruction).not.toContain("GEMINI_KEY");
  });
});
