/** Currencies a CRM record can be priced in. The organization's own currency (Settings) is the default. */
export const supportedCurrencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY", "CNY", "CHF", "SAR", "ZAR"] as const;
export type SupportedCurrency = (typeof supportedCurrencies)[number];
