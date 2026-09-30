import { supportedCurrencies } from "../constants/currencies.js";
import { organizationRepository } from "../repositories/organization.repository.js";
import { organizationSettingsRepository } from "../repositories/organization-settings.repository.js";

/** The organization's currency, used when a CRM record is saved without one. Falls back to INR. */
export async function getDefaultCurrency() {
  const organization = await organizationRepository.getOrCreateDefault();
  const settings = await organizationSettingsRepository.getOrCreateDefault(organization._id);
  const currency = settings.currency?.toUpperCase();
  return (supportedCurrencies as readonly string[]).includes(currency) ? currency : "INR";
}

export async function getCrmSettings() {
  return { defaultCurrency: await getDefaultCurrency(), currencies: [...supportedCurrencies] };
}
