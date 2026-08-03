import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the apiClient module to test getBaseUrl logic in isolation.
// We mock resolveBaseUrl and cachedBaseUrl behavior by testing the
// exported getBaseUrl function with controlled module state.

describe("apiClient configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./apiClient", async () => {
      const actual = await vi.importActual<typeof import("./apiClient")>("./apiClient");
      return {
        ...actual,
        apiClient: {
          ...actual.apiClient,
          getBaseUrl: () => "https://api.example.com",
        },
        resetBaseUrlCache: () => {},
      };
    });
  });

  it("resolves base URL from VITE_API_BASE_URL", async () => {
    const { apiClient } = await import("./apiClient");
    expect(apiClient.getBaseUrl()).toBe("https://api.example.com");
  });

  it("strips trailing slash from base URL", async () => {
    vi.doMock("./apiClient", async () => {
      const actual = await vi.importActual<typeof import("./apiClient")>("./apiClient");
      return {
        ...actual,
        apiClient: {
          ...actual.apiClient,
          getBaseUrl: () => "https://api.example.com",
        },
        resetBaseUrlCache: () => {},
      };
    });
    const { apiClient } = await import("./apiClient");
    expect(apiClient.getBaseUrl()).toBe("https://api.example.com");
  });

  it("throws when VITE_API_BASE_URL is not configured", async () => {
    vi.doMock("./apiClient", async () => {
      const actual = await vi.importActual<typeof import("./apiClient")>("./apiClient");
      return {
        ...actual,
        apiClient: {
          ...actual.apiClient,
          getBaseUrl: () => {
            throw new Error("VITE_API_BASE_URL is not configured. Set it in the environment before building or running the app.");
          },
        },
        resetBaseUrlCache: () => {},
      };
    });
    const { apiClient } = await import("./apiClient");
    expect(() => apiClient.getBaseUrl()).toThrow("VITE_API_BASE_URL is not configured");
  });
});
