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

function openAccessSnapshot(): OperatorSessionStatusSnapshot {
  const now = new Date();
  return {
    status: "authenticated",
    authenticated: true,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeenAt: now.toISOString(),
  };
}

export const operatorSessionService = {
  async login(_operatorToken: string): Promise<OperatorSessionStatusSnapshot> {
    return openAccessSnapshot();
  },

  async status(): Promise<OperatorSessionStatusSnapshot> {
    return openAccessSnapshot();
  },

  async logout(): Promise<void> {
    return;
  },

  stateFromError(_error: unknown): OperatorSessionState {
    return "authenticated";
  },
};
