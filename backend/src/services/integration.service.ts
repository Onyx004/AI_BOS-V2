import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { integrationFamilies, type IntegrationFamily, type IntegrationKey } from "../constants/integration.js";
import type { ProviderDefinition } from "../integrations/types.js";
import {
  getIntegrationMeta,
  getProviderForIntegration,
  getScopesForIntegration,
  listAllIntegrationMeta,
} from "../integrations/registry.js";
import { integrationLogRepository } from "../repositories/integration-log.repository.js";
import { integrationProviderConfigRepository } from "../repositories/integration-provider-config.repository.js";
import { integrationRepository } from "../repositories/integration.repository.js";
import { organizationRepository } from "../repositories/organization.repository.js";
import { AppError } from "../utils/app-error.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { signOAuthState, verifyOAuthState } from "../utils/oauth-state.js";
import { notificationService } from "./notification.service.js";

type ConnectionWithTokens = {
  _id: unknown;
  organizationId: unknown;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
};

async function resolveFreshAccessToken(
  organizationId: Types.ObjectId,
  integrationKey: IntegrationKey,
  provider: ProviderDefinition,
  connection: ConnectionWithTokens,
): Promise<string> {
  const storedAccessToken = decryptSecret(connection.accessToken!);
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : undefined;
  const isExpiringSoon = expiresAt !== undefined && expiresAt - Date.now() < 60_000;

  if (!isExpiringSoon || !connection.refreshToken || !provider.oauth) {
    return storedAccessToken;
  }

  const config = await integrationProviderConfigRepository.findByFamilyWithSecret(provider.family);
  if (!config?.clientId || !config?.clientSecret) {
    return storedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptSecret(connection.refreshToken),
    client_id: config.clientId,
    client_secret: decryptSecret(config.clientSecret),
  });

  const response = await fetch(provider.oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const tokenBody = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!response.ok || !tokenBody.access_token) {
    return storedAccessToken;
  }

  await integrationRepository.upsertConnection(organizationId, integrationKey, {
    accessToken: encryptSecret(tokenBody.access_token),
    refreshToken: tokenBody.refresh_token ? encryptSecret(tokenBody.refresh_token) : connection.refreshToken,
    tokenExpiresAt: tokenBody.expires_in ? new Date(Date.now() + tokenBody.expires_in * 1000) : connection.tokenExpiresAt,
  });

  return tokenBody.access_token;
}

async function resolveOrganizationId(): Promise<Types.ObjectId> {
  const organization = await organizationRepository.getOrCreateDefault();
  return organization._id as Types.ObjectId;
}

function defaultRedirectUri() {
  const base = env.INTEGRATION_OAUTH_REDIRECT_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
  return `${base}${env.API_PREFIX}/integrations/oauth/callback`;
}

export class IntegrationService {
  async list() {
    const organizationId = await resolveOrganizationId();
    const connections = await integrationRepository.listForOrganization(organizationId);
    const byKey = new Map(connections.map((connection) => [connection.integrationKey, connection]));

    return listAllIntegrationMeta().map((meta) => {
      const connection = byKey.get(meta.key);
      return {
        key: meta.key,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        family: meta.family,
        authType: meta.authType,
        status: connection?.status ?? "disconnected",
        autoSyncEnabled: connection?.autoSyncEnabled ?? false,
        syncFrequency: connection?.syncFrequency ?? "manual",
        lastSyncAt: connection?.lastSyncAt,
        lastSyncStatus: connection?.lastSyncStatus,
        lastSyncSummary: connection?.lastSyncSummary,
        grantedScopes: connection?.grantedScopes ?? [],
        connectedAt: connection?.connectedAt,
      };
    });
  }

