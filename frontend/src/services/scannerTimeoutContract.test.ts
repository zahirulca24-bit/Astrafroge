import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./apiClient.ts", import.meta.url)), "utf8");

describe("Scan Now timeout contract", () => {
  it("keeps normal requests at 15s but gives the manual full scan a 120s budget", () => {
    expect(source).toContain("const DEFAULT_REQUEST_TIMEOUT_MS = 15000;");
    expect(source).toContain("const SCANNER_RUN_REQUEST_TIMEOUT_MS = 120000;");
    expect(source).toContain('path === "/api/v1/scanner/run-now"');
  });
});
