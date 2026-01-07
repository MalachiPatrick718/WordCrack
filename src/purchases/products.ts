export const PRODUCTS = {
  premium_monthly: "wordcrack_premium_monthly",
  premium_annual: "wordcrack_premium_annual",
  premium_lifetime: "wordcrack_premium_lifetime",
} as const;

export type ProductId = (typeof PRODUCTS)[keyof typeof PRODUCTS];


