import { describe, expect, it } from "vitest";
import { gatewayUnavailableGuidance } from "./providerGuidance";

describe("gateway unavailable guidance", () => {
  it("explains that no prompt was sent and directs the owner to a reachable server-only gateway setup", () => {
    expect(gatewayUnavailableGuidance.body).toContain("No message has been sent");
    expect(gatewayUnavailableGuidance.body).toContain("cloud-reachable OmniRoute HTTPS /v1");
    expect(gatewayUnavailableGuidance.body).toContain("localhost works only for same-computer development");
  });
});
