export type ProductStatus = "In Stock" | "Low Stock" | "Out of Stock";

export type Product = {
 id: string;
 productName: string;
 sku: string;
 category: string;
 price: number;
 costPrice: number;
 stock: number;
 supplier: string;
 barcode: string;
 images: string[];
 updatedAt: string;
};

export type ProductFormInput = Omit<Product, "id" | "sku" | "updatedAt"> & {
 sku?: string;
};
