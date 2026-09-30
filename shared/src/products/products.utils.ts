import type { Product, ProductStatus } from "./products.types";

export function formatMoney(value: number) {
 return new Intl.NumberFormat("en-US", {
 currency: "USD",
 maximumFractionDigits: 0,
 style: "currency",
 }).format(value);
}

export function generateSku(products: Product[]) {
 return `SKU-AIBOS-${String(products.length + 1).padStart(3, "0")}`;
}

export function getProductStatus(stock: number): ProductStatus {
 if (stock <= 0) {
 return "Out of Stock";
 }
 if (stock <= 10) {
 return "Low Stock";
 }
 return "In Stock";
}

export function getProductStats(products: Product[]) {
 return {
 total: products.length,
 lowStock: products.filter((product) => getProductStatus(product.stock) === "Low Stock").length,
 outOfStock: products.filter((product) => product.stock <= 0).length,
 inventoryValue: products.reduce((sum, product) => sum + product.stock * product.costPrice, 0),
 };
}

export function statusClass(status: ProductStatus) {
 const classes: Record<ProductStatus, string> = {
 "In Stock": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
 "Low Stock": "bg-amber-500/10 text-amber-600 dark:text-amber-300",
 "Out of Stock": "bg-rose-500/10 text-rose-600 dark:text-rose-300",
 };

 return classes[status];
}
