import { Router, type RequestHandler } from "express";
import type { ZodType } from "zod";
import { route } from "../middleware/async-handler.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { CompanyModel, ContactModel, CrmMeetingModel, CustomerModel, DealModel, FollowUpModel, QuoteModel } from "../models/crm.model.js";
import { crmPermissionKeys } from "../constants/permissions.js";
import { CrmResourceService, listCrmOwners } from "../services/crm-resource.service.js";
import { getCrmSettings } from "../services/crm-settings.service.js";
import { jsonController } from "../utils/controller.js";
import {
  companyCreateSchema,
  contactCreateSchema,
  crmIdParamsSchema,
  crmListQuerySchema,
  crmMeetingCreateSchema,
  customerCreateSchema,
  dealCreateSchema,
  followUpCreateSchema,
  quoteCreateSchema,
  type CrmListQuery,
} from "../validation/crm.validation.js";

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const count = await QuoteModel.countDocuments({ quoteNo: new RegExp(`^QT-${year}-`) });
  return `QT-${year}-${String(count + 1).padStart(3, "0")}`;
}

type Resource = {
  path: string;
  /** Permission prefix: `<prefix>.view | create | update | delete`. */
  prefix: string;
  createSchema: ZodType;
  service: CrmResourceService;
};

const resources: Resource[] = [
  {
    path: "customers",
    prefix: "customer",
    createSchema: customerCreateSchema,
    service: new CrmResourceService({ label: "Customer", hasMoney: true, model: CustomerModel, searchFields: ["name", "company", "email"] }),
  },
  {
    path: "companies",
    prefix: "company",
    createSchema: companyCreateSchema,
    service: new CrmResourceService({ label: "Company", hasMoney: true, model: CompanyModel, searchFields: ["name", "industry"] }),
  },
  {
    path: "contacts",
    prefix: "contact",
    createSchema: contactCreateSchema,
    service: new CrmResourceService({ label: "Contact", model: ContactModel, searchFields: ["name", "company", "email", "role"] }),
  },
  {
    path: "deals",
    prefix: "deal",
    createSchema: dealCreateSchema,
    service: new CrmResourceService({
      label: "Deal",
      hasMoney: true,
      model: DealModel,
      searchFields: ["name", "company"],
      filterFields: ["kind", "stage"],
    }),
  },
  {
    path: "quotes",
    prefix: "quote",
    createSchema: quoteCreateSchema,
    service: new CrmResourceService({
      label: "Quote",
      hasMoney: true,
      model: QuoteModel,
      searchFields: ["quoteNo", "customer"],
      filterFields: ["status"],
      prepareCreate: async (data) => ({ ...data, quoteNo: await nextQuoteNumber() }),
    }),
  },
  {
    path: "follow-ups",
    prefix: "followup",
    createSchema: followUpCreateSchema,
    service: new CrmResourceService({ label: "Follow-up", model: FollowUpModel, searchFields: ["leadName", "channel"], filterFields: ["status"] }),
  },
  {
    path: "meetings",
    prefix: "crm_meeting",
    createSchema: crmMeetingCreateSchema,
    service: new CrmResourceService({ label: "Meeting", model: CrmMeetingModel, searchFields: ["title", "account"] }),
  },
];

export const crmRoutes = Router();

crmRoutes.use(authenticate);

crmRoutes.get(
  "/owners",
  ...route(
    requirePermission(...crmPermissionKeys),
    jsonController(200, "CRM owners fetched successfully", () => listCrmOwners()),
  ),
);

crmRoutes.get(
  "/settings",
  ...route(
    requirePermission(...crmPermissionKeys),
    jsonController(200, "CRM settings fetched successfully", () => getCrmSettings()),
  ),
);

for (const resource of resources) {
  const { path, prefix, createSchema, service } = resource;
  const label = `${prefix.replace("_", " ")}`;
  const updateSchema = (createSchema as unknown as { partial: () => ZodType }).partial();

  const list: RequestHandler = jsonController(200, `${label} list fetched successfully`, ({ req }) =>
    service.list(req.query as unknown as CrmListQuery),
  );
  const getById: RequestHandler = jsonController(200, `${label} fetched successfully`, ({ req }) => service.getById(req.params.id));
  const create: RequestHandler = jsonController(201, `${label} created successfully`, ({ req }) => service.create(req.body, req.user?.id));
  const update: RequestHandler = jsonController(200, `${label} updated successfully`, ({ req }) => service.update(req.params.id, req.body));
  const remove: RequestHandler = jsonController(200, `${label} deleted successfully`, ({ req }) => service.delete(req.params.id));

  crmRoutes.get(`/${path}`, ...route(requirePermission(`${prefix}.view`), validate({ query: crmListQuerySchema }), list));
  crmRoutes.get(`/${path}/:id`, ...route(requirePermission(`${prefix}.view`), validate({ params: crmIdParamsSchema }), getById));
  crmRoutes.post(`/${path}`, ...route(requirePermission(`${prefix}.create`), validate({ body: createSchema }), create));
  crmRoutes.patch(
    `/${path}/:id`,
    ...route(requirePermission(`${prefix}.update`), validate({ params: crmIdParamsSchema, body: updateSchema }), update),
  );
  crmRoutes.delete(`/${path}/:id`, ...route(requirePermission(`${prefix}.delete`), validate({ params: crmIdParamsSchema }), remove));
}
