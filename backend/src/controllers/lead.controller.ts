import { leadService } from "../services/lead.service.js";
import { jsonController } from "../utils/controller.js";
import type { ListLeadsQuery } from "../validation/lead.validation.js";

export class LeadController {
  stats = jsonController(200, "Lead stats fetched successfully", () => leadService.stats());

  list = jsonController(200, "Leads fetched successfully", ({ req }) =>
    leadService.list(req.query as unknown as ListLeadsQuery),
  );

  create = jsonController(201, "Lead created successfully", ({ req }) =>
    leadService.create(req.body, req.user?.id),
  );

  getById = jsonController(200, "Lead fetched successfully", ({ req }) =>
    leadService.getById(req.params.id),
  );

  update = jsonController(200, "Lead updated successfully", ({ req }) =>
    leadService.update(req.params.id, req.body, req.user?.id),
  );

  convert = jsonController(200, "Lead converted to customer successfully", ({ req }) =>
    leadService.convertToCustomer(req.params.id, req.user?.id),
  );

  delete = jsonController(200, "Lead deleted successfully", ({ req }) =>
    leadService.delete(req.params.id),
  );

  assignOwner = jsonController(200, "Lead owner updated successfully", ({ req }) =>
    leadService.assignOwner(req.params.id, req.body.ownerId),
  );
}

export const leadController = new LeadController();
