export type RedemptionCode = {
  id: string;
  code: string;
  creditAmount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CodeRedemption = {
  id: string;
  codeId: string;
  code: string;
  userId: string;
  creditAmount: number;
  redeemedAt: string;
};

export type RedeemResult = {
  success: boolean;
  codeId: string | null;
  creditAmount: number;
  newRemaining: number;
  errorMessage: string | null;
};

export type GenerateCodesRequest = {
  count: number; // how many codes to generate (1–100)
  creditAmount: number;
  maxUses: number; // per-code use limit
  expiresAt: string | null; // ISO 8601 or null
  note: string | null;
};

export type GenerateCodesResult = {
  codes: RedemptionCode[];
  totalGenerated: number;
  totalCredits: number;
};

export type AdminCodeListResponse = {
  codes: RedemptionCode[];
  stats: {
    total: number;
    active: number;
    expired: number;
    depleted: number;
    totalRedeemed: number;
  };
};
