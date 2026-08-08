import { ActiveTrade, JournalTrade, TradingGrade } from "../types";
import { apiClient, isRecord } from "./apiClient";

function text(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = typeof record[key] === "number" ? record[key] : Number(record[key]);
  return Number.isFinite(value) ? value : fallback;
}

function iso(record: Record<string, unknown>, key: string): string {
  const value = text(record, key);
  return value && Number.isFinite(Date.parse(value)) ? value : new Date(0).toISOString();
}

function side(value: string): "Long" | "Short" {
  return value.toUpperCase() === "SHORT" ? "Short" : "Long";
}

function grade(value: unknown): TradingGrade {
  return value === "A+" || value === "A" || value === "B+" ? value : "N/A";
}

function duration(start: string, end = new Date().toISOString()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 60000));
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function mapTrade(item: unknown): ActiveTrade {
  if (!isRecord(item)) throw new Error("Invalid backend trade record");
  const entry = number(item, "entry_price");
  const stop = number(item, "stop_loss_price");
  const takeProfit = number(item, "take_profit_price");
  const quantity = number(item, "executed_quantity");
  const margin = number(item, "tracked_margin_usdt");
  const pnl = number(item, "unrealized_pnl_usdt");
  const openedAt = iso(item, "opened_at");
  const lifecycle = text(item, "lifecycle", "OPEN");
  return {
    id: text(item, "trade_id", "unknown-trade"),
    signalId: text(item, "signal_id") || undefined,
    backendAuthoritative: true,
    symbol: text(item, "symbol", "UNKNOWN"),
    side: side(text(item, "direction", "LONG")),
    grade: grade(item.grade),
    score: 0,
    entryPrice: entry,
    currentPrice: entry,
    positionSize: quantity,
    leverage: margin > 0 ? Math.max(1, Number(((entry * quantity) / margin).toFixed(2))) : 1,
    marginUsed: margin,
    unrealizedPnL: pnl,
    unrealizedPnLPercent: margin > 0 ? Number(((pnl / margin) * 100).toFixed(2)) : 0,
    stopLoss: stop,
    tp1: takeProfit,
    tp2: takeProfit,
    tp3: takeProfit,
    currentRMultiple: 0,
    duration: duration(openedAt),
    setupName: text(item, "setup_name", text(item, "setup", "Backend trade")),
    status: lifecycle === "CLOSED" ? "Closed" : "Open",
    openedAt,
    timeline: [{ time: openedAt, event: "Exchange-confirmed Binance Demo trade", type: "system" }],
    history: "Backend-authoritative trade record.",
    source: "Backend / Binance Demo",
    mode: "Demo",
    executionStatus: text(item, "order_status", lifecycle),
    signalStatus: "Backend signal",
    exchangeFees: String(number(item, "commission_usdt")),
    fundingFees: String(number(item, "funding_fees_usdt")),
    executionId: text(item, "client_order_id") || text(item, "exchange_order_id"),
    orderId: text(item, "exchange_order_id"),
  };
}

function mapJournal(item: unknown): JournalTrade {
  if (!isRecord(item)) throw new Error("Invalid backend journal record");
  const openedAt = iso(item, "opened_at");
  const closedAt = iso(item, "closed_at");
  const pnl = number(item, "realized_pnl_usdt");
  const margin = number(item, "tracked_margin_usdt");
  return {
    id: text(item, "trade_id", "unknown-trade"),
    tradeId: text(item, "trade_id") || undefined,
    signalId: text(item, "signal_id") || undefined,
    backendAuthoritative: true,
    date: closedAt.replace("T", " ").slice(0, 19),
    symbol: text(item, "symbol", "UNKNOWN"),
    side: side(text(item, "direction", "LONG")),
    grade: grade(item.grade),
    strategy: text(item, "setup_name", text(item, "setup", "Backend trade")),
    entry: number(item, "entry_price"),
    exit: number(item, "exit_price"),
    pnl,
    r: margin > 0 ? Number((pnl / margin).toFixed(2)) : 0,
    duration: duration(openedAt, closedAt),
    exitReason: text(item, "closed_reason", "CLOSED"),
    details: "Backend-authoritative closed Binance Demo trade.",
    source: "Backend / Binance Demo",
    mode: "Demo",
    executionStatus: "Closed",
    signalStatus: "Backend signal",
    exchangeFees: String(number(item, "commission_usdt")),
    fundingFees: String(number(item, "funding_fees_usdt")),
    executionId: text(item, "trade_id"),
    orderId: text(item, "trade_id"),
  };
}

export interface TradesJournalSnapshot {
  activeTrades: ActiveTrade[];
  journalTrades: JournalTrade[];
}

async function loadTradesJournal(signal?: AbortSignal): Promise<TradesJournalSnapshot> {
  const payload = await apiClient.get<unknown>("/api/v1/trade-management/trades-journal", { signal });
  if (!isRecord(payload) || !isRecord(payload.active_trades) || !isRecord(payload.journal)) {
    throw new Error("Invalid Trades & Journal response");
  }
  if (!Array.isArray(payload.active_trades.trades) || !Array.isArray(payload.journal.entries)) {
    throw new Error("Invalid Trades & Journal response");
  }
  return {
    activeTrades: payload.active_trades.trades.map(mapTrade),
    journalTrades: payload.journal.entries.map(mapJournal),
  };
}

let sharedSnapshotRequest: Promise<TradesJournalSnapshot> | null = null;

async function sharedTradesJournal(signal?: AbortSignal): Promise<TradesJournalSnapshot> {
  if (signal) return loadTradesJournal(signal);
  if (sharedSnapshotRequest === null) {
    sharedSnapshotRequest = loadTradesJournal().finally(() => {
      sharedSnapshotRequest = null;
    });
  }
  return sharedSnapshotRequest;
}

export const tradingRecordsService = {
  async getTradesJournal(signal?: AbortSignal): Promise<TradesJournalSnapshot> {
    return sharedTradesJournal(signal);
  },

  async getActiveTrades(signal?: AbortSignal): Promise<ActiveTrade[]> {
    return (await sharedTradesJournal(signal)).activeTrades;
  },

  async getJournal(signal?: AbortSignal): Promise<JournalTrade[]> {
    return (await sharedTradesJournal(signal)).journalTrades;
  },

  async closeTrade(tradeId: string, reason = "MANUAL_CLOSE"): Promise<void> {
    await apiClient.post(`/api/v1/trade-management/close/${encodeURIComponent(tradeId)}`, {
      idempotent: true,
      body: { reason: reason === "INVALIDATED" ? "INVALIDATED" : "MANUAL_CLOSE" },
    });
  },
};
