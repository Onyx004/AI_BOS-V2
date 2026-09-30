import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

test("Employee enrollment is explicit, five-sample, and descriptor-only", () => {
  const page = fs.readFileSync(path.join(root, "shared/src/face-enrollment/FaceEnrollmentPage.tsx"), "utf8");
  const api = fs.readFileSync(path.join(root, "shared/src/face-enrollment/face-enrollment.api.ts"), "utf8");
  assert.match(page, /consentAccepted/);
  assert.match(page, /samples\.length !== 5/);
  assert.match(page, /Start enrollment/);
  assert.doesNotMatch(api, /data:image|faceImage|localStorage|sessionStorage/);
  assert.match(api, /embedding/);
});

test("Employees cannot see attendance records or leave: the drawer is gone and read endpoints are removed", () => {
  const api = fs.readFileSync(path.join(root, "shared/src/attendance/attendance.api.ts"), "utf8");
  const routes = fs.readFileSync(path.join(root, "backend/src/routes/attendance.routes.ts"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "shared/src/attendance/AttendanceDrawer.tsx")), false);
  assert.doesNotMatch(api, /me\/today|me\/history|manual\/check|daily-task\/check/);
  assert.doesNotMatch(routes, /\/me\/(today|history)|\/manual\/|\/daily-task\//);
  assert.match(routes, /admin\/overview", requireRole\("Owner", "Administrator"\)/);
  assert.match(api, /attendance\/heartbeat/);
  assert.doesNotMatch(api, /faceImage|data:image/);
});

test("Admin attendance route and navigation remain Owner and Administrator only", () => {
  const app = fs.readFileSync(path.join(root, "admin/src/App.tsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "admin/src/common/features/dashboard/AdminDashboardPage.tsx"), "utf8");
  assert.match(app, /path: "\/attendance"[^\n]+allowedRoles: adminRoles/);
  assert.match(app, /const adminRoles = \["Administrator", "Owner"\]/);
  assert.doesNotMatch(app, /adminRoles[^\n]+Manager/);
  assert.match(dashboard, /Attendance[^\n]+\/attendance/);
});
