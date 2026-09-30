import { Navigate } from "react-router-dom";
import { crmViewPermissions } from "@shared/crm/permissions";
import { AnimatedAppRoutes, AppProviders, lazyNamed, type AppRouteConfig } from "@shared/platform/AppShell";
import {
 employeeDirectoryRoles,
 documentRoles,
 financeRoles,
 frontlineRoles,
 hrRoles,
 managerRoles,
 quickCreateActions,
 salesRoles,
 workspaceSearchItems,
} from "@/data/workspace";
import { DeviceEnrollmentBootstrap } from "@/features/auth/DeviceEnrollmentBootstrap";


const LoginPage = lazyNamed(() => import("@/features/auth/login"), "LoginPage");
const ForgotPasswordPage = lazyNamed(() => import("@/features/auth/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(() => import("@/features/auth/pages/ResetPasswordPage"), "ResetPasswordPage");
const EmailVerificationPage = lazyNamed(() => import("@/features/auth/pages/EmailVerificationPage"), "EmailVerificationPage");
const DashboardPage = lazyNamed(() => import("@/common/features/dashboard"), "DashboardPage");
const ProfilePage = lazyNamed(() => import("@/common/features/profile"), "ProfilePage");
const ProjectsPage = lazyNamed(() => import("@shared/projects"), "ProjectsPage");
const ProjectDetailsPage = lazyNamed(() => import("@shared/projects"), "ProjectDetailsPage");
const WorkflowsPage = lazyNamed(() => import("@shared/workflows"), "WorkflowsPage");
const TasksPage = lazyNamed(() => import("@shared/tasks"), "TasksPage");
const EmployeesPage = lazyNamed(() => import("@/hr/features/employees"), "EmployeesPage");
const CrmPage = lazyNamed(() => import("@shared/crm"), "CrmPage");
const FinancePage = lazyNamed(() => import("@shared/finance"), "FinancePage");
const ProductsPage = lazyNamed(() => import("@shared/products"), "ProductsPage");
const DocumentsPage = lazyNamed(() => import("@shared/documents"), "DocumentsPage");
const MeetingsPage = lazyNamed(() => import("@shared/meetings"), "MeetingsPage");
const CollaborationHubPage = lazyNamed(() => import("@/common/features/collaboration"), "CollaborationHubPage");
const NotificationCenterPage = lazyNamed(() => import("@/common/features/notifications"), "NotificationCenterPage");
const TeamAccountsPage = lazyNamed(() => import("@/common/features/team-accounts"), "TeamAccountsPage");
const ChangePasswordRequiredPage = lazyNamed(() => import("@shared/auth/pages/ChangePasswordRequiredPage"), "ChangePasswordRequiredPage");
const CompleteProfilePage = lazyNamed(() => import("@shared/profile/CompleteProfilePage"), "CompleteProfilePage");
const FaceEnrollmentPage = lazyNamed(() => import("@shared/face-enrollment"), "FaceEnrollmentPage");




const routes: AppRouteConfig[] = [
 { path: "/", element: <Navigate to="/login" replace /> },
 { path: "/login", element: <LoginPage /> },
 { path: "/forgot-password", element: <ForgotPasswordPage /> },
 { path: "/reset-password", element: <ResetPasswordPage /> },
 { path: "/reset-password/:token", element: <ResetPasswordPage /> },
 { path: "/verify-email", element: <EmailVerificationPage /> },
 { path: "/verify-email/:token", element: <EmailVerificationPage /> },
 { path: "/change-password-required", element: <ChangePasswordRequiredPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/complete-profile", element: <CompleteProfilePage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/face-enrollment", element: <FaceEnrollmentPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/dashboard", element: <DashboardPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/profile", element: <ProfilePage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/projects", element: <ProjectsPage />, allowedRoles: managerRoles, requireProfileComplete: false },
 { path: "/projects/:id", element: <ProjectDetailsPage />, allowedRoles: managerRoles, requireProfileComplete: false },
 { path: "/workflows", element: <WorkflowsPage />, allowedRoles: managerRoles, requireProfileComplete: false },
 { path: "/tasks", element: <TasksPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/employees", element: <EmployeesPage />, allowedRoles: employeeDirectoryRoles, requireProfileComplete: false },
 { path: "/team-accounts", element: <TeamAccountsPage />, allowedRoles: hrRoles, requireProfileComplete: false },
 { path: "/crm", element: <CrmPage />, allowedRoles: salesRoles, allowedPermissions: crmViewPermissions, requireProfileComplete: false },
 { path: "/finance", element: <FinancePage />, allowedRoles: financeRoles, requireProfileComplete: false },
 { path: "/products", element: <ProductsPage />, allowedRoles: salesRoles, requireProfileComplete: false },
 { path: "/documents", element: <DocumentsPage />, allowedRoles: documentRoles, requireProfileComplete: false },
 { path: "/meetings", element: <MeetingsPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/messenger", element: <CollaborationHubPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/collaboration", element: <CollaborationHubPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
 { path: "/notifications", element: <NotificationCenterPage />, allowedRoles: frontlineRoles, requireProfileComplete: false },
];

for (const route of routes) {
 if (route.allowedRoles) {
 route.allowFullAccessBypass = false;
 }
}

export default function App() {
 return (
 <AppProviders allowFullAccessBypass={false} quickCreateActions={quickCreateActions} searchItems={workspaceSearchItems}>
 <DeviceEnrollmentBootstrap />
 <AnimatedAppRoutes routes={routes} />
 </AppProviders>
 );
}
