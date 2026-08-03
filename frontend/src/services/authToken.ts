/**
 * Memory-only operator token for protected backend mutations.
 *
 * Tokens are NEVER read from VITE_* environment variables, which are inlined
 * into the production bundle and visible to every visitor. Instead, an
 * operator may set a token at runtime via `authToken.set(...)`. When no token
 * is set, protected mutations are blocked and a clear error is surfaced.
 *
 * There is no authentication flow in the frontend today, so mutations remain
 * disabled until a secure session mechanism is introduced.
 */

let memoryToken: string | null = null;

export const authToken = {
  get(): string | null {
    return memoryToken;
  },

  set(token: string | null): void {
    memoryToken = token ? token.trim() : null;
  },

  isAvailable(): boolean {
    return memoryToken !== null && memoryToken.length > 0;
  },

  require(): string {
    if (!memoryToken) {
      throw new Error(
        "No authenticated session is available. Protected scanner actions are disabled until a secure operator token is configured at runtime.",
      );
    }
    return memoryToken;
  },
};
