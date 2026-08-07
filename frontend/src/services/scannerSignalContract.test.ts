import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const servicesRoot = path.resolve(__dirname);

function read(name: string): string {
  return fs.readFileSync(path.join(servicesRoot, name), "utf-8");
}

describe("Scanner & Signals Phase 1 frontend contract", () => {
  it("builds scanner rows from latest full-run audit truth with universe rank", () => {
    const source = read("scannerService.ts");
    expect(source).toContain("universe_rank");
    expect(source).toContain("source_run_id");
    expect(source).toContain("buildLatestEvaluationRows");
    expect(source).toContain('status: failed ? "Failed" : "Rejected"');
  });

  it("connects to the real backend Signal Engine endpoints", () => {
    const source = read("signalService.ts");
    expect(source).toContain('/api/v1/signals/status');
    expect(source).toContain('/api/v1/signals');
    expect(source).toContain("signal_id");
    expect(source).toContain("candidate_id");
  });
});
