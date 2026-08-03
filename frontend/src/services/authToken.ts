/**
 * Memory-only operator token for protected backend mutations.
 *
 * Tokens are NEVER read from VITE_* environment variables, which are inlined
 * into the production bundle and visible to every visitor. The token is kept
 * on `globalThis` so every lazy-loaded chunk shares the same in-memory value.
 * It is never written to localStorage, sessionStorage, cookies, or the build.
 */

type AstraForgeGlobal = typeof globalThis & {
  __ASTRAFORGE_OPERATOR_TOKEN__?: string | null;
};

function tokenStore(): AstraForgeGlobal {
  return globalThis as AstraForgeGlobal;
}

function readToken(): string | null {
  const token = tokenStore().__ASTRAFORGE_OPERATOR_TOKEN__;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export const authToken = {
  get(): string | null {
    return readToken();
  },

  set(token: string | null): void {
    tokenStore().__ASTRAFORGE_OPERATOR_TOKEN__ = token ? token.trim() : null;
  },

  isAvailable(): boolean {
    return readToken() !== null;
  },

  require(): string {
    const token = readToken();
    if (!token) {
      throw new Error(
        "No authenticated session is available. Protected scanner actions are disabled until a secure operator token is configured at runtime.",
      );
    }
    return token;
  },
};
