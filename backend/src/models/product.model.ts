import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const productStatuses = ["In Stock", "Low Stock", "Out of Stock"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export type Product = {
  organizationId?: Types.ObjectId;
  productName: string;
  sku: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  supplier?: string;
  barcode?: string;
  images: string[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductDocument = HydratedDocument<Product>;

const productSchema = new Schema<Product>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    productName: { type: String, required: true, trim: true, maxlength: 160, index: true },
    sku: { type: String, required: true, trim: true, maxlength: 60, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    price: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    supplier: { type: String, trim: true, maxlength: 160 },
    barcode: { type: String, trim: true, maxlength: 80 },
    images: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

productSchema.index({ productName: "text", sku: "text", category: "text", supplier: "text" });
productSchema.index({ organizationId: 1, category: 1, createdAt: -1 });
productSchema.index({ organizationId: 1, sku: 1 }, { unique: false });

export const ProductModel = model("Product", productSchema);
