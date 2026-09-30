import { z } from "zod";

export const invoiceFormSchema = z.object({
 customer: z.string().min(1, "Customer is required"),
 email: z.string().min(1, "Email is required").email("Enter a valid email"),
 issueDate: z.string(),
 dueDate: z.string(),
 itemDescription: z.string().min(1, "Line item is required"),
 quantity: z.number({ message: "Enter a number" }).min(1, "Must be at least 1"),
 rate: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
 taxRate: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
