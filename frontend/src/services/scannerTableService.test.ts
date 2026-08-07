import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./apiClient", () => ({
  apiClient: { get },
  isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
}));

import { scannerTableService } from "./scannerTableService";

describe("scannerTableService", () => {
  beforeEach(() => get.mockReset());

  it("maps authoritative backend counts and all scanner statuses", async () => {
    get.mockResolvedValue({
      summary: {
        run_id: "run-1",
        run_status: "DEGRADED",
        total: 4,
        ready: 1,
        near_setup: 1,
        rejected: 1,
        failed: 1,
      },
      rows: [
        { universe_rank: 1, symbol: "BTCUSDT", direction: "LONG", trend_1h: "Bullish", setup_15m: "Trend Pullback", entry_5m: "Entry Ready", status: "READY", audit_codes: [] },
        { universe_rank: 2, symbol: "ETHUSDT", direction: "LONG", trend_1h: "Bullish", setup_15m: "Trend Pullback", entry_5m: "Awaiting Trigger", status: "NEAR_SETUP", audit_codes: [] },
        { universe_rank: 3, symbol: "XRPUSDT", direction: null, trend_1h: "Sideways", setup_15m: "No setup", entry_5m: "Unavailable", status: "REJECTED", primary_reason: "1H regime is SIDEWAYS", audit_codes: ["TREND_SIDEWAYS"] },
        { universe_rank: 4, symbol: "ADAUSDT", direction: null, trend_1h: "Unavailable", setup_15m: "Unavailable", entry_5m: "Unavailable", status: "FAILED", primary_reason: "5m candles are unavailable", audit_codes: ["MISSING_5M_CANDLES"] },
      ],
    });

    const snapshot = await scannerTableService.getLatest();

    expect(snapshot.summary).toMatchObject({ total: 4, ready: 1, nearSetup: 1, rejected: 1, failed: 1 });
    expect(snapshot.rows.map((row) => row.status)).toEqual(["READY", "NEAR_SETUP", "REJECTED", "FAILED"]);
    expect(get).toHaveBeenCalledWith("/api/v1/scanner/evaluations/latest", { signal: undefined });
  });

  it("preserves all 50 authoritative scanner rows without truncating the universe", async () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      universe_rank: index + 1,
      symbol: `SYM${index + 1}USDT`,
      direction: index % 2 === 0 ? "LONG" : "SHORT",
      trend_1h: index % 2 === 0 ? "Bullish" : "Bearish",
      setup_15m: "Trend Pullback",
      entry_5m: "Awaiting Trigger",
      status: index === 0 ? "READY" : index === 1 ? "NEAR_SETUP" : "REJECTED",
      audit_codes: index > 1 ? ["SETUP_NOT_DETECTED"] : [],
    }));

    get.mockResolvedValue({
      summary: {
        run_id: "run-50",
        run_status: "COMPLETED",
        total: 50,
        ready: 1,
        near_setup: 1,
        rejected: 48,
        failed: 0,
      },
      rows,
    });

    const snapshot = await scannerTableService.getLatest();

    expect(snapshot.summary.total).toBe(50);
    expect(snapshot.rows).toHaveLength(50);
    expect(snapshot.rows.at(0)?.universeRank).toBe(1);
    expect(snapshot.rows.at(-1)?.universeRank).toBe(50);
    expect(snapshot.rows.filter((row) => row.status === "REJECTED")).toHaveLength(48);
  });

  it("fails closed when the backend scanner contract is invalid", async () => {
    get.mockResolvedValue({
      summary: null,
      rows: [],
    });

    await expect(scannerTableService.getLatest()).rejects.toThrow("Invalid scanner table response");
  });
});
