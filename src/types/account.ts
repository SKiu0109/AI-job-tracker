export type AccountType = "guest" | "free" | "paid" | "admin";

export type AccountStatus = {
  accountType: AccountType;
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  credits: {
    monthlyLimit: number;
    guestLimit: number;
    adminBypass: boolean;
  };
};