  async getConnectUrl(integrationKey: IntegrationKey, userId: string, returnOrigin: string) {
    const provider = getProviderForIntegration(integrationKey);
    if (provider.authType !== "oauth2" || !provider.oauth) {
      throw new AppError(`${getIntegrationMeta(integrationKey).name} is not yet available for connection`, 400);
    }

    const config = await integrationProviderConfigRepository.findByFamilyWithSecret(provider.family);
    if (!config?.clientId || !config?.clientSecret) {
      throw new AppError("This provider is not configured. Ask an administrator to add OAuth credentials in Admin Settings.", 400);
    }

    const redirectUri = config.redirectUri?.trim() || defaultRedirectUri();
    const state = signOAuthState({ userId, integrationKey, returnOrigin });

    const url = new URL(provider.oauth.authorizationUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", getScopesForIntegration(integrationKey).join(" "));
    url.searchParams.set("state", state);
    if (provider.family === "google") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
    }

    return { authorizationUrl: url.toString() };
  }

  async handleCallback(code: string, stateToken: string) {
    let state;
    try {
      state = verifyOAuthState(stateToken);
    } catch {
      throw new AppError("Invalid or expired OAuth state", 400);
    }

    const organizationId = await resolveOrganizationId();
    const provider = getProviderForIntegration(state.integrationKey);
    const config = await integrationProviderConfigRepository.findByFamilyWithSecret(provider.family);

    if (!config?.clientId || !config?.clientSecret || !provider.oauth) {
      await integrationLogRepository.create(organizationId, state.integrationKey, "connect", "error", "Provider not configured");
      return { returnOrigin: state.returnOrigin, integrationKey: state.integrationKey, success: false };
    }

    const redirectUri = config.redirectUri?.trim() || defaultRedirectUri();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: decryptSecret(config.clientSecret),
    });

    const response = await fetch(provider.oauth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const tokenBody = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !tokenBody.access_token) {
      await integrationLogRepository.create(
        organizationId,
        state.integrationKey,
        "connect",
        "error",
        tokenBody.error_description ?? tokenBody.error ?? "Token exchange failed",
      );
      return { returnOrigin: state.returnOrigin, integrationKey: state.integrationKey, success: false };
    }

    await integrationRepository.upsertConnection(organizationId, state.integrationKey, {
      family: provider.family,
      status: "connected",
      accessToken: encryptSecret(tokenBody.access_token),
      refreshToken: tokenBody.refresh_token ? encryptSecret(tokenBody.refresh_token) : undefined,
      tokenExpiresAt: tokenBody.expires_in ? new Date(Date.now() + tokenBody.expires_in * 1000) : undefined,
      grantedScopes: getScopesForIntegration(state.integrationKey),
      connectedBy: state.userId,
      connectedAt: new Date(),
    });
    await integrationLogRepository.create(organizationId, state.integrationKey, "connect", "success", "Connected successfully");

    void notificationService.dispatch({
      recipientUserIds: [state.userId],
      type: "integration_connected",
      category: "system",
      priority: "Low",
      title: `${getIntegrationMeta(state.integrationKey).name} connected`,
      body: "Integration connected successfully.",
      actionUrl: "/integrations",
    });

    return { returnOrigin: state.returnOrigin, integrationKey: state.integrationKey, success: true };
  }

  async disconnect(integrationKey: IntegrationKey) {
    const organizationId = await resolveOrganizationId();
    await integrationRepository.markDisconnected(organizationId, integrationKey);
    await integrationLogRepository.create(organizationId, integrationKey, "disconnect", "success", "Disconnected");
    return { disconnected: true };
  }

  async testConnection(integrationKey: IntegrationKey) {
    const organizationId = await resolveOrganizationId();
    const provider = getProviderForIntegration(integrationKey);
    const connection = await integrationRepository.findOneWithTokens(organizationId, integrationKey);

    if (!connection || connection.status !== "connected" || !connection.accessToken) {
      throw new AppError("This integration is not connected", 400);
    }

    if (!provider.testConnection) {
      const result = { ok: false, detail: "Not yet implemented for this integration" };
      await integrationLogRepository.create(organizationId, integrationKey, "health_check", "warning", result.detail);
      return result;
    }

    const accessToken = await resolveFreshAccessToken(organizationId, integrationKey, provider, connection);
    const result = await provider.testConnection(accessToken);
    await integrationLogRepository.create(organizationId, integrationKey, "health_check", result.ok ? "success" : "error", result.detail);
    return result;
  }

  async sync(integrationKey: IntegrationKey) {
    const organizationId = await resolveOrganizationId();
    const provider = getProviderForIntegration(integrationKey);
    const connection = await integrationRepository.findOneWithTokens(organizationId, integrationKey);

    if (!connection || connection.status !== "connected" || !connection.accessToken) {
      throw new AppError("This integration is not connected", 400);
    }

    if (!provider.sync) {
      const result = { itemsSynced: 0, summary: "Not yet implemented for this integration" };
      await integrationLogRepository.create(organizationId, integrationKey, "sync", "warning", result.summary);
      return result;
    }

    const accessToken = await resolveFreshAccessToken(organizationId, integrationKey, provider, connection);
    const result = await provider.sync(accessToken, integrationKey, { organizationId: organizationId.toString() });
    await integrationRepository.recordSyncResult((connection._id as Types.ObjectId).toString(), "success", result.summary);
    await integrationLogRepository.create(organizationId, integrationKey, "sync", "success", result.summary);
    return result;
  }

  async updateSettings(integrationKey: IntegrationKey, input: { autoSyncEnabled?: boolean; syncFrequency?: string }) {
    const organizationId = await resolveOrganizationId();
    return integrationRepository.updateSettings(organizationId, integrationKey, input);
  }

  async getLogs(integrationKey: IntegrationKey) {
    const organizationId = await resolveOrganizationId();
    return integrationLogRepository.list(organizationId, integrationKey);
  }

  async runAutoSyncSweep() {
    const candidates = await integrationRepository.findAutoSyncCandidates();
    const now = Date.now();
    let synced = 0;

    for (const connection of candidates) {
      if (!connection.accessToken || connection.syncFrequency === "manual") continue;

      const dueMs: Record<string, number> = { realtime: 0, hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
      const threshold = dueMs[connection.syncFrequency] ?? Infinity;
      const lastSync = connection.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : 0;
      if (now - lastSync < threshold) continue;

      const provider = getProviderForIntegration(connection.integrationKey);
      if (!provider.sync) continue;

      try {
        const organizationId = connection.organizationId as Types.ObjectId;
        const accessToken = await resolveFreshAccessToken(organizationId, connection.integrationKey, provider, connection);
        const result = await provider.sync(accessToken, connection.integrationKey, { organizationId: organizationId.toString() });
        await integrationRepository.recordSyncResult((connection._id as Types.ObjectId).toString(), "success", result.summary);
        await integrationLogRepository.create(connection.organizationId as Types.ObjectId, connection.integrationKey, "sync", "success", result.summary);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Auto sync failed";
        await integrationRepository.recordSyncResult((connection._id as Types.ObjectId).toString(), "error", message);
        await integrationLogRepository.create(connection.organizationId as Types.ObjectId, connection.integrationKey, "sync", "error", message);
      }
    }

    return synced;
  }

  async listProviderConfigs() {
    const configs = await Promise.all(integrationFamilies.map((family) => integrationProviderConfigRepository.findByFamilyWithSecret(family)));

    return integrationFamilies.map((family, index) => {
      const config = configs[index];
      return {
        family,
        isConfigured: Boolean(config?.clientId && config?.clientSecret),
        isEnabled: config?.isEnabled ?? false,
        redirectUri: config?.redirectUri ?? defaultRedirectUri(),
        updatedAt: config?.updatedAt,
      };
    });
  }

  async updateProviderConfig(
    family: IntegrationFamily,
    input: { clientId?: string; clientSecret?: string; redirectUri?: string; isEnabled?: boolean },
    userId?: string,
  ) {
    const data: Record<string, unknown> = { updatedBy: userId };
    if (typeof input.clientId === "string") data.clientId = input.clientId.trim();
    if (input.clientSecret?.trim()) data.clientSecret = encryptSecret(input.clientSecret.trim());
    if (typeof input.redirectUri === "string") data.redirectUri = input.redirectUri.trim();
    if (typeof input.isEnabled === "boolean") data.isEnabled = input.isEnabled;

    await integrationProviderConfigRepository.upsert(family, data);
    return this.listProviderConfigs();
  }
}

export const integrationService = new IntegrationService();
