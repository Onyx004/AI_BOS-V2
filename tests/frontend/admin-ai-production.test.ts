import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("AI Assistant page, sidebar entry and floating AI button are removed from every app", async () => {
  const [appSource, workspaceSource, dashboardSource, shellSource] = await Promise.all([
    source("admin/src/App.tsx"),
    source("admin/src/data/workspace.ts"),
    source("admin/src/common/features/dashboard/AdminDashboardPage.tsx"),
    source("shared/src/platform/AppShell.tsx"),
  ]);

  assert.doesNotMatch(appSource, /ai-assistant/);
  assert.doesNotMatch(workspaceSource, /AI Assistant/);
  assert.doesNotMatch(dashboardSource, /ai-assistant/);
  assert.doesNotMatch(shellSource, /FloatingAIAssistant|@shared\/ai/);
  assert.equal(existsSync("admin/src/admin/features/ai"), false);
  assert.equal(existsSync("shared/src/ai"), false);
});
