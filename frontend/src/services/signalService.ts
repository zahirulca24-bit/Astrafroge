import {
  SignalRecordView,
  SignalStatusView,
  TradingGrade,
} from "../types";
import { apiClient, isRecord } from "./apiClient";

interface SignalSummaryDto {
  active_signals: number;
  a_plus_signals: number;
  a_signals: number;
  b_plus_watch: number;
  expired: number;
  risk_blocked: number;
}

interface SignalStatusDto {
  state: "READY" | "WAITING_FOR_SCANNER";
  scanner_state: string;
  active_signal_count: number;
  watch_signal_count: number;
  terminal_signal_count: number;
  updated_at?: string | null;
  latest_scanner_run_at?: string | null;
  summary: SignalSummaryDto;
}

interface SignalRecordDto {
  signal_id: string;
  candidate_id: string;
  version: number;
  symbol: string;
  direction: "LONG" | "SHORT";
  setup: string;
  setup_name: string;
  lifecycle: "ACTIVE" | "WATCH" | "EXPIRED" | "INVALIDATED" | "REJECTED" | "RISK_BLOCKED";
  scanner_lifecycle: string;
  grade?: "A+" | "A" | "B+" | "Reject" | null;
  score?: number | null;
  confidence?: number | null;
  entry_ready: boolean;
  entry_trigger_price: number | string;
  stop_loss_price?: number | string | null;
  evaluated_at: string;
  updated_at?: string | null;
  source_run_id?: string | null;
  universe_rank: number;
  quote_volume: number | string;
  spread_bps: number | string;
  accepted_reasons?: string[];
  audit_codes?: string[];
}

interface SignalListDto {
  count: number;
  signals: SignalRecordDto[];
}

interface SignalLinkDto {
  candidate_id: string;
  signal_id: string;
  symbol: string;
  lifecycle: "ACTIVE" | "WATCH" | "EXPIRED" | "INVALIDATED" | "REJECTED" | "RISK_BLOCKED";
}

function finite(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid signal numeric field: ${field}`);
  return parsed;
}

function optionalFinite(value: unknown): number {
  if (value === null || value === undefined) return Number.NaN;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function grade(value: SignalRecordDto["grade"]): TradingGrade {
  if (value === "A+" || value === "A" || value === "B+") return value;
  return value === "Reject" ? "Rejected" : "N/A";
}

function mapSignal(data: unknown, index: number): SignalRecordView {
  if (!isRecord(data)) throw new Error(`Invalid signal record at index ${index}`);
  const dto = data as unknown as SignalRecordDto;
  if (
    typeof dto.signal_id !== "string" ||
    typeof dto.candidate_id !== "string" ||
    typeof dto.symbol !== "string" ||
    (dto.direction !== "LONG" && dto.direction !== "SHORT") ||
    typeof dto.setup_name !== "string" ||
    typeof dto.lifecycle !== "string" ||
    typeof dto.evaluated_at !== "string"
  ) {
    throw new Error(`Invalid signal record at index ${index}`);
  }
  return {
    signalId: dto.signal_id,
    candidateId: dto.candidate_id,
    version: finite(dto.version, "version"),
    symbol: dto.symbol,
    side: dto.direction === "LONG" ? "Long" : "Short",
    setup: dto.setup,
    setupName: dto.setup_name,
    lifecycle: dto.lifecycle,
    scannerLifecycle: dto.scanner_lifecycle,
    grade: grade(dto.grade),
    score: optionalFinite(dto.score),
    confidence: optionalFinite(dto.confidence),
    entryReady: dto.entry_ready === true,
    entryTriggerPrice: finite(dto.entry_trigger_price, "entry_trigger_price"),
    stopLossPrice: optionalFinite(dto.stop_loss_price),
    evaluatedAt: dto.evaluated_at,
    updatedAt: dto.updated_at ?? null,
    sourceRunId: dto.source_run_id ?? null,
    universeRank: finite(dto.universe_rank, "universe_rank"),
    quoteVolume: finite(dto.quote_volume, "quote_volume"),
    spreadBps: finite(dto.spread_bps, "spread_bps"),
    acceptedReasons: Array.isArray(dto.accepted_reasons) ? dto.accepted_reasons.filter((item): item is string => typeof item === "string") : [],
    auditCodes: Array.isArray(dto.audit_codes) ? dto.audit_codes.filter((item): item is string => typeof item === "string") : [],
  };
}

function mapSignalList(data: unknown): SignalRecordView[] {
  if (!isRecord(data) || !Array.isArray(data.signals)) throw new Error("Invalid signal list response");
  const dto = data as unknown as SignalListDto;
  return dto.signals.map((item, index) => mapSignal(item, index));
}

function mapStatus(data: unknown): SignalStatusView {
  if (!isRecord(data)) throw new Error("Invalid signal status response");
  const dto = data as unknown as SignalStatusDto;
  if (
    (dto.state !== "READY" && dto.state !== "WAITING_FOR_SCANNER") ||
    typeof dto.scanner_state !== "string" ||
    !isRecord(dto.summary)
  ) {
    throw new Error("Invalid signal status response");
  }
  const summary = dto.summary as unknown as SignalSummaryDto;
  return {
    state: dto.state,
    scannerState: dto.scanner_state,
    activeSignalCount: finite(dto.active_signal_count, "active_signal_count"),
    watchSignalCount: finite(dto.watch_signal_count, "watch_signal_count"),
    terminalSignalCount: finite(dto.terminal_signal_count, "terminal_signal_count"),
    updatedAt: dto.updated_at ?? null,
    latestScannerRunAt: dto.latest_scanner_run_at ?? null,
    summary: {
      activeSignals: finite(summary.active_signals, "active_signals"),
      aPlusSignals: finite(summary.a_plus_signals, "a_plus_signals"),
      aSignals: finite(summary.a_signals, "a_signals"),
      bPlusWatch: finite(summary.b_plus_watch, "b_plus_watch"),
      expired: finite(summary.expired, "expired"),
      riskBlocked: finite(summary.risk_blocked, "risk_blocked"),
    },
  };
}

export const signalService = {
  async getStatus(signal?: AbortSignal): Promise<SignalStatusView> {
    return mapStatus(await apiClient.get<unknown>("/api/v1/signals/status", { signal }));
  },

  async getSignals(signal?: AbortSignal): Promise<SignalRecordView[]> {
    return mapSignalList(await apiClient.get<unknown>("/api/v1/signals", { signal }));
  },

  async getCards(signal?: AbortSignal): Promise<SignalRecordView[]> {
    return mapSignalList(await apiClient.get<unknown>("/api/v1/signals/cards", { signal }));
  },

  async getLinks(signal?: AbortSignal): Promise<Map<string, string>> {
    const data = await apiClient.get<unknown>("/api/v1/signals/links", { signal });
    if (!isRecord(data) || !Array.isArray(data.links)) throw new Error("Invalid signal links response");
    const links = new Map<string, string>();
    for (const item of data.links) {
      if (!isRecord(item)) throw new Error("Invalid signal link record");
      const dto = item as unknown as SignalLinkDto;
      if (typeof dto.candidate_id !== "string" || typeof dto.signal_id !== "string") {
        throw new Error("Invalid signal link record");
      }
      links.set(dto.candidate_id, dto.signal_id);
    }
    return links;
  },
};
