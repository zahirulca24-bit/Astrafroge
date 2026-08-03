/**
 * Memory-only operator token for protected backend mutations.
 *
 * Tokens are NEVER read from VITE_* environment variables, which are inlined
 * into the production bundle and visible to every visitor. The token is kept
 * on `window` so every lazy-loaded chunk shares the same in-memory value.
 * It is never written to localStorage, sessionStorage, cookies, or the build.
 */

declare global {
  interface Window {
    __ASTRAFORGE_OPERATOR_TOKEN__?: string | null;
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.__ASTRAFORGE_OPERATOR_TOKEN__;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export const authToken = {
  get(): string | null {
    return readToken();
  },

  set(token: string | null): void {
    if (typeof window === "undefined") return;
    window.__ASTRAFORGE_OPERATOR_TOKEN__ = token ? token.trim() : null;
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
