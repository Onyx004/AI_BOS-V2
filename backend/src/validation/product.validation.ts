import { z } from "zod";

export const createProductSchema = z.object({
  productName: z.string().min(1).max(160),
  sku: z.string().min(1).max(60),
  category: z.string().min(1).max(80),
  price: z.number().min(0).default(0),
  costPrice: z.number().min(0).default(0),
  stock: z.number().min(0).default(0),
  supplier: z.string().max(160).optional(),
  barcode: z.string().max(80).optional(),
  images: z.array(z.string()).optional(),
});

export const updateProductSchema = z.object({
  productName: z.string().min(1).max(160).optional(),
  sku: z.string().min(1).max(60).optional(),
  category: z.string().min(1).max(80).optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().min(0).optional(),
  supplier: z.string().max(160).optional(),
  barcode: z.string().max(80).optional(),
  images: z.array(z.string()).optional(),
});

export const productIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
