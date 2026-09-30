import { z } from "zod";

export const productFormSchema = z.object({
 productName: z.string().min(1, "Product name is required"),
 sku: z.string().optional(),
 category: z.string(),
 price: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
 costPrice: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
 stock: z.number({ message: "Enter a number" }).min(0, "Must be 0 or more"),
 supplier: z.string(),
 barcode: z.string(),
 images: z.array(z.string()),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
