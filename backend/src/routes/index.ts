import { Router } from "express";
import { analyticsRoutes } from "./analytics.routes.js";
import { aiRoutes } from "./ai.routes.js";
import { attendanceRoutes } from "./attendance.routes.js";
import { authRoutes } from "./auth.routes.js";
import { auditLogRoutes } from "./audit-log.routes.js";
import { backupRoutes } from "./backup.routes.js";
import { branchRoutes } from "./branch.routes.js";
import { crmRoutes } from "./crm.routes.js";
import { collaborationMessageRoutes } from "./collaboration-message.routes.js";
import { collaborationRoomRoutes } from "./collaboration-room.routes.js";
import { companyPolicyRoutes } from "./company-policy.routes.js";
import { departmentRoutes } from "./department.routes.js";
import { documentRoutes } from "./document.routes.js";
import { financeRoutes } from "./finance.routes.js";
import { faceEnrollmentRoutes } from "./face-enrollment.routes.js";
import { holidayRoutes } from "./holiday.routes.js";
import { integrationRoutes } from "./integration.routes.js";
import { leaveRequestRoutes } from "./leave-request.routes.js";
import { meetingRoutes } from "./meeting.routes.js";
import { notificationRoutes } from "./notification.routes.js";
import { notificationPreferenceRoutes } from "./notification-preference.routes.js";
import { scheduledNotificationRoutes } from "./scheduled-notification.routes.js";
import { organizationRoutes } from "./organization.routes.js";
import { organizationSettingsRoutes } from "./organization-settings.routes.js";
import { orgHierarchyRoutes } from "./org-hierarchy.routes.js";
import { permissionAuditLogRoutes } from "./permission-audit-log.routes.js";
import { permissionCatalogRoutes } from "./permission-catalog.routes.js";
import { permissionGroupRoutes } from "./permission-group.routes.js";
import { productRoutes } from "./product.routes.js";
import { projectRoutes } from "./project.routes.js";
import { protectedAccountRoutes } from "./protected-account.routes.js";
import { roleRoutes } from "./role.routes.js";
import { leadRoutes } from "./lead.routes.js";
import { taskRoutes } from "./task.routes.js";
import { roleHistoryRoutes } from "./role-history.routes.js";
import { roleTemplateRoutes } from "./role-template.routes.js";
import { securityRoutes } from "./security.routes.js";
import { teamRoutes } from "./team.routes.js";
import { uploadRoutes } from "./upload.routes.js";
import { userRoutes } from "./user.routes.js";
import { workflowRoutes } from "./workflow.routes.js";
import { auditMiddleware } from "../middleware/audit.middleware.js";
import { monitoringRoutes } from "./monitoring.routes.js";
import { deviceRoutes } from "./device.routes.js";
import { administratorMonitoringAccessRoutes } from "./administrator-monitoring-access.routes.js";

export const routes = Router();

routes.use(auditMiddleware);

routes.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AI BOS API v1",
  });
});

routes.use("/analytics", analyticsRoutes);
routes.use("/ai", aiRoutes);
routes.use("/attendance", attendanceRoutes);
routes.use("/audit/logs", auditLogRoutes);
routes.use("/auth", authRoutes);
routes.use("/backup", backupRoutes);
routes.use("/collaboration/rooms", collaborationRoomRoutes);
routes.use("/collaboration/messages", collaborationMessageRoutes);
routes.use("/finance", financeRoutes);
routes.use("/documents", documentRoutes);
routes.use("/face-enrollment", faceEnrollmentRoutes);
routes.use("/integrations", integrationRoutes);
routes.use("/leave-requests", leaveRequestRoutes);
routes.use("/meetings", meetingRoutes);
routes.use("/notifications/preferences", notificationPreferenceRoutes);
routes.use("/notifications/scheduled", scheduledNotificationRoutes);
routes.use("/notifications", notificationRoutes);
routes.use("/products", productRoutes);
routes.use("/projects", projectRoutes);
routes.use("/protected-accounts", protectedAccountRoutes);
routes.use("/tasks", taskRoutes);
routes.use("/leads", leadRoutes);
routes.use("/crm", crmRoutes);
routes.use("/users", userRoutes);
routes.use("/uploads", uploadRoutes);
routes.use("/workflows", workflowRoutes);
routes.use("/organization/settings", organizationSettingsRoutes);
routes.use("/organization/departments", departmentRoutes);
routes.use("/organization/branches", branchRoutes);
routes.use("/organization/teams", teamRoutes);
routes.use("/organization/holidays", holidayRoutes);
routes.use("/organization/policies", companyPolicyRoutes);
routes.use("/organization/hierarchy", orgHierarchyRoutes);
routes.use("/organization", organizationRoutes);
routes.use("/rbac/roles", roleRoutes);
routes.use("/rbac/permission-groups", permissionGroupRoutes);
routes.use("/rbac/role-templates", roleTemplateRoutes);
routes.use("/rbac/audit-log", permissionAuditLogRoutes);
routes.use("/rbac/role-history", roleHistoryRoutes);
routes.use("/rbac/permissions", permissionCatalogRoutes);
routes.use("/security", securityRoutes);
routes.use("/monitoring", monitoringRoutes);
routes.use("/devices", deviceRoutes);
routes.use(
  "/administrator-monitoring-access",
  administratorMonitoringAccessRoutes,
);
