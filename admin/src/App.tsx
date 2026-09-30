import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { AnimatedAppRoutes, AppProviders, lazyNamed, type AppRouteConfig } from "@shared/platform/AppShell";
import { workspaceSearchItems, quickCreateActions } from "@/data/workspace";
import {
  AdministratorMonitoringAccessProvider,
  useAdministratorMonitoringAccess,
} from "@/admin/features/administrator-access/AdministratorMonitoringAccessContext";

const adminRoles = ["Administrator", "Owner"] as const;

const LoginPage = lazyNamed(() => import("@/features/auth/login"), "LoginPage");
const ForgotPasswordPage = lazyNamed(() => import("@/features/auth/pages/ForgotPasswordPage"),"ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(() => import("@/features/auth/pages/ResetPasswordPage"), "ResetPasswordPage");
const EmailVerificationPage = lazyNamed(() => import("@/features/auth/pages/EmailVerificationPage"), "EmailVerificationPage");
const AdminDashboardPage = lazyNamed(() => import("@/common/features/dashboard"), "AdminDashboardPage");
const AdminPage = lazyNamed(() => import("@/admin/features/admin"), "AdminPage");
const AdminAccessGate = lazyNamed(() => import("@/admin/features/admin/AdminAccessGate"), "AdminAccessGate");
const CollaborationHubPage = lazyNamed(() => import("@/admin/features/collaboration"), "CollaborationHubPage");
const NotificationCenterPage = lazyNamed(() => import("@/admin/features/notifications"), "NotificationCenterPage");
const OrganizationPage = lazyNamed(() => import("@/admin/features/organization"), "OrganizationPage");
const RBACPage = lazyNamed(() => import("@/admin/features/rbac"), "RBACPage");
const SettingsPage = lazyNamed(() => import("@/admin/features/settings"), "SettingsPage");
const IntegrationsCenterPage = lazyNamed(() => import("@/admin/features/integrations"), "IntegrationsCenterPage");
const AuditBackupPage = lazyNamed(() => import("@/admin/features/audit-backup"), "AuditBackupPage");
const SecurityDashboardPage = lazyNamed(() => import("@/admin/features/security"), "SecurityDashboardPage");
const AttendancePage = lazyNamed(() => import("@/admin/features/attendance"), "AttendancePage");
const MonitoringDashboardPage = lazyNamed(() => import("@/admin/features/monitoring"), "MonitoringDashboardPage");
const DeviceDetailsPage = lazyNamed(() => import("@/admin/features/monitoring"), "DeviceDetailsPage");
const SoftwareCatalogPage = lazyNamed(() => import("@/admin/features/monitoring"), "SoftwareCatalogPage");
const ProjectsPage = lazyNamed(() => import("@shared/projects"), "ProjectsPage");
const ProjectDetailsPage = lazyNamed(() => import("@shared/projects"), "ProjectDetailsPage");
const WorkflowsPage = lazyNamed(() => import("@shared/workflows"), "WorkflowsPage");
const TasksPage = lazyNamed(() => import("@shared/tasks"), "TasksPage");
const MeetingsPage = lazyNamed(() => import("@shared/meetings"), "MeetingsPage");
const CrmPage = lazyNamed(() => import("@shared/crm"), "CrmPage");
const FinancePage = lazyNamed(() => import("@shared/finance"), "FinancePage");
const ProductsPage = lazyNamed(() => import("@shared/products"), "ProductsPage");
const DocumentsPage = lazyNamed(() => import("@shared/documents"), "DocumentsPage");
const EmployeesPage = lazyNamed(() => import("@shared/employees"), "EmployeesPage");
const ProfilePage = lazyNamed(() => import("@shared/profile/RoleProfilePage"), "RoleProfilePage");
const CompleteProfilePage = lazyNamed(() => import("@shared/profile/CompleteProfilePage"), "CompleteProfilePage");
const ChangePasswordRequiredPage = lazyNamed(() => import("@shared/auth/pages/ChangePasswordRequiredPage"), "ChangePasswordRequiredPage");
const FirstOwnerSetupPage = lazyNamed(() => import("@/admin/features/account-security/FirstOwnerSetupPage"), "FirstOwnerSetupPage");
const AccountSecurityPage = lazyNamed(() => import("@/admin/features/account-security/AccountSecurityPage"), "AccountSecurityPage");
const AdministratorAccessPage = lazyNamed(() => import("@/admin/features/administrator-access"), "AdministratorAccessPage");
const MonitoringAccessGate = lazyNamed(() => import("@/admin/features/administrator-access"), "MonitoringAccessGate");

const routes: AppRouteConfig[] = [
  { path: "/", element: <Navigate replace to="/login" /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/reset-password/:token", element: <ResetPasswordPage /> },
  { path: "/verify-email", element: <EmailVerificationPage /> },
  { path: "/verify-email/:token", element: <EmailVerificationPage /> },
  { path: "/first-owner-setup", element: <FirstOwnerSetupPage /> },
  { path: "/change-password-required", element: <ChangePasswordRequiredPage />, allowedRoles: adminRoles },
  { path: "/complete-profile", element: <CompleteProfilePage />, allowedRoles: adminRoles },
  { path: "/dashboard", element: <AdminDashboardPage />, allowedRoles: adminRoles },
  { path: "/profile", element: <ProfilePage />, allowedRoles: adminRoles },
  { path: "/admin", element: <AdminAccessGate><AdminPage /></AdminAccessGate>, allowedRoles: adminRoles },
  { path: "/admin/organization", element: <OrganizationPage />, allowedRoles: adminRoles },
  { path: "/admin/rbac", element: <RBACPage />, allowedRoles: adminRoles },
  { path: "/settings", element: <SettingsPage />, allowedRoles: adminRoles },
  { path: "/account-security", element: <AccountSecurityPage />, allowedRoles: adminRoles },
  { path: "/settings/administrator-access", element: <AdministratorAccessPage />, allowedRoles: ["Owner"], allowFullAccessBypass: false },
  { path: "/integrations", element: <IntegrationsCenterPage />, allowedRoles: adminRoles },
  { path: "/projects", element: <ProjectsPage />, allowedRoles: adminRoles },
  { path: "/projects/:id", element: <ProjectDetailsPage />, allowedRoles: adminRoles },
  { path: "/workflows", element: <WorkflowsPage />, allowedRoles: adminRoles },
  { path: "/tasks", element: <TasksPage />, allowedRoles: adminRoles },
  { path: "/meetings", element: <MeetingsPage />, allowedRoles: adminRoles },
  { path: "/crm", element: <CrmPage />, allowedRoles: adminRoles },
  { path: "/finance", element: <FinancePage />, allowedRoles: adminRoles },
  { path: "/products", element: <ProductsPage />, allowedRoles: adminRoles },
  { path: "/documents", element: <DocumentsPage />, allowedRoles: adminRoles },
  { path: "/employees", element: <EmployeesPage />, allowedRoles: adminRoles },
  { path: "/attendance", element: <AttendancePage />, allowedRoles: adminRoles },
  { path: "/messenger", element: <CollaborationHubPage />, allowedRoles: adminRoles },
  { path: "/collaboration", element: <CollaborationHubPage />, allowedRoles: adminRoles },
  { path: "/notifications", element: <NotificationCenterPage />, allowedRoles: adminRoles },
  { path: "/audit-backup", element: <AuditBackupPage />, allowedRoles: adminRoles },
  { path: "/security", element: <SecurityDashboardPage />, allowedRoles: adminRoles },
  { path: "/monitoring", element: <MonitoringAccessGate><MonitoringDashboardPage /></MonitoringAccessGate>, allowedRoles: adminRoles },
  { path: "/monitoring/devices/:deviceId", element: <MonitoringAccessGate><DeviceDetailsPage /></MonitoringAccessGate>, allowedRoles: adminRoles },
  { path: "/monitoring/software-catalog", element: <MonitoringAccessGate><SoftwareCatalogPage /></MonitoringAccessGate>, allowedRoles: adminRoles },
];

function AdminAppExperience() {
  const {
    hasPermission,
  } =
    useAdministratorMonitoringAccess();

  const visibleSearchItems =
    useMemo(
      () =>
        hasPermission(
          "device.monitoring.view",
        )
          ? workspaceSearchItems
          : workspaceSearchItems.filter(
              (item) =>
                item.id !==
                "nav-monitoring",
            ),
      [hasPermission],
    );

  return (
    <AppProviders
      quickCreateActions={quickCreateActions}
      searchItems={visibleSearchItems}
    >
      <AnimatedAppRoutes routes={routes} />
    </AppProviders>
  );
}

export default function App() {
  return (
    <AdministratorMonitoringAccessProvider>
      <AdminAppExperience />
    </AdministratorMonitoringAccessProvider>
  );
}
