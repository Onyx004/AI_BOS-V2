import type { IntegrationFamily, IntegrationKey } from "../constants/integration.js";

export type ProviderTestResult = { ok: boolean; detail: string };
export type ProviderSyncResult = { itemsSynced: number; summary: string };

export type ProviderIntegrationMeta = {
  key: IntegrationKey;
  name: string;
  description: string;
  category: string;
};

export type ProviderOAuthConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopesByIntegration: Partial<Record<IntegrationKey, string[]>>;
};

export type ProviderDefinition = {
  family: IntegrationFamily;
  authType: "oauth2" | "future_ready";
  oauth?: ProviderOAuthConfig;
  integrations: ProviderIntegrationMeta[];
  testConnection?: (accessToken: string) => Promise<ProviderTestResult>;
  sync?: (accessToken: string, integrationKey: IntegrationKey, context: { organizationId: string }) => Promise<ProviderSyncResult>;
};
