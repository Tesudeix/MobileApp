import { PRODUCT_CATEGORIES } from "../constants";
import { request, ApiResult } from "./client";

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Product = {
  _id: string;
  name: string;
  price: number;
  category: ProductCategory;
  image?: string | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const normaliseCategory = (value: string): string => value.normalize("NFC").trim();

const isCategory = (value: unknown): value is ProductCategory => {
  return typeof value === "string" && PRODUCT_CATEGORIES.includes(value as ProductCategory);
};

const toProduct = (value: unknown): Product | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  const id = typeof row._id === "string" ? row._id : "";
  const name = typeof row.name === "string" ? row.name : "";
  const parsedPrice = typeof row.price === "number" ? row.price : Number(row.price || 0);

  if (!id || !name || Number.isNaN(parsedPrice)) {
    return null;
  }

  const category = isCategory(row.category) ? row.category : PRODUCT_CATEGORIES[0];

  return {
    _id: id,
    name,
    price: parsedPrice,
    category,
    image: typeof row.image === "string" ? row.image : null,
    description: typeof row.description === "string" ? row.description : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

const getProductsArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const row = payload as Record<string, unknown>;
  if (Array.isArray(row.products)) return row.products;
  if (Array.isArray(row.items)) return row.items;
  if (Array.isArray(row.data)) return row.data;

  return [];
};

export const listProducts = async (
  category?: ProductCategory
): Promise<ApiResult<Product[]>> => {
  // Fetch full list and filter client-side to avoid backend query-shape mismatch.
  const response = await request<unknown>("/api/products", {
    method: "GET",
  });

  if (!response.ok) {
    return response;
  }

  const rows = getProductsArray(response.data);
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Invalid products response", status: 500 };
  }

  const items = rows
    .map((entry) => toProduct(entry))
    .filter((entry): entry is Product => entry !== null);

  if (!category) {
    return { ok: true, data: items };
  }

  const targetCategory = normaliseCategory(category);
  const filtered = items.filter(
    (item) => normaliseCategory(item.category) === targetCategory
  );

  return { ok: true, data: filtered };
};

export const getProductById = async (
  productId: string
): Promise<ApiResult<Product>> => {
  const response = await request<{ product: unknown }>(`/api/products/${productId}`, {
    method: "GET",
  });

  if (!response.ok) {
    return response;
  }

  const product = toProduct(response.data.product);
  if (!product) {
    return { ok: false, error: "Invalid product response", status: 500 };
  }

  return { ok: true, data: product };
};

export const createProductOrder = async (
  productId: string,
  payload: { customerName: string; phone: string; quantity: number; note?: string }
): Promise<ApiResult<{ orderId: string }>> => {
  const response = await request<{ order: { _id?: unknown } }>(`/api/products/${productId}/order`, {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    return response;
  }

  const orderId = typeof response.data.order?._id === "string" ? response.data.order._id : "";
  if (!orderId) {
    return { ok: false, error: "Invalid order response", status: 500 };
  }

  return { ok: true, data: { orderId } };
};
