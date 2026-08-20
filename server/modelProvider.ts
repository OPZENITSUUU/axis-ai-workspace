import { getGeminiConfiguration, streamGeminiResponse, type ChatTurn } from "./geminiProvider";
import { getOmniRouteConfiguration, streamOmniRouteResponse } from "./omniRouteProvider";

export type ProviderId = "omniroute" | "gemini";

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  requiresOwnerApproval: boolean;
  description: string;
};

export type EligibleProvider = ProviderDefinition & { model: string };
export type ProviderFallbackNotice = { from: ProviderId; to: ProviderId; reason: string };

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = [
  {
    id: "omniroute",
    label: "OmniRoute",
    requiresOwnerApproval: false,
    description: "Owner-configured experimental gateway route",
  },
  {
    id: "gemini",
    label: "Gemini",
    requiresOwnerApproval: true,
    description: "Direct fallback available only after explicit server approval",
  },
] as const;

export function paidProvidersEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ALLOW_PAID_PROVIDERS?.trim().toLowerCase() === "true";
}

function getProviderConfiguration(id: ProviderId, env: NodeJS.ProcessEnv) {
  if (id === "gemini") return getGeminiConfiguration(env);
  return getOmniRouteConfiguration(env);
}

export function getEligibleProviders(env: NodeJS.ProcessEnv = process.env): EligibleProvider[] {
  return PROVIDER_REGISTRY.flatMap(provider => {
    if (provider.requiresOwnerApproval && !paidProvidersEnabled(env)) return [];
    try {
      return [{ ...provider, model: getProviderConfiguration(provider.id, env).model }];
    } catch {
      return [];
    }
  });
}

export function getFallbackOrder(env: NodeJS.ProcessEnv = process.env): ProviderId[] {
  return getEligibleProviders(env).map(provider => provider.id);
}

export function isProviderId(value: string | null | undefined): value is ProviderId {
  return value === "omniroute" || value === "gemini";
}

export function getProviderId(env: NodeJS.ProcessEnv = process.env): ProviderId {
  const configured = env.AI_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "omniroute") return "omniroute";
  if (configured === "gemini" && paidProvidersEnabled(env)) return "gemini";
  throw new Error("AXIS no-billing mode allows OmniRoute only. Enable ALLOW_PAID_PROVIDERS=true server-side before selecting a direct provider.");
}

export function getProviderStatus(env: NodeJS.ProcessEnv = process.env) {
  try {
    const id = getProviderId(env);
    const configuration = getProviderConfiguration(id, env);
    return {
      id,
      label: id === "gemini" ? "Gemini" : "OmniRoute",
      model: configuration.model,
      ready: true,
      billingMode: id === "gemini" ? "Owner-enabled direct provider" as const : "Owner-configured experimental route" as const,
      eligibleProviders: getEligibleProviders(env).map(provider => ({ id: provider.id, label: provider.label, model: provider.model })),
      fallbackOrder: getFallbackOrder(env),
    };
  } catch {
    return {
      id: "omniroute" as const,
      label: "OmniRoute",
      model: null,
      ready: false,
      billingMode: "No-billing safe mode" as const,
      eligibleProviders: getEligibleProviders(env).map(provider => ({ id: provider.id, label: provider.label, model: provider.model })),
      fallbackOrder: getFallbackOrder(env),
    };
  }
}

export async function* streamModelResponse(
  contents: ChatTurn[],
  signal?: AbortSignal,
  preferredProvider?: ProviderId,
  preferredModel?: string | null,
  onFallback?: (notice: ProviderFallbackNotice) => void | Promise<void>,
): AsyncGenerator<string> {
  const active = preferredProvider && getFallbackOrder().includes(preferredProvider)
    ? preferredProvider
    : getProviderId();
  const candidates = [active, ...getFallbackOrder().filter(provider => provider !== active)];
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const provider = candidates[index]!;
    let emitted = false;
    try {
      const model = provider === active ? preferredModel : getEligibleProviders().find(item => item.id === provider)?.model;
      const response = provider === "gemini"
        ? streamGeminiResponse(contents, signal, model)
        : streamOmniRouteResponse(contents, signal, model);
      for await (const chunk of response) {
        emitted = true;
        yield chunk;
      }
      return;
    } catch (error) {
      lastError = error;
      const nextProvider = candidates[index + 1];
      if (emitted || !nextProvider) throw error;
      await onFallback?.({
        from: provider,
        to: nextProvider,
        reason: error instanceof Error ? error.message : "Provider unavailable",
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No eligible AXIS provider could complete the response.");
}
