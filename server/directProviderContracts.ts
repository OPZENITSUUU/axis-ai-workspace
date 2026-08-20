/**
 * Server-only contracts for adapters that may be implemented later.
 * Defining one does not expose a secret, activate an adapter, or permit paid traffic.
 */
export const DIRECT_PROVIDER_CONTRACTS = [
  { id: "groq", label: "Groq", apiKeyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "deepseek", label: "DeepSeek", apiKeyEnv: "DEEPSEEK_API_KEY", modelEnv: "DEEPSEEK_MODEL", defaultModel: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
  { id: "mistral", label: "Mistral", apiKeyEnv: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL", defaultModel: "mistral-small-latest", baseUrl: "https://api.mistral.ai/v1" },
  { id: "anthropic", label: "Anthropic", apiKeyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-3-5-haiku-latest", baseUrl: "https://api.anthropic.com/v1" },
  { id: "openai", label: "OpenAI", apiKeyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" },
] as const;

export type DirectProviderId = (typeof DIRECT_PROVIDER_CONTRACTS)[number]["id"];
export type DirectProviderContract = (typeof DIRECT_PROVIDER_CONTRACTS)[number];
export type DirectProviderConfiguration = DirectProviderContract & { apiKey: string; model: string };

export function isDirectProviderId(value: string): value is DirectProviderId {
  return DIRECT_PROVIDER_CONTRACTS.some(contract => contract.id === value);
}

export function getDirectProviderConfiguration(id: DirectProviderId, env: NodeJS.ProcessEnv = process.env): DirectProviderConfiguration {
  const contract = DIRECT_PROVIDER_CONTRACTS.find(candidate => candidate.id === id);
  if (!contract) throw new Error(`Unsupported AXIS direct provider: ${id}`);
  const apiKey = env[contract.apiKeyEnv]?.trim();
  if (!apiKey) throw new Error(`${contract.apiKeyEnv} must be configured server-side before enabling ${contract.label}.`);
  return { ...contract, apiKey, model: env[contract.modelEnv]?.trim() || contract.defaultModel };
}
