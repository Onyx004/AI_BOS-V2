import cron from "node-cron";
import { attendanceService } from "../services/attendance.service.js";
import { logger } from "../utils/logger.js";

export function startAttendancePresenceScheduler() {
  cron.schedule("*/5 * * * *", () => {
    void attendanceService.autoCheckOutOfflineUsers().catch((error) => {
      logger.error(error, "Attendance presence sweep failed");
    });
  });

  logger.info("Attendance presence scheduler started (5-minute sweep, 2h offline limit)");
}
