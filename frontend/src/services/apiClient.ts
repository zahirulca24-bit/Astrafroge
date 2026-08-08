/**
 * Centralized backend API client.
 *
 * Responsibilities:
 *  - Resolve the backend base URL from VITE_API_BASE_URL only.
 *  - Perform fetch requests with a configurable timeout.
 *  - Parse JSON responses safely.
 *  - Produce consistent Error messages for non-OK responses.
 *  - Attach Bearer token and idempotency key headers for protected mutations.
 *
 * No local or production domains are hardcoded here. The base URL comes
 * exclusively from the VITE_API_BASE_URL environment variable.
 */

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const SCANNER_RUN_REQUEST_TIMEOUT_MS = 120000;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** When true, attaches an Idempotency-Key header (generated if not provided). */
  idempotent?: boolean;
  /** Explicit idempotency key; ignored unless `idempotent` is true. */
  idempotencyKey?: string;
  /** Optional JSON body for non-GET requests. */
  body?: unknown;
  /** Optional extra headers. */
  headers?: Record<string, string>;
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number;
  /** Optional AbortSignal from the caller; combined with the internal timeout. */
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function readNestedRecord(
  record: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }
  return null;
}

function parseBackendErrorPayload(payload: unknown): { code: string | null; message: string | null } | null {
  if (!isRecord(payload)) return null;
  const errorBlock = readNestedRecord(payload, "error") ?? payload;
  const code = readString(errorBlock, "code", "error_code");
  const message = readString(errorBlock, "message", "detail", "error_message");
  return { code, message };
}

export class ApiRequestError extends Error {
  statusCode: number;

  code: string | null;

  retryAfterSeconds: number | null;

  constructor(statusCode: number, message: string, code: string | null = null, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function buildBackendError(response: Response, path: string): Promise<{
  message: string;
  code: string | null;
  retryAfterSeconds: number | null;
}> {
  const fallback = {
    message: `Backend request failed (${response.status}) for ${path}`,
    code: null,
    retryAfterSeconds: readRetryAfterSeconds(response),
  };
  try {
    const payload = await response.json();
    const parsed = parseBackendErrorPayload(payload);
    if (!parsed) return fallback;
    return {
      message: parsed.code && parsed.message ? `${parsed.code}: ${parsed.message} (${response.status})` : fallback.message,
      code: parsed.code,
      retryAfterSeconds: fallback.retryAfterSeconds,
    };
  } catch {
    return fallback;
  }
}

function readRetryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveBaseUrl(): string {
  const configured = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL;
  if (!configured || !configured.trim()) {
    throw new Error(
      "VITE_API_BASE_URL is not configured. Set it in the environment before building or running the app.",
    );
  }
  return configured.replace(/\/$/, "");
}

let cachedBaseUrl: string | null = null;

/** @internal Reset the cached base URL — used by tests after changing env. */
export function resetBaseUrlCache(): void {
  cachedBaseUrl = null;
}

function getBaseUrl(): string {
  if (cachedBaseUrl === null) {
    cachedBaseUrl = resolveBaseUrl();
  }
  return cachedBaseUrl;
}

function withTimeout(timeoutMs: number, externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onExternalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      return {
        signal: controller.signal,
        cleanup: () => {
          externalSignal.removeEventListener("abort", onExternalAbort);
          clearTimeout(timer);
        },
      };
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Backend returned a malformed JSON response");
  }
}

export const apiClient = {
  getBaseUrl,

  async request<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      idempotent = false,
      idempotencyKey,
      body,
      headers = {},
      timeoutMs = path === "/api/v1/scanner/run-now"
        ? SCANNER_RUN_REQUEST_TIMEOUT_MS
        : DEFAULT_REQUEST_TIMEOUT_MS,
      signal: externalSignal,
    } = options;

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      ...headers,
    };

    if (idempotent) {
      requestHeaders["Idempotency-Key"] = idempotencyKey ?? generateIdempotencyKey();
    }

    const hasBody = body !== undefined && method !== "GET";
    if (hasBody) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const { signal, cleanup } = withTimeout(timeoutMs, externalSignal);

    let response: Response;
    try {
      response = await fetch(`${getBaseUrl()}${path}`, {
        method,
        headers: requestHeaders,
        body: hasBody ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal,
      });
    } catch (error) {
      cleanup();
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error(`Backend request timed out after ${timeoutMs}ms for ${path}`);
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Backend request aborted for ${path}`);
      }
      throw new Error(`Backend request failed for ${path}`);
    }
    cleanup();

    if (!response.ok) {
      const error = await buildBackendError(response, path);
      throw new ApiRequestError(response.status, error.message, error.code, error.retryAfterSeconds);
    }

    return (await parseJsonResponse(response)) as T;
  },

  async get<T = unknown>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">): Promise<T> {
    return apiClient.request<T>(path, { ...options, method: "GET" });
  },

  async post<T = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, "method">,
  ): Promise<T> {
    return apiClient.request<T>(path, { ...options, method: "POST" });
  },
};

export { isRecord };
