import { API_URL } from "../config";

type ApiEnvelope = {
  success: boolean;
  error?: string;
  message?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const buildHeaders = (token?: string, hasBody?: boolean) => {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const request = async <T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<ApiResult<T>> => {
  const { method = "GET", body, token } = options;
  const hasBody = body !== undefined;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: buildHeaders(token, hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: (ApiEnvelope & T) | null = null;

    if (text) {
      try {
        parsed = JSON.parse(text) as ApiEnvelope & T;
      } catch {
        return {
          ok: false,
          error: "Invalid response",
          status: response.status,
        };
      }
    }

    if (!response.ok || !parsed || parsed.success === false) {
      const errorMessage =
        parsed?.error || parsed?.message || response.statusText || "Request failed";
      return { ok: false, error: errorMessage, status: response.status };
    }

    return { ok: true, data: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: message, status: 0 };
  }
};
