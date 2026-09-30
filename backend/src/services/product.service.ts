import type { Types } from "mongoose";
import { productRepository } from "../repositories/product.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import type { ListProductsQuery, UpdateProductInput } from "../validation/product.validation.js";

export type CreateProductInput = {
  productName: string;
  sku: string;
  category: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  supplier?: string;
  barcode?: string;
  images?: string[];
};

export class ProductService {
  async create(input: CreateProductInput, userId?: string) {
    const actor = userId ? await userRepository.findById(userId) : null;

    return productRepository.create({
      productName: input.productName,
      sku: input.sku,
      category: input.category,
      price: input.price ?? 0,
      costPrice: input.costPrice ?? 0,
      stock: input.stock ?? 0,
      supplier: input.supplier,
      barcode: input.barcode,
      images: input.images ?? [],
      organizationId: actor?.organizationId,
      createdBy: userId as unknown as Types.ObjectId,
    });
  }

  async list(query: ListProductsQuery) {
    return productRepository.list(query);
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    return product;
  }

  async update(id: string, input: UpdateProductInput) {
    const product = await productRepository.update(id, input);
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    return product;
  }

  async delete(id: string) {
    const product = await productRepository.delete(id);
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    return { deleted: true };
  }
}

export const productService = new ProductService();
