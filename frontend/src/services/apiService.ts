import { SymbolInfo } from "../types";
import { BackendHealthSnapshot, IndicatorSnapshot, UniverseSummary } from "../types/market";
import { AstraForgeBackendStatus } from "../types/trading";
import { apiClient, isRecord } from "./apiClient";
import { warnOnce } from "./runtimeLogger";

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSymbolMetadata {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
  pricePrecision: number;
  quantityPrecision: number;
}

type MarketDataState = "connected" | "degraded" | "unavailable";

type IndicatorInterval = "5m" | "15m" | "1h";

function parseFiniteNumber(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric field: ${fieldName}`);
  return parsed;
}

function maybeParseFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = maybeParseFiniteNumber(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseIsoDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid timestamp field: ${fieldName}`);
  }
  return value;
}

function parseIsoTimeSeconds(value: unknown, fieldName: string): number {
  return Math.floor(Date.parse(parseIsoDate(value, fieldName)) / 1000);
}

function normalizeInterval(interval: string): IndicatorInterval {
  const normalized = interval.trim().toLowerCase();
  if (normalized === "5m" || normalized === "15m" || normalized === "1h") return normalized;
  throw new Error(`Unsupported market interval: ${interval}`);
}

function mapStructureLabel(state: string | null): string | null {
  if (state === "bullish") return "Bullish";
  if (state === "bearish") return "Bearish";
  if (state === "range") return "Range";
  if (state === "insufficient_data") return "Insufficient Data";
  return null;
}

