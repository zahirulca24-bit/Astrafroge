/**
 * Scanner lifecycle service — the single source of truth for all scanner
 * operations (status, start, stop, run-now, candidates).
 *
 * Every protected mutation (start, stop, run-now) requires a Bearer token and
 * an Idempotency-Key. If no token is configured, the mutation is not sent and a
 * clear configuration error is thrown instead.
 */

import {
  ScannerAuditRecord,
  ScannerCandidatesSnapshot,
  ScannerResult,
  ScannerRuntimeStatus,
  ScannerRunSummary,
} from "../types";
import { apiClient, isRecord } from "./apiClient";
import { authToken } from "./authToken";

interface ScannerAuditRecordDto {
  code: string;
  detail: string;
  symbol?: string | null;
  timeframe?: string | null;
}

interface ScannerRunSummaryDto {
  run_id: string;
  run_type: "FULL_UNIVERSE_SCAN" | "ACTIVE_CANDIDATE_REFRESH";
  status: "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED" | "SKIPPED";
  run_started_at: string;
  completed_at?: string | null;
  universe_size?: number;
  evaluated_symbols?: number;
  successful_symbols?: number;
  failed_symbols?: number;
  discovered_candidates?: number;
  selected_candidates?: number;
  updated_candidates?: number;
  qualified_candidates?: number;
  audits?: ScannerAuditRecordDto[];
}

interface ScannerStatusDto {
  state: "OFF" | "ON";
  contract_version: string;
  scanner_runtime_implemented: boolean;
  run_active: boolean;
  scheduler_running: boolean;
  next_full_scan_at?: string | null;
  next_refresh_at?: string | null;
  last_refresh_boundary?: string | null;
  active_candidate_count: number;
  terminal_candidate_count?: number;
  latest_run?: ScannerRunSummaryDto | null;
}

interface ScannerCandidateDto {
  candidate_id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  setup: string;
  setup_name: string;
  timeframe?: string;
  reference_close_time: string;
  setup_confirmed_at: string;
  expires_at: string;
  qualification_expires_at?: string | null;
  lifecycle: "DETECTED" | "WATCH_NEAR" | "QUALIFIED" | "REJECTED" | "INVALIDATED" | "EXPIRED";
  score?: number | null;
  confidence?: number | null;
  grade?: "A+" | "A" | "B+" | "Reject" | null;
  entry_ready: boolean;
  stale?: boolean;
  universe_rank?: number;
  quote_volume?: string | number;
  spread_bps?: string | number;
  level?: string | number | null;
  selected_ema?: string | number | null;
  entry_trigger_price: string | number;
  evaluated_at: string;
  accepted_reasons?: string[];
  audit_codes?: string[];
  evidence?: Record<string, unknown>;
}

interface ScannerCandidatesResponseDto {
  count: number;
  candidates: ScannerCandidateDto[];
  summary?: ScannerCandidateSummaryDto;
}

interface ScannerCandidateSummaryDto {
  state?: "OFF" | "ON" | null;
  run_status?: "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED" | "SKIPPED" | null;
  run_type?: "FULL_UNIVERSE_SCAN" | "ACTIVE_CANDIDATE_REFRESH" | null;
  run_started_at?: string | null;
  completed_at?: string | null;
  evaluated_symbols?: number;
  successful_symbols?: number;
  failed_symbols?: number;
  discovered_candidates?: number;
  selected_candidates?: number;
  updated_candidates?: number;
  qualified_candidates?: number;
  audits?: ScannerAuditRecordDto[];
}

