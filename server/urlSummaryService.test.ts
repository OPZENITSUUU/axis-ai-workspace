import { describe, expect, it } from "vitest";
import { normalizeExternalUrl, parseUrlSummaryCommand } from "./urlSummaryService";

describe("AXIS URL summary command safety", () => {
  it("parses a URL command and preserves an optional question", () => {
    expect(parseUrlSummaryCommand("/url https://example.com explain the thesis")).toEqual({
      url: "https://example.com",
      question: "explain the thesis",
    });
  });

  it("allows only standard public HTTP(S) URL shapes before DNS validation", () => {
    expect(normalizeExternalUrl("https://example.com/article").hostname).toBe("example.com");
    expect(() => normalizeExternalUrl("file:///etc/passwd")).toThrow(/http and https/i);
    expect(() => normalizeExternalUrl("https://user:pass@example.com")).toThrow(/embedded credentials/i);
    expect(() => normalizeExternalUrl("https://example.com:8080")).toThrow(/standard public web ports/i);
  });
});
