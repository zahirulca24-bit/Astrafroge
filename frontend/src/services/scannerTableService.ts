import { apiClient, isRecord } from "./apiClient";

export type ScannerTableStatus = "READY" | "NEAR_SETUP" | "REJECTED" | "FAILED";

export interface ScannerTableRow {
  universeRank: number;
  symbol: string;
  direction: "LONG" | "SHORT" | null;
  setupName: string | null;
  trend15m: string;
  setup5m: string;
  entry1m3m: string;
  grade: "A+" | "A" | "B+" | "Reject" | null;
  score: number | null;
  confidence: number | null;
  status: ScannerTableStatus;
  candidateId: string | null;
  primaryReasonCode: string | null;
  primaryReason: string | null;
  auditCodes: string[];
}

export interface ScannerTableSummary {
  runId: string;
  runStatus: "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED" | "SKIPPED";
  total: number;
  ready: number;
  nearSetup: number;
  rejected: number;
  failed: number;
}

export interface ScannerTableSnapshot {
  summary: ScannerTableSummary;
  rows: ScannerTableRow[];
}

function finiteInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Invalid scanner table field: ${name}`);
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export const scannerTableService = {
  async getLatest(signal?: AbortSignal): Promise<ScannerTableSnapshot> {
    const data = await apiClient.get<unknown>("/api/v1/scanner/evaluations/latest", { signal });
    if (!isRecord(data) || !isRecord(data.summary) || !Array.isArray(data.rows)) {
      throw new Error("Invalid scanner table response");
    }

    const summary = data.summary;
    const runStatus = summary.run_status;
    if (
      typeof summary.run_id !== "string" ||
      !["RUNNING", "COMPLETED", "DEGRADED", "FAILED", "SKIPPED"].includes(String(runStatus))
    ) {
      throw new Error("Invalid scanner table summary");
    }

    const rows = data.rows.map((raw, index): ScannerTableRow => {
      if (!isRecord(raw) || typeof raw.symbol !== "string") {
        throw new Error(`Invalid scanner table row at index ${index}`);
      }
      const status = String(raw.status);
      if (!["READY", "NEAR_SETUP", "REJECTED", "FAILED"].includes(status)) {
        throw new Error(`Invalid scanner table status at index ${index}`);
      }
      const direction = raw.direction === "LONG" || raw.direction === "SHORT" ? raw.direction : null;
      const grade = ["A+", "A", "B+", "Reject"].includes(String(raw.grade))
        ? (raw.grade as ScannerTableRow["grade"])
        : null;
      return {
        universeRank: finiteInteger(raw.universe_rank, "universe_rank"),
        symbol: raw.symbol,
        direction,
        setupName: optionalString(raw.setup_name),
        // Backend keeps these wire keys for compatibility. Their semantics now follow
        // the scalping workflow: 15M trend -> 5M setup -> 1M/3M entry.
        trend15m: optionalString(raw.trend_1h) ?? "Unavailable",
        setup5m: optionalString(raw.setup_15m) ?? "Unavailable",
        entry1m3m: optionalString(raw.entry_5m) ?? "Unavailable",
        grade,
        score: optionalNumber(raw.score),
        confidence: optionalNumber(raw.confidence),
        status: status as ScannerTableStatus,
        candidateId: optionalString(raw.candidate_id),
        primaryReasonCode: optionalString(raw.primary_reason_code),
        primaryReason: optionalString(raw.primary_reason),
        auditCodes: Array.isArray(raw.audit_codes)
          ? raw.audit_codes.filter((item): item is string => typeof item === "string")
          : [],
      };
    });

    return {
      summary: {
        runId: summary.run_id,
        runStatus: runStatus as ScannerTableSummary["runStatus"],
        total: finiteInteger(summary.total, "total"),
        ready: finiteInteger(summary.ready, "ready"),
        nearSetup: finiteInteger(summary.near_setup, "near_setup"),
        rejected: finiteInteger(summary.rejected, "rejected"),
        failed: finiteInteger(summary.failed, "failed"),
      },
      rows,
    };
  },
};
