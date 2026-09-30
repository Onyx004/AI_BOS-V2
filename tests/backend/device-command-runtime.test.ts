import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

type CommandRecord = Record<string, any> & {
  commandId: string;
  deviceId: string;
  status: string;
};

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const expiresAt = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() >= expiresAt) {
      throw new Error("Timed out waiting for device command lifecycle");
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("Admin request, authenticated Agent poll, PING execution, result persistence, and history use one deviceId", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "aibos-command-test-"));
  process.env.ProgramData = tempRoot;

  const { createApp } = await import("../../backend/src/app.ts");
  const { createTokenPair } = await import("../../backend/src/utils/jwt.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { permissionService } = await import("../../backend/src/services/permission.service.ts");
  const { administratorMonitoringAccessService } = await import(
    "../../backend/src/services/administrator-monitoring-access.service.ts"
  );
  const { managedDeviceRepository } = await import("../../backend/src/repositories/managed-device.repository.ts");
  const { deviceCommandRepository } = await import("../../backend/src/repositories/device-command.repository.ts");
  const { deviceCredentialService } = await import("../../backend/src/services/device-credential.service.ts");

  const original = {
    findUser: userRepository.findById,
    permissions: permissionService.resolveEffectivePermissions,
    requireMonitoringPermission:
      administratorMonitoringAccessService.requirePermission,
    findDevice: managedDeviceRepository.findByDeviceId,
    create: deviceCommandRepository.create,
    expire: deviceCommandRepository.expirePendingCommands,
    failStale: deviceCommandRepository.failStaleDeliveryCommands,
    requeue: deviceCommandRepository.requeueStaleDeliveryCommands,
    claim: deviceCommandRepository.claimNextQueuedCommand,
    findCommand: deviceCommandRepository.findByCommandId,
    updateStatus: deviceCommandRepository.updateStatus,
    history: deviceCommandRepository.findRecentByDeviceId,
    verifyDevice: deviceCredentialService.verify,
  };

  const commands: CommandRecord[] = [];

  userRepository.findById = (async () => ({
    id: "admin-user-1",
    role: "Administrator",
    isActive: true,
    mustChangePassword: false,
  })) as any;

  permissionService.resolveEffectivePermissions = (async () => ({
    hasFullAccess: true,
    permissionKeys: new Set([
      "device.command.view",
      "device.command.execute",
      "device.command.power",
    ]),
  })) as any;
  administratorMonitoringAccessService.requirePermission =
    (async () => undefined) as any;

  managedDeviceRepository.findByDeviceId = (async (deviceId: string) =>
    deviceId === "DEV-RUNTIME-1"
      ? { deviceId, status: "online" }
      : null) as any;

  deviceCommandRepository.create = (async (input: Record<string, unknown>) => {
    const command: CommandRecord = {
      ...input,
      status: "queued",
      attemptCount: 0,
      result: null,
      errorMessage: null,
    } as CommandRecord;
    commands.push(command);
    return command;
  }) as any;

  deviceCommandRepository.expirePendingCommands = (async () => undefined) as any;
  deviceCommandRepository.failStaleDeliveryCommands = (async () => undefined) as any;
  deviceCommandRepository.requeueStaleDeliveryCommands = (async () => undefined) as any;
  deviceCommandRepository.claimNextQueuedCommand = (async (deviceId: string) => {
    const command = commands.find((item) => item.deviceId === deviceId && item.status === "queued");
    if (!command) return null;
    command.status = "sent";
    command.attemptCount += 1;
    command.sentAt = new Date();
    return { ...command };
  }) as any;
  deviceCommandRepository.findByCommandId = (async (commandId: string) => {
    const command = commands.find((item) => item.commandId === commandId);
    return command ? { ...command } : null;
  }) as any;
  deviceCommandRepository.updateStatus = (async (
    commandId: string,
    deviceId: string,
    update: Record<string, unknown>,
  ) => {
    const command = commands.find(
      (item) => item.commandId === commandId && item.deviceId === deviceId,
    );
    if (!command) return null;
    Object.assign(command, update);
    return { ...command };
  }) as any;
  deviceCommandRepository.findRecentByDeviceId = (async (deviceId: string) =>
    commands.filter((item) => item.deviceId === deviceId).map((item) => ({ ...item }))) as any;

  deviceCredentialService.verify = (async (deviceId: string, token: string) =>
    deviceId === "DEV-RUNTIME-1" && token === "device-token-1") as any;

  const server = createServer(createApp());

  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    process.env.BACKEND_URL = `http://127.0.0.1:${address.port}`;

    const accessToken = createTokenPair({
      sub: "admin-user-1",
      role: "Administrator",
    }).accessToken;

    const createResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/DEV-RUNTIME-1/commands`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "PING" }),
      },
    );
    assert.equal(createResponse.status, 201);
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.deviceId, "DEV-RUNTIME-1");
    assert.equal(commands[0]?.requestedBy, "admin-user-1");
    assert.equal(commands[0]?.requestedByRole, "Administrator");
    assert.equal(commands[0]?.authorizationPermission, "device.command.execute");

    const { startDeviceCommandPoller } = await import("../../device-agent/src/command-poller.ts");

    let stopPoller: (() => void) | undefined;
    try {
      stopPoller = startDeviceCommandPoller({
        deviceId: "DEV-RUNTIME-1",
        getAuthHeaders: async () => ({
          "x-device-id": "DEV-RUNTIME-1",
          "x-device-token": "device-token-1",
        }),
      });
      await waitFor(() => commands[0]?.status === "completed");
    } finally {
      stopPoller?.();
    }

    assert.equal(commands[0]?.attemptCount, 1);
    assert.deepEqual(commands[0]?.result, {
      message: "pong",
      deviceId: "DEV-RUNTIME-1",
      completedAt: commands[0]?.result.completedAt,
    });
    assert.equal(commands[0]?.errorMessage, null);

    const historyResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/DEV-RUNTIME-1/commands`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    assert.equal(historyResponse.status, 200);
    const historyBody = (await historyResponse.json()) as any;
    assert.equal(historyBody.data.commands[0].status, "completed");
    assert.equal(historyBody.data.commands[0].result.message, "pong");

    const failedCreateResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/DEV-RUNTIME-1/commands`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "PING" }),
      },
    );
    assert.equal(failedCreateResponse.status, 201);

    const agentHeaders = {
      "x-device-id": "DEV-RUNTIME-1",
      "x-device-token": "device-token-1",
    };
    const failedDeliveryResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/commands/next?deviceId=DEV-RUNTIME-1`,
      { headers: agentHeaders },
    );
    const failedDeliveryBody = (await failedDeliveryResponse.json()) as any;
    const failedCommandId = failedDeliveryBody.data.commandId as string;
    assert.equal(failedDeliveryResponse.status, 200);

    const failedStatusResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/commands/status`,
      {
        method: "POST",
        headers: {
          ...agentHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: "DEV-RUNTIME-1",
          commandId: failedCommandId,
          status: "failed",
          result: null,
          errorMessage: "Safe executor failure",
        }),
      },
    );
    assert.equal(failedStatusResponse.status, 200);

    const failedHistoryResponse = await fetch(
      `${process.env.BACKEND_URL}/api/v1/devices/DEV-RUNTIME-1/commands`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const failedHistoryBody = (await failedHistoryResponse.json()) as any;
    const failedHistory = failedHistoryBody.data.commands.find(
      (command: any) => command.commandId === failedCommandId,
    );
    assert.equal(failedHistory.status, "failed");
    assert.equal(failedHistory.errorMessage, "Safe executor failure");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    userRepository.findById = original.findUser;
    permissionService.resolveEffectivePermissions = original.permissions;
    administratorMonitoringAccessService.requirePermission =
      original.requireMonitoringPermission;
    managedDeviceRepository.findByDeviceId = original.findDevice;
    deviceCommandRepository.create = original.create;
    deviceCommandRepository.expirePendingCommands = original.expire;
    deviceCommandRepository.failStaleDeliveryCommands = original.failStale;
    deviceCommandRepository.requeueStaleDeliveryCommands = original.requeue;
    deviceCommandRepository.claimNextQueuedCommand = original.claim;
    deviceCommandRepository.findByCommandId = original.findCommand;
    deviceCommandRepository.updateStatus = original.updateStatus;
    deviceCommandRepository.findRecentByDeviceId = original.history;
    deviceCredentialService.verify = original.verifyDevice;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("existing Administrator access migrates once and later Owner policy remains authoritative", async () => {
  const { RuntimeMigrationModel } = await import(
    "../../backend/src/models/runtime-migration.model.ts"
  );
  const { AdministratorMonitoringAccessModel } = await import(
    "../../backend/src/models/administrator-monitoring-access.model.ts"
  );
  const { UserModel } = await import("../../backend/src/models/user.model.ts");
  const { RoleModel } = await import("../../backend/src/models/role.model.ts");
  const { applyRuntimeMigrations } = await import(
    "../../backend/src/database/runtime-migrations.ts"
  );

  const original = {
    findMigration: RuntimeMigrationModel.findOne,
    createMigration: RuntimeMigrationModel.create,
    findUsers: UserModel.find,
    bulkWrite: AdministratorMonitoringAccessModel.bulkWrite,
    updateRole: RoleModel.updateOne,
  };

  let migrationApplied = false;
  const writes: any[] = [];

  RuntimeMigrationModel.findOne = (() => ({
    lean: async () => (migrationApplied ? { key: "administrator-monitoring-access-v1" } : null),
  })) as any;
  RuntimeMigrationModel.create = (async () => {
    migrationApplied = true;
    return {};
  }) as any;
  UserModel.find = (() => ({
    select: () => ({
      lean: async () => [{ _id: "existing-admin-1" }],
    }),
  })) as any;
  AdministratorMonitoringAccessModel.bulkWrite = (async (operations: any[]) => {
    writes.push(...operations);
    return {};
  }) as any;
  RoleModel.updateOne = (async () => ({})) as any;

  try {
    await applyRuntimeMigrations();
    await applyRuntimeMigrations();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].updateOne.upsert, true);
    assert.equal(writes[0].updateOne.update.$set, undefined);
    assert.equal(writes[0].updateOne.update.$setOnInsert.enabled, true);
    assert.deepEqual(writes[0].updateOne.update.$setOnInsert.permissionKeys, [
      "device.monitoring.view",
      "device.command.view",
      "device.command.execute",
      "device.command.power",
      "device.software.manage",
      "device.restriction.manage",
      "device.remote_support.create",
      "device.remote_support.control",
    ]);
  } finally {
    RuntimeMigrationModel.findOne = original.findMigration;
    RuntimeMigrationModel.create = original.createMigration;
    UserModel.find = original.findUsers;
    AdministratorMonitoringAccessModel.bulkWrite = original.bulkWrite;
    RoleModel.updateOne = original.updateRole;
  }
});
