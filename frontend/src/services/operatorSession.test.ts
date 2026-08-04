import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("./apiClient", async () => {
  const actual = await vi.importActual<typeof import("./apiClient")>("./apiClient");
  return {
    ...actual,
    apiClient: apiClientMock,
  };
});

const okJson = {
  status: "authenticated",
  authenticated: true,
  issued_at: "2026-08-04T00:00:00Z",
  expires_at: "2026-08-04T12:00:00Z",
  last_seen_at: "2026-08-04T00:00:00Z",
};

describe("operatorSessionService", () => {
  beforeEach(() => {
    apiClientMock.post.mockReset();
    apiClientMock.get.mockReset();
  });

  it("logs in with the operator token and returns session metadata", async () => {
    const { operatorSessionService } = await import("./operatorSession");
    apiClientMock.post.mockResolvedValueOnce(okJson);

    const session = await operatorSessionService.login("operator-secret-token");

    expect(session.status).toBe("authenticated");
    expect(apiClientMock.post).toHaveBeenCalledWith("/api/v1/operator-session/login", {
      body: { operator_token: "operator-secret-token" },
    });
  });

  it("maps expired session errors to the expired state", async () => {
    const { ApiRequestError } = await import("./apiClient");
    const { operatorSessionService } = await import("./operatorSession");

    apiClientMock.get.mockRejectedValueOnce(new ApiRequestError(401, "expired", "OPERATOR_SESSION_EXPIRED"));

    await expect(operatorSessionService.status()).rejects.toBeInstanceOf(ApiRequestError);
    const state = operatorSessionService.stateFromError(new ApiRequestError(401, "expired", "OPERATOR_SESSION_EXPIRED"));
    expect(state).toBe("expired");
  });

  it("maps invalid credentials and rate limits to the unauthenticated or error states", async () => {
    const { ApiRequestError } = await import("./apiClient");
    const { operatorSessionService } = await import("./operatorSession");

    expect(operatorSessionService.stateFromError(new ApiRequestError(401, "invalid", "INVALID_OPERATOR_CREDENTIALS"))).toBe("unauthenticated");
    expect(operatorSessionService.stateFromError(new ApiRequestError(429, "limited", "OPERATOR_LOGIN_RATE_LIMITED"))).toBe("error");
  });
});
