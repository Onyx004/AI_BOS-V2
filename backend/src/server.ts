import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./database/mongo.js";
import {
  applyRuntimeMigrations,
} from "./database/runtime-migrations.js";
import { startAttendancePresenceScheduler } from "./jobs/attendance-presence-scheduler.js";
import { startBackupScheduler } from "./jobs/backup-scheduler.js";
import { backupService } from "./services/backup.service.js";
import { startIntegrationSyncScheduler } from "./jobs/integration-sync-scheduler.js";
import {
  startManagedDeviceStatusScheduler,
  stopManagedDeviceStatusScheduler,
} from "./jobs/managed-device-status-scheduler.js";
import { startNotificationScheduler } from "./jobs/notification-scheduler.js";
import { startWorkflowStepScheduler } from "./jobs/workflow-step-scheduler.js";
import { initSocketServer } from "./realtime/socket-server.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const server = createServer(app);

initSocketServer(server);

async function bootstrap() {
  await connectDatabase();
  await applyRuntimeMigrations();

  startNotificationScheduler();
  startIntegrationSyncScheduler();
  await backupService.seedDefaultSchedules();
  startBackupScheduler();
  startWorkflowStepScheduler();
  startManagedDeviceStatusScheduler();
  startAttendancePresenceScheduler();

  server.listen(env.PORT, () => {
    logger.info(
      `AI BOS API running on port ${env.PORT}`,
    );
  });
}

async function shutdown(signal: string) {
  logger.info(
    `${signal} received. Shutting down API server.`,
  );

  stopManagedDeviceStatusScheduler();

  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGTERM", () =>
  void shutdown("SIGTERM"),
);

process.on("SIGINT", () =>
  void shutdown("SIGINT"),
);

void bootstrap().catch((error) => {
  logger.error(error);
  process.exit(1);
});
