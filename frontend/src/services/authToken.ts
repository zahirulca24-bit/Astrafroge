export const authToken = {
  get(): string | null {
    return null;
  },

  set(token: string | null): void {
    void token;
  },

  isAvailable(): boolean {
    return false;
  },

  require(): string {
    throw new Error("No authenticated operator session is available.");
  },
};
