import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("authToken", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    const { authToken } = await import("./authToken");
    authToken.set(null);
  });

  it("returns null when no token is set", async () => {
    const { authToken } = await import("./authToken");
    expect(authToken.get()).toBeNull();
    expect(authToken.isAvailable()).toBe(false);
  });

  it("stores and returns a runtime token", async () => {
    const { authToken } = await import("./authToken");
    authToken.set("test-token-123");
    expect(authToken.get()).toBe("test-token-123");
    expect(authToken.isAvailable()).toBe(true);
  });

  it("trims whitespace from token", async () => {
    const { authToken } = await import("./authToken");
    authToken.set("  spaced-token  ");
    expect(authToken.get()).toBe("spaced-token");
  });

  it("clears token when set to null", async () => {
    const { authToken } = await import("./authToken");
    authToken.set("temp-token");
    authToken.set(null);
    expect(authToken.get()).toBeNull();
    expect(authToken.isAvailable()).toBe(false);
  });

  it("throws a clear error from require() when no token is set", async () => {
    const { authToken } = await import("./authToken");
    expect(() => authToken.require()).toThrow("No authenticated session is available");
  });

  it("returns token from require() when token is set", async () => {
    const { authToken } = await import("./authToken");
    authToken.set("valid-token");
    expect(authToken.require()).toBe("valid-token");
  });
});
