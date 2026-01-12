export const PRODUCTS = {
  // Must match App Store Connect product IDs
  premium_monthly: "com.wordcrack.premium.monthly",
  premium_annual: "com.wordcrack.premium.annual",
} as const;

export type ProductId = (typeof PRODUCTS)[keyof typeof PRODUCTS];


