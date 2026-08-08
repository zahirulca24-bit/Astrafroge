import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appSource = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
const serviceSource = readFileSync(fileURLToPath(new URL("../services/tradingRecordsService.ts", import.meta.url)), "utf8");

describe("Trades & Journal consolidation contract", () => {
  it("routes both legacy trade pages into one user-facing module", () => {
    expect(appSource).toContain('case "Active Trades":');
    expect(appSource).toContain('case "Journal":');
    expect(appSource).toContain("return <TradesJournal />;");
    expect(appSource).toContain('content: "Trades & Journal"');
  });

  it("defines one backend-authoritative combined records endpoint", () => {
    expect(serviceSource).toContain('"/api/v1/trade-management/trades-journal"');
    expect(serviceSource).toContain("activeTrades");
    expect(serviceSource).toContain("journalTrades");
  });
});
