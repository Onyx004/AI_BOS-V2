import { getStoredAuthSession, isSessionExpired, refreshSession } from "@shared/auth/auth-service";
import { getApiBaseUrl } from "@shared/lib/env";
import type { Product, ProductFormInput } from "./products.types";

type ProductsResult<T> = { status: "ok"; data: T } | { status: "forbidden" } | { status: "error" };

type BackendProduct = {
  id?: string;
  _id?: string;
  productName: string;
  sku: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  supplier?: string;
  barcode?: string;
  images?: string[];
  updatedAt: string;
};

type ProductPayload = {
  productName?: string;
  sku?: string;
  category?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  supplier?: string;
  barcode?: string;
  images?: string[];
};

async function getSessionHeader(): Promise<Record<string, string>> {
  let session = getStoredAuthSession();
  if (session && isSessionExpired(session)) {
    session = await refreshSession();
  }
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function compactPayload(payload: ProductPayload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== "")) as ProductPayload;
}

function toProduct(record: BackendProduct, index: number): Product {
  const id = record.id ?? record._id ?? `product-${index}`;
  return {
    id,
    productName: record.productName,
    sku: record.sku,
    category: record.category,
    price: record.price,
    costPrice: record.costPrice,
    stock: record.stock,
    supplier: record.supplier ?? "Unassigned",
    barcode: record.barcode ?? "",
    images: record.images ?? [],
    updatedAt: record.updatedAt.slice(0, 10),
  };
}

export async function fetchProducts(limit = 100): Promise<ProductsResult<Product[]>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/products?limit=${limit}`, {
      cache: "no-store",
      headers: await getSessionHeader(),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payload = json?.data;
    const items = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(items)) return { status: "error" };

    return { status: "ok", data: items.map(toProduct) };
  } catch {
    return { status: "error" };
  }
}

async function writeProduct(path: string, method: "POST" | "PATCH", payload: ProductPayload): Promise<ProductsResult<Product>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(await getSessionHeader()),
      },
      body: JSON.stringify(compactPayload(payload)),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };

    const json = await response.json().catch(() => null);
    const payloadData = json?.data;
    if (!payloadData) return { status: "error" };
    return { status: "ok", data: toProduct(payloadData, 0) };
  } catch {
    return { status: "error" };
  }
}

export function createProduct(input: ProductFormInput): Promise<ProductsResult<Product>> {
  return writeProduct("/products", "POST", {
    productName: input.productName,
    sku: input.sku,
    category: input.category,
    price: input.price,
    costPrice: input.costPrice,
    stock: input.stock,
    supplier: input.supplier,
    barcode: input.barcode,
    images: input.images,
  });
}

export function updateProduct(id: string, input: ProductFormInput): Promise<ProductsResult<Product>> {
  return writeProduct(`/products/${id}`, "PATCH", {
    productName: input.productName,
    sku: input.sku,
    category: input.category,
    price: input.price,
    costPrice: input.costPrice,
    stock: input.stock,
    supplier: input.supplier,
    barcode: input.barcode,
    images: input.images,
  });
}

export async function deleteProduct(id: string): Promise<ProductsResult<{ deleted: true }>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/products/${id}`, {
      method: "DELETE",
      cache: "no-store",
      headers: await getSessionHeader(),
    });

    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "error" };
    return { status: "ok", data: { deleted: true } };
  } catch {
    return { status: "error" };
  }
}
