export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  closeTime?: string;
  fetchedAt?: string;
  stale?: boolean;
  cacheAgeSeconds?: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketDataConnectionStatus = "Connected" | "Degraded" | "Disconnected";

export interface BackendHealthSnapshot {
  ok: boolean;
  status: string;
  checkedAt?: string | null;
  detail?: string | null;
}

export interface UniverseSummary {
  totalSymbols: number;
  tradableSymbols: number;
  quoteAssets: string[];
  source?: string | null;
  updatedAt?: string | null;
}

export interface IndicatorSnapshot {
  symbol: string;
  trend?: string | null;
  bias?: string | null;
  rsi14?: number | null;
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
  vwap?: number | null;
  macdHistogram?: number | null;
  atr14?: number | null;
  source?: string | null;
  evaluatedAt?: string | null;
  raw: Record<string, unknown>;
}