export const apiService = {
  async getHealth(signal?: AbortSignal): Promise<BackendHealthSnapshot> {
    const data = await apiClient.get<unknown>("/api/v1/health", { signal });
    if (!isRecord(data)) throw new Error("Invalid health response");
    const status = readString(data, "status") ?? "unknown";
    const ok = status.toLowerCase() === "ready";
    return {
      ok,
      status,
      checkedAt: readString(data, "timestamp"),
      detail: readString(data, "service"),
    };
  },

  async checkLiveHealth(signal?: AbortSignal): Promise<boolean> {
    try {
      return (await this.getHealth(signal)).ok;
    } catch (error) {
      warnOnce("api-health", "AstraForge backend is offline or unhealthy.", error);
      return false;
    }
  },

  async getSystemStatus(signal?: AbortSignal): Promise<AstraForgeBackendStatus> {
    try {
      const data = await apiClient.get<unknown>("/api/v1/system/status", { signal });
      if (!isRecord(data)) return "Not connected";
      const service = readString(data, "service");
      const version = readString(data, "version");
      const timestamp = readString(data, "timestamp");
      if (service && version && timestamp && Number.isFinite(Date.parse(timestamp))) return "Connected";
      return "Error";
    } catch (error) {
      warnOnce("api-system-status", "AstraForge system status is unavailable.", error);
      return "Not connected";
    }
  },

  async getMarketStatus(signal?: AbortSignal): Promise<"Connected" | "Degraded" | "Disconnected"> {
    try {
      const data = await apiClient.get<unknown>("/api/v1/market/status", { signal });
      if (!isRecord(data) || typeof data.state !== "string") throw new Error("Invalid market status response");
      parseIsoDate(data.checked_at, "checked_at");
      const state = data.state as MarketDataState;
      if (state === "connected") return "Connected";
      if (state === "degraded") return "Degraded";
      return "Disconnected";
    } catch (error) {
      warnOnce("api-market-status", "AstraForge market data is unavailable.", error);
      return "Disconnected";
    }
  },

  async getMarketSymbols(signal?: AbortSignal): Promise<MarketSymbolMetadata[]> {
    const data = await apiClient.get<unknown>("/api/v1/market/symbols", { signal });
    if (!Array.isArray(data)) throw new Error("Invalid market symbols response");
    return data.map((item, index) => {
      if (!isRecord(item)) throw new Error(`Invalid market symbol at index ${index}`);
      const symbol = readString(item, "symbol");
      const baseAsset = readString(item, "base_asset");
      const quoteAsset = readString(item, "quote_asset");
      const contractType = readString(item, "contract_type");
      const status = readString(item, "status");
      if (!symbol || !baseAsset || !quoteAsset || !contractType || !status) {
        throw new Error(`Invalid market symbol at index ${index}`);
      }
      return {
        symbol,
        baseAsset,
        quoteAsset,
        contractType,
        status,
        pricePrecision: parseFiniteNumber(item.price_precision, "price_precision"),
        quantityPrecision: parseFiniteNumber(item.quantity_precision, "quantity_precision"),
      };
    });
  },

  async getMarketTicker(symbol: string, signal?: AbortSignal): Promise<SymbolInfo> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(normalizedSymbol)) throw new Error(`Invalid symbol: ${symbol}`);
    const data = await apiClient.get<unknown>(
      `/api/v1/market/ticker/${encodeURIComponent(normalizedSymbol)}`,
      { signal },
    );
    if (!isRecord(data)) throw new Error(`Invalid ticker response for ${normalizedSymbol}`);
    const responseSymbol = readString(data, "symbol");
    if (responseSymbol !== normalizedSymbol) throw new Error(`Mismatched ticker response for ${normalizedSymbol}`);
    const closeTime = parseIsoDate(data.close_time, "close_time");
    const fetchedAt = parseIsoDate(data.fetched_at, "fetched_at");
    return {
      symbol: responseSymbol,
      baseAsset: responseSymbol.endsWith("USDT") ? responseSymbol.slice(0, -4) : responseSymbol,
      quoteAsset: "USDT",
      price: parseFiniteNumber(data.last_price, "last_price"),
      change24h: parseFiniteNumber(data.price_change_percent, "price_change_percent"),
      volume24h: parseFiniteNumber(data.quote_volume, "quote_volume"),
      high24h: parseFiniteNumber(data.high_price, "high_price"),
      low24h: parseFiniteNumber(data.low_price, "low_price"),
      closeTime,
      fetchedAt,
      stale: data.stale === true,
      cacheAgeSeconds: parseFiniteNumber(data.cache_age_seconds ?? 0, "cache_age_seconds"),
    };
  },

  async getMarketKlines(symbol: string, interval: string, limit = 150, signal?: AbortSignal): Promise<CandleData[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(normalizedSymbol)) throw new Error(`Invalid symbol: ${symbol}`);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error(`Invalid kline limit: ${limit}`);
    const apiInterval = normalizeInterval(interval);
    const data = await apiClient.get<unknown>(
      `/api/v1/market/klines/${encodeURIComponent(normalizedSymbol)}?interval=${apiInterval}&limit=${limit}`,
      { signal },
    );
    if (!isRecord(data) || !Array.isArray(data.candles)) throw new Error(`Invalid kline response for ${normalizedSymbol}`);
    if (readString(data, "symbol") !== normalizedSymbol || readString(data, "interval") !== apiInterval) {
      throw new Error(`Mismatched kline response for ${normalizedSymbol}`);
    }
    parseIsoDate(data.fetched_at, "fetched_at");
    if (data.stale === true) throw new Error(`Stale candle series returned for ${normalizedSymbol}`);
    return data.candles.map((candle, index) => {
      if (!isRecord(candle) || candle.closed !== true) throw new Error(`Invalid candle at index ${index}`);
      const mapped: CandleData = {
        time: parseIsoTimeSeconds(candle.open_time, "open_time"),
        open: parseFiniteNumber(candle.open, "open"),
        high: parseFiniteNumber(candle.high, "high"),
        low: parseFiniteNumber(candle.low, "low"),
        close: parseFiniteNumber(candle.close, "close"),
        volume: parseFiniteNumber(candle.volume, "volume"),
      };
      if (
        mapped.open <= 0 || mapped.high <= 0 || mapped.low <= 0 || mapped.close <= 0 || mapped.volume < 0 ||
        mapped.high < Math.max(mapped.open, mapped.close) || mapped.low > Math.min(mapped.open, mapped.close) || mapped.low > mapped.high
      ) {
        throw new Error(`Invalid OHLCV candle at index ${index}`);
      }
      return mapped;
    });
  },

  async getUniverseSummary(signal?: AbortSignal): Promise<UniverseSummary> {
    const data = await apiClient.get<unknown>("/api/v1/universe", { signal });
    if (!isRecord(data) || !Array.isArray(data.candidates) || !Array.isArray(data.rejections)) {
      throw new Error("Invalid universe response");
    }
    const eligibleCount = parseFiniteNumber(data.eligible_count, "eligible_count");
    const rejectedCount = parseFiniteNumber(data.rejected_count, "rejected_count");
    const quoteAssets = [...new Set(
      data.candidates.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        const quote = readString(candidate, "quote_asset");
        return quote ? [quote] : [];
      }),
    )];
    return {
      totalSymbols: eligibleCount + rejectedCount,
      tradableSymbols: eligibleCount,
      quoteAssets,
      source: readString(data, "source"),
      updatedAt: parseIsoDate(data.generated_at, "generated_at"),
    };
  },

  async getIndicators(symbol: string, signal?: AbortSignal): Promise<IndicatorSnapshot> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(normalizedSymbol)) throw new Error(`Invalid symbol: ${symbol}`);
    const data = await apiClient.get<unknown>(
      `/api/v1/indicators/${encodeURIComponent(normalizedSymbol)}`,
      { signal },
    );
    if (!isRecord(data) || !Array.isArray(data.points) || !isRecord(data.structure)) {
      throw new Error(`Invalid indicators response for ${normalizedSymbol}`);
    }
    if (readString(data, "symbol") !== normalizedSymbol) throw new Error(`Mismatched indicators response for ${normalizedSymbol}`);
    parseIsoDate(data.generated_at, "generated_at");
    if (data.stale === true) throw new Error(`Stale indicator series returned for ${normalizedSymbol}`);
    const latest = [...data.points].reverse().find(isRecord) ?? null;
    const structureState = readString(data.structure, "state");
    const trend = mapStructureLabel(structureState);
    return {
      symbol: normalizedSymbol,
      trend,
      bias: trend,
      rsi14: latest ? readNumber(latest, "rsi14") : null,
      ema20: latest ? readNumber(latest, "ema20") : null,
      ema50: latest ? readNumber(latest, "ema50") : null,
      ema200: latest ? readNumber(latest, "ema200") : null,
      vwap: latest ? readNumber(latest, "vwap") : null,
      macdHistogram: latest ? readNumber(latest, "macd_histogram") : null,
      atr14: latest ? readNumber(latest, "atr14") : null,
      source: readString(data, "source"),
      evaluatedAt: readString(data, "generated_at"),
      raw: data,
    };
  },
};
