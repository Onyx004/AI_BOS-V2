import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRbacSources() {
  const root = process.cwd();
  const [page, api] = await Promise.all([
    readFile(path.join(root, "admin/src/admin/features/rbac/RBACPage.tsx"), "utf8"),
    readFile(path.join(root, "admin/src/admin/features/rbac/rbac.api.ts"), "utf8"),
  ]);
  return { page, api };
}

test("role template edit action preloads fields and updates the same template", async () => {
  const { page, api } = await readRbacSources();

  assert.match(
    api,
    /updateRoleTemplate[\s\S]*?`\/rbac\/role-templates\/\$\{id\}`[\s\S]*?method: "PATCH"/,
  );
  assert.match(page, /<Button onClick=\{\(\) => startEditTemplate\(template\)\}[\s\S]*?>[\s\S]*?Edit/);
  assert.match(
    page,
    /setTemplateForm\(\{[\s\S]*?name: template\.name,[\s\S]*?description: template\.description \?\? "",[\s\S]*?permissionKeys: template\.permissionKeys\.filter/,
  );
  assert.match(page, /checked=\{templateForm\.permissionKeys\.includes\(entry\.key\)\}/);
  assert.match(page, /await updateRoleTemplate\(editingTemplateId, templateForm, token\)/);
  assert.match(
    page,
    /current\.map\(\(template\) => \(template\._id === updated\._id \? updated : template\)\)/,
  );
  assert.match(page, /editingTemplateId \? "Save Changes" : "Create Template"/);
});

test("custom role create applies a template to an adjustable permission matrix", async () => {
  const { page } = await readRbacSources();

  assert.match(page, /onChange=\{\(event\) => applyTemplateToRoleForm\(event\.target\.value\)\}/);
  assert.match(
    page,
    /setRoleForm\(\(current\) => \(\{[\s\S]*?templateId,[\s\S]*?permissionKeys: template\.permissionKeys\.filter/,
  );
  assert.match(page, /checked=\{roleForm\.permissionKeys\.includes\(entry\.key\)\}/);
  assert.match(page, /onChange=\{\(\) => toggleRoleFormPermission\(entry\.key\)\}/);
  assert.match(page, /createRole\(roleForm, token\)/);
});

test("custom role edit applies a template locally and saves only the adjusted role permissions", async () => {
  const { page } = await readRbacSources();
  const applyTemplateToMatrix = page.slice(
    page.indexOf("const applyTemplateToMatrix"),
    page.indexOf("const saveMatrix"),
  );

  assert.match(page, /!selectedRole\.isSystem/);
  assert.match(page, /onChange=\{\(event\) => applyTemplateToMatrix\(event\.target\.value\)\}/);
  assert.match(
    page,
    /setMatrixPermissionKeys\(\[\.\.\.new Set\(\[\.\.\.lockedKeys, \.\.\.template\.permissionKeys\.filter\(\(key\) => catalogKeys\.has\(key\)\)\]\)\]\)/,
  );
  assert.match(page, /onChange=\{\(\) => toggleMatrixPermission\(entry\.key\)\}/);
  assert.match(
    page,
    /updateRole\(selectedRole\._id, \{ permissionKeys: matrixPermissionKeys \}, token\)/,
  );
  assert.doesNotMatch(applyTemplateToMatrix, /updateRoleTemplate\(/);
});

test("full-access system role controls remain disabled", async () => {
  const { page } = await readRbacSources();

  assert.match(page, /checked=\{selectedRole\.hasFullAccess \|\| lockedKeys\.has\(entry\.key\) \|\| matrixPermissionKeys\.includes\(entry\.key\)\}/);
  assert.match(page, /disabled=\{selectedRole\.hasFullAccess \|\| lockedKeys\.has\(entry\.key\)\}/);
  assert.match(page, /\{!selectedRole\.hasFullAccess && \([\s\S]*?Save Permissions/);
});
