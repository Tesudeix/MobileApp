import { API_FALLBACK_URLS, API_URL } from "../config";

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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const REQUEST_TIMEOUT_MS = 10000;

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  if (typeof AbortController === "undefined") {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildRequestUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;

  // If base already includes `/api`, avoid generating `/api/api/...`.
  if (base.endsWith("/api") && endpoint.startsWith("/api/")) {
    return `${base}${endpoint.slice(4)}`;
  }

  return `${base}${endpoint}`;
};

const shouldRetryRequest = (
  status: number,
  parsed: (ApiEnvelope & Record<string, unknown>) | null,
  errorMessage: string
) => {
  if (status === 503) {
    const apiError =
      typeof parsed?.error === "string" ? parsed.error : errorMessage;
    if (apiError.toLowerCase().includes("mongodb not connected")) {
      return true;
    }
  }
  return false;
};

export const request = async <T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<ApiResult<T>> => {
  const { method = "GET", body, token } = options;
  const hasBody = body !== undefined;
  const candidateBases = [API_URL, ...API_FALLBACK_URLS];
  const maxAttempts = 3;
  let lastError: ApiResult<T> = { ok: false, error: "Request failed", status: 0 };

  for (const baseUrl of candidateBases) {
    if (!isValidHttpUrl(baseUrl)) {
      lastError = { ok: false, error: `Invalid API base URL (${baseUrl})`, status: 0 };
      continue;
    }

    const url = buildRequestUrl(baseUrl, path);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, {
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
            lastError = {
              ok: false,
              error: `Invalid response (${url})`,
              status: response.status,
            };
            if (attempt < maxAttempts) {
              await sleep(500 * attempt);
              continue;
            }
            break;
          }
        }

        if (!response.ok || !parsed || parsed.success === false) {
          const errorMessage =
            parsed?.error || parsed?.message || response.statusText || "Request failed";
          const retryable = shouldRetryRequest(
            response.status,
            parsed as (ApiEnvelope & Record<string, unknown>) | null,
            errorMessage
          );
          const shouldTryNextBase = [502, 503, 504].includes(response.status);

          lastError = { ok: false, error: errorMessage, status: response.status };

          if ((retryable || shouldTryNextBase) && attempt < maxAttempts) {
            await sleep(500 * attempt);
            continue;
          }

          if (shouldTryNextBase) {
            break;
          }

          return lastError;
        }

        return { ok: true, data: parsed };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        const resolvedError = err instanceof Error && err.name === "AbortError"
          ? "Request timed out"
          : message;
        lastError = { ok: false, error: `${resolvedError} (${url})`, status: 0 };

        if (attempt < maxAttempts) {
          await sleep(500 * attempt);
          continue;
        }

        break;
      }
    }
  }

  return lastError;
};
