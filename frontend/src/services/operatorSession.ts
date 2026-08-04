import { apiClient, ApiRequestError, isRecord } from "./apiClient";

export type OperatorSessionState =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "expired"
  | "unauthorized"
  | "error";

export interface OperatorSessionStatusSnapshot {
  status: "authenticated";
  authenticated: true;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

function mapStatus(payload: unknown): OperatorSessionStatusSnapshot {
  if (!isRecord(payload)) {
    throw new Error("Invalid operator session response");
  }
  if (payload.status !== "authenticated") {
    throw new Error("Invalid operator session response");
  }
  if (
    typeof payload.issued_at !== "string" ||
    typeof payload.expires_at !== "string" ||
    typeof payload.last_seen_at !== "string"
  ) {
    throw new Error("Invalid operator session response");
  }
  return {
    status: "authenticated",
    authenticated: true,
    issuedAt: payload.issued_at,
    expiresAt: payload.expires_at,
    lastSeenAt: payload.last_seen_at,
  };
}

function toSessionState(error: unknown): OperatorSessionState {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 401) {
      if (error.code === "OPERATOR_SESSION_EXPIRED") return "expired";
      return "unauthenticated";
    }
    if (error.statusCode === 403) return "unauthorized";
    if (error.statusCode === 429) return "error";
  }
  return "error";
}

export const operatorSessionService = {
  async login(operatorToken: string): Promise<OperatorSessionStatusSnapshot> {
    const payload = await apiClient.post<unknown>("/api/v1/operator-session/login", {
      body: { operator_token: operatorToken },
    });
    return mapStatus(payload);
  },

  async status(): Promise<OperatorSessionStatusSnapshot> {
    const payload = await apiClient.get<unknown>("/api/v1/operator-session/status");
    return mapStatus(payload);
  },

  async logout(): Promise<void> {
    await apiClient.post("/api/v1/operator-session/logout");
  },

  stateFromError(error: unknown): OperatorSessionState {
    return toSessionState(error);
  },
};