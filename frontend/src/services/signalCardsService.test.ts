import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("./apiClient", () => ({
  apiClient: { get },
  isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
}));

import { signalService } from "./signalService";

describe("signalService.getCards", () => {
  beforeEach(() => get.mockReset());

  it("maps backend card identities and lifecycle without deriving scanner-local cards", async () => {
    get.mockResolvedValue({
      count: 1,
      signals: [
        {
          signal_id: "s".repeat(64),
          candidate_id: "candidate-1",
          version: 2,
          symbol: "BTCUSDT",
          direction: "LONG",
          setup: "trend_pullback",
          setup_name: "Trend Pullback",
          lifecycle: "ACTIVE",
          scanner_lifecycle: "QUALIFIED",
          grade: "A+",
          score: 94,
          confidence: 82,
          entry_ready: true,
          entry_trigger_price: "65000",
          stop_loss_price: "64200",
          evaluated_at: "2026-08-08T00:00:00Z",
          updated_at: "2026-08-08T00:01:00Z",
          source_run_id: "run-1",
          universe_rank: 1,
          quote_volume: "1000000",
          spread_bps: "1.2",
          accepted_reasons: ["Qualified backend signal"],
          audit_codes: [],
        },
      ],
    });

    const cards = await signalService.getCards();

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      candidateId: "candidate-1",
      symbol: "BTCUSDT",
      lifecycle: "ACTIVE",
      grade: "A+",
      entryTriggerPrice: 65000,
      stopLossPrice: 64200,
    });
    expect(get).toHaveBeenCalledWith("/api/v1/signals/cards", { signal: undefined });
  });
});