function parseFiniteNumber(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field: ${fieldName}`);
  }
  return parsed;
}

function maybeParseFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = maybeParseFiniteNumber(record[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function mapScannerRunSummary(data: unknown): ScannerRunSummary {
  if (!isRecord(data)) {
    throw new Error("Invalid scanner run summary response");
  }
  const dto = data as unknown as ScannerRunSummaryDto;
  if (
    typeof dto.run_id !== "string" ||
    typeof dto.run_type !== "string" ||
    typeof dto.status !== "string" ||
    typeof dto.run_started_at !== "string"
  ) {
    throw new Error("Invalid scanner run summary response");
  }
  return {
    runId: dto.run_id,
    runType: dto.run_type,
    status: dto.status,
    runStartedAt: dto.run_started_at,
    completedAt: dto.completed_at ?? null,
    universeSize: parseFiniteNumber(dto.universe_size ?? 0, "universe_size"),
    evaluatedSymbols: parseFiniteNumber(dto.evaluated_symbols ?? 0, "evaluated_symbols"),
    successfulSymbols: parseFiniteNumber(dto.successful_symbols ?? 0, "successful_symbols"),
    failedSymbols: parseFiniteNumber(dto.failed_symbols ?? 0, "failed_symbols"),
    discoveredCandidates: parseFiniteNumber(dto.discovered_candidates ?? 0, "discovered_candidates"),
    selectedCandidates: parseFiniteNumber(dto.selected_candidates ?? 0, "selected_candidates"),
    updatedCandidates: parseFiniteNumber(dto.updated_candidates ?? 0, "updated_candidates"),
    qualifiedCandidates: parseFiniteNumber(dto.qualified_candidates ?? 0, "qualified_candidates"),
    audits: Array.isArray(dto.audits)
      ? dto.audits
          .filter((audit): audit is ScannerAuditRecordDto => isRecord(audit))
          .map(
            (audit): ScannerAuditRecord => ({
              code: typeof audit.code === "string" ? audit.code : "UNKNOWN",
              detail:
                typeof audit.detail === "string" && audit.detail.trim()
                  ? audit.detail
                  : "No detail provided",
              symbol: typeof audit.symbol === "string" ? audit.symbol : null,
              timeframe: typeof audit.timeframe === "string" ? audit.timeframe : null,
            }),
          )
      : [],
  };
}

function mapScannerCandidateSummary(data: unknown): ScannerRunSummary | null {
  if (!isRecord(data)) return null;
  const dto = data as unknown as ScannerCandidateSummaryDto;
  if (
    typeof dto.run_status !== "string" ||
    typeof dto.run_type !== "string" ||
    typeof dto.run_started_at !== "string"
  ) {
    return null;
  }
  return mapScannerRunSummary({
    run_id: "latest-summary",
    run_type: dto.run_type,
    status: dto.run_status,
    run_started_at: dto.run_started_at,
    completed_at: dto.completed_at ?? null,
    universe_size: dto.evaluated_symbols ?? 0,
    evaluated_symbols: dto.evaluated_symbols ?? 0,
    successful_symbols: dto.successful_symbols ?? 0,
    failed_symbols: dto.failed_symbols ?? 0,
    discovered_candidates: dto.discovered_candidates ?? 0,
    selected_candidates: dto.selected_candidates ?? 0,
    updated_candidates: dto.updated_candidates ?? 0,
    qualified_candidates: dto.qualified_candidates ?? 0,
    audits: dto.audits ?? [],
  });
}

function mapScannerStatus(data: unknown): ScannerRuntimeStatus {
  if (!isRecord(data)) {
    throw new Error("Invalid scanner status response");
  }
  const dto = data as unknown as ScannerStatusDto;
  if (
    (dto.state !== "OFF" && dto.state !== "ON") ||
    typeof dto.contract_version !== "string" ||
    typeof dto.scanner_runtime_implemented !== "boolean"
  ) {
    throw new Error("Invalid scanner status response");
  }
  return {
    state: dto.state,
    contractVersion: dto.contract_version,
    scannerRuntimeImplemented: dto.scanner_runtime_implemented,
    runActive: dto.run_active === true,
    schedulerRunning: dto.scheduler_running === true,
    nextFullScanAt: dto.next_full_scan_at ?? null,
    nextRefreshAt: dto.next_refresh_at ?? null,
    lastRefreshBoundary: dto.last_refresh_boundary ?? null,
    activeCandidateCount: parseFiniteNumber(dto.active_candidate_count, "active_candidate_count"),
    terminalCandidateCount: parseFiniteNumber(dto.terminal_candidate_count ?? 0, "terminal_candidate_count"),
    latestRun: dto.latest_run ? mapScannerRunSummary(dto.latest_run) : null,
  };
}

function mapScannerLifecycleToStatus(lifecycle: ScannerCandidateDto["lifecycle"]): ScannerResult["status"] {
  if (lifecycle === "QUALIFIED") return "Ready Now";
  if (lifecycle === "WATCH_NEAR" || lifecycle === "DETECTED") return "Near Setup";
  return "Rejected";
}

function mapScannerGrade(grade: ScannerCandidateDto["grade"]): ScannerResult["grade"] {
  if (grade === "A+" || grade === "A" || grade === "B+") return grade;
  return "Rejected";
}

function formatScannerSide(direction: ScannerCandidateDto["direction"]): ScannerResult["side"] {
  return direction === "LONG" ? "Long" : "Short";
}

function humanizeIdentifier(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const scannerService = {
  async getStatus(signal?: AbortSignal): Promise<ScannerRuntimeStatus> {
    const data = await apiClient.get<unknown>("/api/v1/scanner/status", { signal });
    return mapScannerStatus(data);
  },

  async start(): Promise<ScannerRuntimeStatus> {
    const token = authToken.require();
    const data = await apiClient.post<unknown>("/api/v1/scanner/start", {
      authToken: token,
      idempotent: true,
    });
    return mapScannerStatus(data);
  },

  async stop(): Promise<ScannerRuntimeStatus> {
    const token = authToken.require();
    const data = await apiClient.post<unknown>("/api/v1/scanner/stop", {
      authToken: token,
      idempotent: true,
    });
    return mapScannerStatus(data);
  },

  async runNow(): Promise<ScannerRunSummary> {
    const token = authToken.require();
    const data = await apiClient.post<unknown>("/api/v1/scanner/run-now", {
      authToken: token,
      idempotent: true,
    });
    return mapScannerRunSummary(data);
  },

  async getCandidates(signal?: AbortSignal): Promise<ScannerCandidatesSnapshot> {
    const data = await apiClient.get<unknown>("/api/v1/scanner/candidates", { signal });
    if (!isRecord(data) || !Array.isArray(data.candidates)) {
      throw new Error("Invalid scanner candidates response");
    }
    const dto = data as unknown as ScannerCandidatesResponseDto;

    const candidates = dto.candidates.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(`Invalid scanner candidate at index ${index}`);
      }
      const dto = item as unknown as ScannerCandidateDto;
      if (
        typeof dto.symbol !== "string" ||
        (dto.direction !== "LONG" && dto.direction !== "SHORT") ||
        typeof dto.setup_name !== "string" ||
        typeof dto.lifecycle !== "string"
      ) {
        throw new Error(`Invalid scanner candidate at index ${index}`);
      }

      const entryPrice = parseFiniteNumber(dto.entry_trigger_price, "entry_trigger_price");
      const currentPrice = readNumber(dto.evidence ?? {}, "current_price", "last_price", "close_price");
      // The Scanner contract does not currently expose stop-loss, take-profit,
      // or risk/reward values. Keep these unavailable rather than duplicating
      // trading-rule calculations in the frontend.
      const stopLoss = Number.NaN;
      const tp1 = Number.NaN;
      const tp2 = Number.NaN;
      const tp3 = Number.NaN;
      const riskReward = Number.NaN;
      const setupReasons = dto.accepted_reasons && dto.accepted_reasons.length > 0
        ? dto.accepted_reasons
        : [`${dto.setup_name} candidate returned by the AstraForge scanner runtime.`];
      const rejectionReasons =
        mapScannerLifecycleToStatus(dto.lifecycle) === "Rejected"
          ? (dto.audit_codes ?? []).map((code) => humanizeIdentifier(code))
          : undefined;
      const riskWarnings = [
        ...(dto.entry_ready ? [] : ["Entry trigger not ready yet"]),
        ...(dto.stale ? ["Candidate is stale and should be reviewed carefully"] : []),
      ];

      return {
        candidateId: dto.candidate_id,
        symbol: dto.symbol,
        side: formatScannerSide(dto.direction),
        currentPrice: currentPrice ?? Number.NaN,
        volume24h: parseFiniteNumber(dto.quote_volume, "quote_volume"),
        trend1h: dto.direction === "LONG" ? "Bullish Regime" : "Bearish Regime",
        setup15m: dto.setup_name,
        entry5m: dto.entry_ready ? "Entry Ready" : "Awaiting Trigger",
        grade: mapScannerGrade(dto.grade),
        score: dto.score === null || dto.score === undefined ? Number.NaN : parseFiniteNumber(dto.score, "score"),
        riskReward,
        status: mapScannerLifecycleToStatus(dto.lifecycle),
        entryZone: `${entryPrice.toFixed(entryPrice > 100 ? 2 : 4)}`,
        stopLoss: Number.isFinite(stopLoss) ? Number(stopLoss.toFixed(entryPrice > 100 ? 2 : 4)) : Number.NaN,
        tp1: Number.isFinite(tp1) ? Number(tp1.toFixed(entryPrice > 100 ? 2 : 4)) : Number.NaN,
        tp2: Number.isFinite(tp2) ? Number(tp2.toFixed(entryPrice > 100 ? 2 : 4)) : Number.NaN,
        tp3: Number.isFinite(tp3) ? Number(tp3.toFixed(entryPrice > 100 ? 2 : 4)) : Number.NaN,
        confidence: dto.confidence === null || dto.confidence === undefined
          ? Number.NaN
          : parseFiniteNumber(dto.confidence, "confidence"),
        setupReasons,
        rejectionReasons,
        riskWarnings: riskWarnings.length > 0 ? riskWarnings : undefined,
      };
    });

    return {
      candidates,
      summary: mapScannerCandidateSummary(dto.summary),
      summaryState:
        dto.summary?.state === "ON" || dto.summary?.state === "OFF" ? dto.summary.state : null,
    };
  },
};
