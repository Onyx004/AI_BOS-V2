import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { configureBackendTestEnv } from "../helpers/backend-env.ts";

configureBackendTestEnv();

const root = path.resolve(import.meta.dirname, "../..");
const resourcePrefixes = ["customer", "company", "contact", "deal", "quote", "followup", "crm_meeting"];
const routePaths: Record<string, string> = {
  customer: "customers",
  company: "companies",
  contact: "contacts",
  deal: "deals",
  quote: "quotes",
  followup: "follow-ups",
  crm_meeting: "meetings",
};

test("CRM permission catalog has view/create/update/delete for every module and lead keys stay intact", async () => {
  const { permissionCatalog, crmPermissionKeys, salesDefaultCrmPermissionKeys } = await import("../../backend/src/constants/permissions.ts");
  const keys = permissionCatalog.map((entry) => entry.key);
  assert.equal(new Set(keys).size, keys.length, "permission keys must be unique");

  for (const prefix of resourcePrefixes) {
    for (const action of ["view", "create", "update", "delete"]) {
      const entry = permissionCatalog.find((item) => item.key === `${prefix}.${action}`);
      assert.ok(entry, `${prefix}.${action} missing from catalog`);
      assert.equal(entry.module, "CRM");
    }
  }
  for (const key of ["lead.view_all", "lead.view_stats", "lead.create", "lead.update", "lead.delete"]) {
    assert.ok(crmPermissionKeys.includes(key), `${key} should be a CRM permission`);
  }

  assert.ok(salesDefaultCrmPermissionKeys.includes("lead.view_all"));
  assert.ok(salesDefaultCrmPermissionKeys.includes("customer.create"));
  assert.ok(salesDefaultCrmPermissionKeys.includes("crm_meeting.update"));
  assert.equal(salesDefaultCrmPermissionKeys.some((key) => key.endsWith(".delete")), false, "Sales gets no deletes by default");
  assert.equal(salesDefaultCrmPermissionKeys.some((key) => key.startsWith("quote.")), false, "Sales gets no quotes by default");
});

test("every CRM route demands exactly its module permission, so a role only gets the actions it was granted", async () => {
  const { crmRoutes } = await import("../../backend/src/routes/crm.routes.ts");
  const { roleRepository } = await import("../../backend/src/repositories/role.repository.ts");
  const { crmPermissionKeys } = await import("../../backend/src/constants/permissions.ts");
  const originalFind = roleRepository.findBySlug;

  type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...args: any[]) => any }[] } };
  const layers = (crmRoutes as unknown as { stack: Layer[] }).stack.filter((layer) => layer.route);

  async function run(layer: Required<Layer>, permissionKeys: string[]) {
    roleRepository.findBySlug = (async () => ({ isActive: true, hasFullAccess: false, permissionKeys })) as any;
    let outcome: unknown = "pending";
    // stack[0] is the master-control switch, stack[1] the permission check.
    await layer.route.stack[1].handle({ user: { id: "u1", role: "Custom" } }, {}, (error?: unknown) => {
      outcome = error ?? "allowed";
    });
    return outcome;
  }

  const expected: [string, string, string][] = [];
  for (const prefix of resourcePrefixes) {
    const base = `/${routePaths[prefix]}`;
    expected.push(["get", base, `${prefix}.view`], ["get", `${base}/:id`, `${prefix}.view`]);
    expected.push(["post", base, `${prefix}.create`], ["patch", `${base}/:id`, `${prefix}.update`], ["delete", `${base}/:id`, `${prefix}.delete`]);
  }

  try {
    for (const [method, routePath, key] of expected) {
      const layer = layers.find((item) => item.route!.path === routePath && item.route!.methods[method]);
      assert.ok(layer, `${method.toUpperCase()} ${routePath} is not registered`);

      assert.equal(await run(layer as Required<Layer>, [key]), "allowed", `${key} should open ${method.toUpperCase()} ${routePath}`);
      const others = crmPermissionKeys.filter((item) => item !== key);
      const denied = (await run(layer as Required<Layer>, others)) as { statusCode?: number };
      assert.equal(denied.statusCode, 403, `${method.toUpperCase()} ${routePath} must reject roles without ${key}`);
    }

    const convert = ((await import("../../backend/src/routes/lead.routes.ts")).leadRoutes as unknown as { stack: Layer[] }).stack.find(
      (layer) => layer.route?.path === "/:id/convert" && layer.route.methods.post,
    );
    assert.ok(convert?.route, "POST /leads/:id/convert is not registered");
    const callStep = async (step: number, permissionKeys: string[]) => {
      roleRepository.findBySlug = (async () => ({ isActive: true, hasFullAccess: false, permissionKeys })) as any;
      let outcome: unknown = "pending";
      await convert!.route!.stack[step].handle({ user: { id: "u1", role: "Custom" } }, {}, (error?: unknown) => {
        outcome = error ?? "allowed";
      });
      return outcome;
    };
    assert.equal(await callStep(1, ["lead.update"]), "allowed");
    assert.equal(await callStep(2, ["customer.create"]), "allowed");
    assert.equal(((await callStep(2, ["lead.update"])) as { statusCode?: number }).statusCode, 403, "convert also needs customer.create");
    assert.equal(((await callStep(1, ["customer.create"])) as { statusCode?: number }).statusCode, 403, "convert also needs lead.update");
  } finally {
    roleRepository.findBySlug = originalFind;
  }
});

