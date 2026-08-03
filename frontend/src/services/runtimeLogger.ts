const lastWarningAt = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 60_000;

/**
 * Prevents polling failures from flooding the browser console while preserving
 * enough context for diagnosis.
 */
export function warnOnce(key: string, message: string, error?: unknown, cooldownMs = DEFAULT_COOLDOWN_MS): void {
  const now = Date.now();
  const previous = lastWarningAt.get(key) ?? 0;
  if (now - previous < cooldownMs) return;
  lastWarningAt.set(key, now);
  if (error !== undefined) {
    console.warn(message, error);
  } else {
    console.warn(message);
  }
}
