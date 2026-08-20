export const gatewayUnavailableGuidance = {
  eyebrow: "Live chat paused",
  title: "AXIS needs an approved AI gateway before it can send a message.",
  body: "No message has been sent and no fallback provider will be used. Add a cloud-reachable OmniRoute HTTPS /v1 address and gateway token in server settings; localhost works only for same-computer development.",
  action: "Open provider settings",
} as const;