test("lead stage changes and conversion are logged as activities, and conversion creates one customer", async () => {
  const { leadService } = await import("../../backend/src/services/lead.service.ts");
  const { leadRepository } = await import("../../backend/src/repositories/lead.repository.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");
  const { CustomerModel } = await import("../../backend/src/models/crm.model.ts");
  const originals = {
    findById: leadRepository.findById,
    update: leadRepository.update,
    findUser: userRepository.findById,
    findCustomer: CustomerModel.findOne,
    createCustomer: CustomerModel.create,
  };
  const updates: Record<string, any>[] = [];
  const createdCustomers: Record<string, any>[] = [];
  let existingCustomer: Record<string, unknown> | null = null;
  leadRepository.findById = (async () => ({ _id: "l1", name: "Priya", status: "Qualified", value: 5000, currency: "USD", ownerId: { _id: "owner1" } })) as any;
  leadRepository.update = (async (_id: string, update: Record<string, any>) => {
    updates.push(update);
    return { _id: "l1", ...update };
  }) as any;
  userRepository.findById = (async () => ({ organizationId: "org1" })) as any;
  CustomerModel.findOne = (() => ({ lean: async () => existingCustomer })) as any;
  CustomerModel.create = (async (data: Record<string, any>) => {
    createdCustomers.push(data);
    return { _id: "c1", ...data };
  }) as any;

  try {
    await leadService.update("l1", { status: "Proposal" } as any, "u1");
    assert.equal(updates[0].$push.activities.$each[0].title, "Stage changed");
    assert.equal(updates[0].$push.activities.$each[0].detail, "Qualified → Proposal");

    await leadService.update("l1", { name: "Priya S" } as any, "u1");
    assert.equal(updates[1].$push, undefined, "no activity when the stage did not change");

    const converted = await leadService.convertToCustomer("l1", "u1");
    assert.equal(converted.customerId, "c1");
    assert.equal(createdCustomers.length, 1);
    assert.equal(createdCustomers[0].revenue, 5000);
    assert.equal(createdCustomers[0].currency, "USD", "the customer keeps the lead currency");
    assert.equal(createdCustomers[0].ownerId, "owner1");
    assert.equal(updates[2].status, "Won");

    existingCustomer = { _id: "c9" };
    const again = await leadService.convertToCustomer("l1", "u1");
    assert.equal(again.customerId, "c9", "converting twice reuses the existing customer");
    assert.equal(createdCustomers.length, 1);
  } finally {
    leadRepository.findById = originals.findById;
    leadRepository.update = originals.update;
    userRepository.findById = originals.findUser;
    CustomerModel.findOne = originals.findCustomer;
    CustomerModel.create = originals.createCustomer;
  }
});

test("employee app opens CRM for any role granted a CRM view permission, not just Sales", async () => {
  const { permissionCatalog } = await import("../../backend/src/constants/permissions.ts");
  const { crmViewPermissions } = await import("../../shared/src/crm/permissions.ts");
  for (const key of crmViewPermissions) {
    assert.ok(permissionCatalog.some((entry) => entry.key === key), `${key} must exist in the backend catalog`);
  }

  const app = fs.readFileSync(path.join(root, "frontend/src/App.tsx"), "utf8");
  assert.match(app, /path: "\/crm"[^\n]*allowedPermissions: crmViewPermissions/);
  const workspace = fs.readFileSync(path.join(root, "frontend/src/data/workspace.ts"), "utf8");
  assert.match(workspace, /nav-crm[^\n]*permissions: crmViewPermissions/);

  const page = fs.readFileSync(path.join(root, "shared/src/crm/CrmPage.tsx"), "utf8");
  for (const permission of ["lead.view_all", "customer.view", "company.view", "contact.view", "deal.view", "quote.view", "followup.view", "crm_meeting.view"]) {
    assert.match(page, new RegExp(`viewPermission: "${permission}"`));
  }
  assert.match(page, /hasPermission\(`\$\{config\.permissionPrefix\}\.create`\)/);
  assert.match(page, /hasPermission\(`\$\{config\.permissionPrefix\}\.update`\)/);
  assert.match(page, /hasPermission\(`\$\{config\.permissionPrefix\}\.delete`\)/);
  assert.doesNotMatch(page, /seedLeads|salespeople|\bDataGrid\b/, "no dummy CRM data left in the page");
});

