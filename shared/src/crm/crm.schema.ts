import { z } from "zod";

const crmAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.string(),
});

export const leadFormSchema = z.object({
  name: z.string().min(1, "Lead name is required"),
  company: z.string().min(1, "Company is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string(),
  source: z.string(),
  stage: z.enum(["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]),
  value: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
  currency: z.string(),
  ownerId: z.string(),
  nextFollowUp: z.string(),
  notes: z.array(z.string()),
  attachments: z.array(crmAttachmentSchema),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
