import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");

describe("no exposed auth tokens in source", () => {
  const sourceFiles = [
    "src/services/apiClient.ts",
    "src/services/scannerService.ts",
    "src/services/authToken.ts",
    "src/store/TradingStore.tsx",
    ".env.example",
  ];

  it("does not reference VITE_API_AUTH_TOKEN", () => {
    for (const file of sourceFiles) {
      const fullPath = path.join(projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).not.toMatch(/VITE_API_AUTH_TOKEN/);
    }
  });

  it(".env.example does not contain token variables", () => {
    const envExample = path.join(projectRoot, ".env.example");
    const content = fs.readFileSync(envExample, "utf-8");
    const nonCommentLines = content.split("\n").filter((line) => !line.trim().startsWith("#"));
    const nonCommentContent = nonCommentLines.join("\n");
    expect(nonCommentContent).not.toMatch(/TOKEN|SECRET|API_KEY|PASSWORD/i);
  });
});

describe("no placeholder or mock trading values in pages", () => {
  const pageFiles = [
    "src/pages/Dashboard.tsx",
    "src/pages/Scanner.tsx",
    "src/pages/Signals.tsx",
    "src/pages/ActiveTrades.tsx",
    "src/pages/Journal.tsx",
    "src/pages/Settings.tsx",
    "src/pages/ChartPage.tsx",
  ];

  it("does not contain mock price or PnL placeholders", () => {
    for (const file of pageFiles) {
      const fullPath = path.join(projectRoot, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).not.toMatch(/mockPrice|fakePnl|placeholderPnl|MOCK_PRICE/);
    }
  });
});
