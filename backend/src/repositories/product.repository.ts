import type { FilterQuery, UpdateQuery } from "mongoose";
import { ProductModel, type Product, type ProductDocument } from "../models/product.model.js";

export type ProductCreateData = Pick<Product, "productName" | "sku" | "category"> &
  Partial<Pick<Product, "organizationId" | "price" | "costPrice" | "stock" | "supplier" | "barcode" | "images" | "createdBy">>;

export class ProductRepository {
  async create(data: ProductCreateData) {
    return ProductModel.create(data);
  }

  async findById(id: string) {
    return ProductModel.findById(id).lean();
  }

  async list(query: { organizationId?: string; category?: string; search?: string; limit?: number }) {
    const filter: FilterQuery<Product> = {};
    if (query.organizationId) filter.organizationId = query.organizationId;
    if (query.category) filter.category = query.category;
    if (query.search) filter.$text = { $search: query.search };

    return ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .lean();
  }

  async update(id: string, updates: UpdateQuery<ProductDocument>) {
    return ProductModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }

  async delete(id: string) {
    return ProductModel.findByIdAndDelete(id).select("_id").lean();
  }
}

export const productRepository = new ProductRepository();
