const STORAGE_KEY = "astraforge_scanner_signal_candidate";
const EVENT_NAME = "astraforge:scanner-signal-select";

export function getSelectedCandidateId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STORAGE_KEY);
}

export function selectCandidateId(candidateId: string | null): void {
  if (typeof window === "undefined") return;
  if (candidateId) window.sessionStorage.setItem(STORAGE_KEY, candidateId);
  else window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent<string | null>(EVENT_NAME, { detail: candidateId }));
}

export function subscribeCandidateSelection(listener: (candidateId: string | null) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    listener((event as CustomEvent<string | null>).detail ?? null);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
