import { ApiResult, request } from "./client";

export type Order = {
  _id: string;
  trackingNumber: string;
  status: string;
  note: string | null;
  price: number;
  weightKg: number;
  createdAt: string | null;
};

const toOrder = (value: unknown): Order | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  const id = typeof row._id === "string" ? row._id : "";
  const trackingNumber =
    typeof row.trackingNumber === "string" ? row.trackingNumber : "";
  const status = typeof row.status === "string" ? row.status : "CREATED";

  if (!id || !trackingNumber) {
    return null;
  }

  return {
    _id: id,
    trackingNumber,
    status,
    note: typeof row.note === "string" ? row.note : null,
    price: typeof row.price === "number" ? row.price : Number(row.price || 0),
    weightKg:
      typeof row.weightKg === "number" ? row.weightKg : Number(row.weightKg || 0),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
  };
};

export const listOrders = async (token: string): Promise<ApiResult<Order[]>> => {
  const response = await request<{ orders: unknown[] }>("/api/orders", {
    method: "GET",
    token,
  });

  if (!response.ok) {
    return response;
  }

  if (!Array.isArray(response.data.orders)) {
    return { ok: false, error: "Invalid orders response", status: 500 };
  }

  const items = response.data.orders
    .map((entry) => toOrder(entry))
    .filter((entry): entry is Order => entry !== null);

  return { ok: true, data: items };
};

export const createOrder = async (
  token: string,
  payload: { trackingNumber: string; note?: string }
): Promise<ApiResult<Order>> => {
  const response = await request<{ order: unknown }>("/api/orders", {
    method: "POST",
    token,
    body: payload,
  });

  if (!response.ok) {
    return response;
  }

  const created = toOrder(response.data.order);
  if (!created) {
    return { ok: false, error: "Invalid create order response", status: 500 };
  }

  return { ok: true, data: created };
};
