/** Any of these opens CRM for a role (the CRM page itself then shows only the modules the role may view). */
export const crmViewPermissions = [
  "lead.view_all",
  "customer.view",
  "company.view",
  "contact.view",
  "deal.view",
  "quote.view",
  "followup.view",
  "crm_meeting.view",
] as const;
