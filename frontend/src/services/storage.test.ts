import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadActiveTrades, loadFavorites, loadJournalTrades, loadSettings } from "./storage";
import { INITIAL_SETTINGS } from "./defaults";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("validated browser storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("uses safe defaults for malformed settings JSON", () => {
    localStorage.setItem("settings", "{broken");
    expect(loadSettings("settings", INITIAL_SETTINGS)).toEqual(INITIAL_SETTINGS);
  });

  it("rejects malformed active trades", () => {
    localStorage.setItem("trades", JSON.stringify([{ id: "bad", status: "Filled" }]));
    expect(loadActiveTrades("trades")).toEqual([]);
  });

  it("sanitizes locally tracked execution claims", () => {
    localStorage.setItem("trades", JSON.stringify([{
      id: "local-1",
      symbol: "BTCUSDT",
      side: "Long",
      grade: "A",
      score: 90,
      entryPrice: 100,
      currentPrice: 101,
      positionSize: 1,
      leverage: 1,
      marginUsed: 100,
      unrealizedPnL: 1,
      unrealizedPnLPercent: 1,
      stopLoss: 99,
      tp1: 102,
      tp2: 103,
      tp3: 104,
      currentRMultiple: 1,
      duration: "1m",
      setupName: "Local plan",
      status: "Open",
      openedAt: new Date(0).toISOString(),
      timeline: [],
      history: "local",
      source: "Locally Tracked Demo Plan",
      executionStatus: "Filled",
      orderId: "fake-order",
    }]));

    const [trade] = loadActiveTrades("trades");
    expect(trade?.status).toBe("Pending");
    expect(trade?.executionStatus).toBe("Not Submitted / Not Executed");
    expect(trade?.orderId).toBe("No Exchange Order ID");
  });

  it("rejects malformed journal rows and normalizes favorites", () => {
    localStorage.setItem("journal", JSON.stringify([{ id: "missing-fields" }]));
    localStorage.setItem("favorites", JSON.stringify([" btcusdt ", 1, "../bad", "ETHUSDT"]));
    expect(loadJournalTrades("journal")).toEqual([]);
    expect(loadFavorites("favorites", [])).toEqual(["BTCUSDT", "ETHUSDT"]);
  });
});
