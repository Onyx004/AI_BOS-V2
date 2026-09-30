import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const managerRoutes = [
 ["/dashboard", "frontlineRoles"],
 ["/projects", "managerRoles"],
 ["/workflows", "managerRoles"],
 ["/tasks", "frontlineRoles"],
 ["/meetings", "frontlineRoles"],
 ["/messenger", "frontlineRoles"],
 ["/employees", "employeeDirectoryRoles"],
 ["/analytics", "managerRoles"],
 ["/notifications", "frontlineRoles"],
 ["/profile", "frontlineRoles"],
] as const;

async function source(path: string) {
 return readFile(path, "utf8");
}

test("Admin app login, routes, search, and dashboard exclude Manager", async () => {
 const [appSource, loginSource, workspaceSource, dashboardSource] = await Promise.all([
 source("admin/src/App.tsx"),
 source("admin/src/features/auth/login/LoginPage.tsx"),
 source("admin/src/data/workspace.ts"),
 source("admin/src/common/features/dashboard/AdminDashboardPage.tsx"),
 ]);

 assert.match(appSource, /const adminRoles = \["Administrator", "Owner"\] as const/);
 assert.doesNotMatch(appSource, /Manager|managerPortalRoles|@\/manager/);
 assert.match(loginSource, /const intendedFor = \["Administrator", "Owner"\] as const/);
 assert.doesNotMatch(loginSource, /Manager|Management Portal/);
 assert.doesNotMatch(workspaceSource, /Manager/);
 assert.doesNotMatch(dashboardSource, /Manager|managerNav|manager-completed/);

 for (const line of appSource.match(/\{ path: "\/[^"]+"[^\n]+allowedRoles: [^\n]+/g) ?? []) {
 assert.doesNotMatch(line, /Manager|managerPortalRoles/);
 }
});

test("Employee login accepts Manager and excludes Owner and Administrator", async () => {
 const loginSource = await source("frontend/src/features/auth/login/LoginPage.tsx");

 assert.match(loginSource, /const intendedFor = \["Manager", "Employee", "HR", "Finance", "Sales", "Support", "Developer"\] as const/);
 assert.match(loginSource, /allowedRoles=\{intendedFor\}/);
 assert.doesNotMatch(loginSource, /"Owner"|"Administrator"/);
});

test("every visible Manager sidebar destination has an Employee app route", async () => {
 const [appSource, dashboardSource] = await Promise.all([
 source("frontend/src/App.tsx"),
 source("frontend/src/common/features/dashboard/RoleDashboardPage.tsx"),
 ]);
 const managerStart = dashboardSource.indexOf(" Manager: {");
 const employeeStart = dashboardSource.indexOf(" Employee: {");
 const managerConfig = dashboardSource.slice(managerStart, employeeStart);

 assert.ok(managerStart >= 0 && employeeStart > managerStart, "Manager dashboard config must exist");
 for (const [path, roles] of managerRoutes) {
 assert.match(managerConfig, new RegExp(`href: "${path}"`), `${path} must be visible in Manager navigation`);
 assert.match(
 appSource,
 new RegExp(`path: "${path.replace("/", "\\/")}"[^\\n]*allowedRoles: ${roles}`),
 `${path} must be registered for Manager in the Employee app`,
 );
 }

 assert.doesNotMatch(managerConfig, /Admin Panel|href: "\/admin"|href: "\/documents"|href: "\/team-accounts"/);
 assert.doesNotMatch(appSource, /path: "\/admin"/);
});

test("Employee route guards do not grant full-access bypasses", async () => {
 const [appSource, accessControlSource] = await Promise.all([
 source("frontend/src/App.tsx"),
 source("shared/src/auth/access-control.tsx"),
 ]);

 assert.match(appSource, /route\.allowFullAccessBypass = false/);
 assert.match(appSource, /AppProviders allowFullAccessBypass=\{false\}/);
 assert.match(accessControlSource, /allowedRoles\.includes\(role\)/);
 assert.match(accessControlSource, /return <Navigate replace to=\{fallbackPath\}/);
});

test("Manager projects use shared backend CRUD and live refresh", async () => {
 const [pageSource, apiSource] = await Promise.all([
 source("shared/src/projects/ProjectsPage.tsx"),
 source("shared/src/projects/projects.api.ts"),
 ]);

 for (const call of ["fetchProjectsPage", "createProject", "updateProject", "apiArchiveProject", "apiDuplicateProject"]) {
 assert.match(pageSource, new RegExp(call));
 }
 assert.match(pageSource, /window\.setInterval\(refresh, liveSyncIntervalMs\)/);
 assert.match(apiSource, /cache: "no-store"/);
 assert.match(apiSource, /"\/projects"/);
 assert.doesNotMatch(pageSource, /seedProjects|localStorage|Nexora|Priya Sharma/i);
});

test("Manager employees use live user, department, attendance, leave, and holiday APIs", async () => {
 const [pageSource, apiSource, wrapperSource] = await Promise.all([
 source("shared/src/employees/EmployeesPage.tsx"),
 source("shared/src/employees/employees.api.ts"),
 source("frontend/src/hr/features/employees/EmployeesPage.tsx"),
 ]);

 for (const call of ["fetchEmployees", "fetchDepartments", "fetchAttendanceSummary", "fetchLeaveApprovals", "fetchHolidays"]) {
 assert.match(pageSource, new RegExp(call));
 }
 for (const endpoint of [/\/users/, /\/organization\/departments/, /\/attendance\/summary/, /\/organization\/holidays/]) {
 assert.match(apiSource, endpoint);
 }
 assert.match(wrapperSource, /hasPermission\("department\.create"\)/);
 assert.doesNotMatch(pageSource, /employees\.data|seedEmployees|Priya Sharma|Nexora/i);
});

test("Manager tasks use backend records and backend employee assignees", async () => {
 const [pageSource, dataSource, apiSource] = await Promise.all([
 source("shared/src/tasks/TasksPage.tsx"),
 source("shared/src/tasks/tasks.data.ts"),
 source("shared/src/tasks/tasks.api.ts"),
 ]);

 for (const call of ["apiFetchTasks", "apiCreateTask", "apiUpdateTask", "fetchEmployeeUsers", "fetchProjects"]) {
 assert.match(pageSource, new RegExp(call));
 }
 assert.match(pageSource, /window\.setInterval\(reload, liveSyncIntervalMs\)/);
 assert.match(apiSource, /cache: "no-store"/);
 assert.doesNotMatch(dataSource, /seedTasks|teamMembers|Priya|Nexora|mock|demo/i);
 assert.doesNotMatch(pageSource, /seedTasks|Priya Sharma|localStorage|createTaskFromInput/i);
});

test("Manager workflows use authenticated backend APIs and live refresh", async () => {
 const [pageSource, apiSource, dataSource] = await Promise.all([
 source("shared/src/workflows/WorkflowsPage.tsx"),
 source("shared/src/workflows/workflows.api.ts"),
 source("shared/src/workflows/workflows.data.ts"),
 ]);

 for (const call of ["fetchWorkflows", "apiCreateWorkflow", "apiUpdateWorkflow", "apiExecuteWorkflow"]) {
 assert.match(pageSource, new RegExp(call));
 }
 assert.match(pageSource, /window\.setInterval\(refresh, liveSyncIntervalMs\)/);
 assert.match(apiSource, /Authorization: `Bearer \$\{session\.accessToken\}`/);
 assert.match(apiSource, /"\/workflows\?limit=100"/);
 assert.doesNotMatch(dataSource, /seed|mock|demo/i);
});

test("Manager meetings show an honest unavailable state", async () => {
 const meetingSource = await source("shared/src/meetings/MeetingsPage.tsx");

 assert.match(meetingSource, /Meetings are not configured/);
 assert.match(meetingSource, /No meeting data service is configured/);
 assert.doesNotMatch(meetingSource, /localStorage|seedMeetings|Create Meeting|Schedule Meeting/);
});

test("Manager analytics, messenger, notifications, and profile are API-backed", async () => {
 const [analyticsSource, analyticsApi, collaborationSource, notificationsSource, profileSource] = await Promise.all([
 source("shared/src/features/analytics/AnalyticsPage.tsx"),
 source("shared/src/features/analytics/analytics.api.ts"),
 source("shared/src/collaboration/CollaborationHub.tsx"),
 source("shared/src/notifications/NotificationCenterPage.tsx"),
 source("shared/src/profile/RoleProfilePage.tsx"),
 ]);

 assert.match(analyticsSource, /fetchOverviewAnalytics/);
 assert.match(analyticsSource, /window\.setInterval\(refreshIfActive, liveSyncIntervalMs\)/);
 assert.match(analyticsApi, /\/analytics\?section=/);
 assert.match(collaborationSource, /fetchRooms/);
 assert.match(collaborationSource, /fetchMessages/);
 assert.match(notificationsSource, /fetchNotifications/);
 assert.match(profileSource, /fetchOwnProfile/);
});

test("Manager implementation is not duplicated under Admin or Employee feature folders", async () => {
 for (const path of [
 "admin/src/manager/features/projects/ProjectsPage.tsx",
 "admin/src/manager/features/tasks/TasksPage.tsx",
 "admin/src/manager/features/workflows/WorkflowsPage.tsx",
 "admin/src/manager/features/meetings/MeetingsPage.tsx",
 "frontend/src/common/features/tasks/TasksPage.tsx",
 "frontend/src/common/features/meetings/MeetingsPage.tsx",
 "admin/src/App.tsx.broken-backup",
 ]) {
 await assert.rejects(access(path), `${path} must not remain as a duplicate production implementation`);
 }
});
