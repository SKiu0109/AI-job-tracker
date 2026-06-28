export type CreditStoreKind = "memory" | "supabase";

export type CreditBalance = {
  remaining: number;
  limit: number;
  costPerAnalysis: number;
  store: CreditStoreKind;
};

export type AiAvailability = {
  configured: boolean;
  provider: string;
  apiKeyEnvName?: string;
};

export type CreditsStatusResponse = {
  credits: CreditBalance;
  ai: AiAvailability;
  demoMode: boolean;
};