test("CRM amounts are multi-currency: unsupported codes are rejected and records default to the organization currency", async () => {
  const { customerCreateSchema, dealCreateSchema, quoteCreateSchema, companyCreateSchema } = await import("../../backend/src/validation/crm.validation.ts");
  const { createLeadSchema } = await import("../../backend/src/validation/lead.validation.ts");
  const { supportedCurrencies } = await import("../../backend/src/constants/currencies.ts");
  const { CrmResourceService } = await import("../../backend/src/services/crm-resource.service.ts");
  const { organizationRepository } = await import("../../backend/src/repositories/organization.repository.ts");
  const { organizationSettingsRepository } = await import("../../backend/src/repositories/organization-settings.repository.ts");
  const { userRepository } = await import("../../backend/src/repositories/user.repository.ts");

  assert.ok(supportedCurrencies.includes("INR") && supportedCurrencies.includes("USD") && supportedCurrencies.includes("EUR"));
  assert.equal(customerCreateSchema.parse({ name: "Acme", currency: "usd" }).currency, "USD", "codes are normalised to upper case");
  for (const schema of [customerCreateSchema, companyCreateSchema, dealCreateSchema, createLeadSchema]) {
    assert.equal(schema.safeParse({ name: "X", currency: "XXX" }).success, false, "unsupported currency is rejected");
  }
  assert.equal(quoteCreateSchema.safeParse({ customer: "Acme", currency: "ABC" }).success, false);
  assert.equal(customerCreateSchema.parse({ name: "Acme" }).currency, undefined, "currency is filled in by the server, not the schema");

  const originals = {
    org: organizationRepository.getOrCreateDefault,
    settings: organizationSettingsRepository.getOrCreateDefault,
    user: userRepository.findById,
  };
  organizationRepository.getOrCreateDefault = (async () => ({ _id: "org1" })) as any;
  organizationSettingsRepository.getOrCreateDefault = (async () => ({ currency: "aed" })) as any;
  userRepository.findById = (async () => ({ organizationId: "org1" })) as any;
  const created: Record<string, any>[] = [];
  const model = {
    create: async (data: Record<string, any>) => {
      created.push(data);
      return { _id: { toString: () => "r1" } };
    },
    findById: () => ({ populate: () => ({ lean: async () => ({ _id: "r1" }) }) }),
  };

  try {
    const withMoney = new CrmResourceService({ label: "Deal", model: model as any, searchFields: ["name"], hasMoney: true });
    await withMoney.create({ name: "No currency chosen" }, "u1");
    assert.equal(created[0].currency, "AED", "falls back to the organization currency");
    await withMoney.create({ name: "Explicit", currency: "EUR" }, "u1");
    assert.equal(created[1].currency, "EUR", "an explicit currency wins");

    const noMoney = new CrmResourceService({ label: "Contact", model: model as any, searchFields: ["name"] });
    await noMoney.create({ name: "Person" }, "u1");
    assert.equal(created[2].currency, undefined, "records without amounts get no currency");
  } finally {
    organizationRepository.getOrCreateDefault = originals.org;
    organizationSettingsRepository.getOrCreateDefault = originals.settings;
    userRepository.findById = originals.user;
  }
});

test("CRM UI never adds amounts across currencies and lets each amount pick its currency", async () => {
  const utils = fs.readFileSync(path.join(root, "shared/src/crm/crm.utils.ts"), "utf8");
  assert.match(utils, /never added together/);
  const data = fs.readFileSync(path.join(root, "shared/src/crm/crm.data.ts"), "utf8");
  const currencyFields = data.match(/type: "currency"/g) ?? [];
  assert.equal(currencyFields.length, 5, "customers, companies, deals, opportunities and quotes each expose a currency field");
  const page = fs.readFileSync(path.join(root, "shared/src/crm/CrmPage.tsx"), "utf8");
  assert.match(page, /formatMoneyTotals\(stats\.revenue\)/);
  assert.match(page, /register\("currency"\)/);
});
