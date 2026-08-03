import { SymbolInfo } from "../types";
import { apiService, CandleData } from "./apiService";
import { warnOnce } from "./runtimeLogger";

export type { CandleData };

const candlesCache: Record<string, { timestamp: number; data: CandleData[] }> = {};
const CACHE_TTL = 10_000;

export const marketDataService = {
  async fetchTickers(symbols: string[], signal?: AbortSignal): Promise<SymbolInfo[]> {
    const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
    if (uniqueSymbols.length === 0) return [];

    const results = await Promise.allSettled(
      uniqueSymbols.map((symbol) => apiService.getMarketTicker(symbol, signal)),
    );

    const tickers: SymbolInfo[] = [];
    results.forEach((result, index) => {
      const symbol = uniqueSymbols[index] ?? "unknown";
      if (result.status === "fulfilled") {
        if (!result.value.stale) tickers.push(result.value);
      } else if (!signal?.aborted) {
        warnOnce(`ticker-${symbol}`, `Market ticker unavailable for ${symbol}.`, result.reason);
      }
    });

    if (tickers.length === 0) {
      throw new Error("No current ticker data was returned by the AstraForge backend");
    }
    return tickers;
  },

  async fetchCandles(
    symbol: string,
    interval: string,
    limit = 500,
    signal?: AbortSignal,
  ): Promise<CandleData[]> {
    const cacheKey = `${symbol}_${interval}_${limit}`;
    const cached = candlesCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const mappedData = await apiService.getMarketKlines(symbol, interval, limit, signal);
    candlesCache[cacheKey] = { timestamp: Date.now(), data: mappedData };
    return mappedData;
  },
};
