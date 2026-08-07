import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pageSource = readFileSync(fileURLToPath(new URL("./ScannerSignals.tsx", import.meta.url)), "utf8");
const appSource = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

describe("Scanner & Signals Phase 5 layout", () => {
  it("renders Scanner and Signal panels side by side on desktop", () => {
    expect(pageSource).toContain("<ScannerTablePanel />");
    expect(pageSource).toContain("<SignalCardsPanel />");
    expect(pageSource).toContain("xl:grid-cols-2");
  });

  it("routes both legacy internal pages to the merged UI and exposes one navigation label", () => {
    expect(appSource).toContain('case "Scanner":');
    expect(appSource).toContain('case "Signals":');
    expect(appSource).toContain("return <ScannerSignals />;");
    expect(appSource).toContain('content: "Scanner & Signals"');
    expect(appSource).toContain("nav > button:nth-child(3) { display: none; }");
  });
});
