import React, { useCallback, useEffect, useState } from "react";
import { Eye, LineChart, RefreshCw, ShieldAlert } from "lucide-react";
import { apiClient, isRecord } from "../services/apiClient";
import { useTrading } from "../store/TradingStore";

interface EarlyWatchItem {
  symbol: string;
  lifecycle: "EARLY_WATCH";
  executable: false;
  sourceCode: string;
  reason: string;
  timeframe: string | null;
  referenceTime: string | null;
  observed: string | null;
  threshold: string | null;
}

interface EarlyWatchSnapshot {
  count: number;
  sourceRunId: string | null;
  generatedAt: string | null;
  items: EarlyWatchItem[];
}

function mapSnapshot(data: unknown): EarlyWatchSnapshot {
  if (!isRecord(data) || !Array.isArray(data.items)) {
    throw new Error("Invalid Early Watch response");
  }

  const items = data.items.map((value, index): EarlyWatchItem => {
    if (!isRecord(value)) {
      throw new Error(`Invalid Early Watch item at index ${index}`);
    }
    if (
      typeof value.symbol !== "string" ||
      value.lifecycle !== "EARLY_WATCH" ||
      value.executable !== false ||
      typeof value.source_code !== "string" ||
      typeof value.reason !== "string"
    ) {
      throw new Error(`Invalid Early Watch item at index ${index}`);
    }
    return {
      symbol: value.symbol,
      lifecycle: "EARLY_WATCH",
      executable: false,
      sourceCode: value.source_code,
      reason: value.reason,
      timeframe: typeof value.timeframe === "string" ? value.timeframe : null,
      referenceTime: typeof value.reference_time === "string" ? value.reference_time : null,
      observed: typeof value.observed === "string" ? value.observed : null,
      threshold: typeof value.threshold === "string" ? value.threshold : null,
    };
  });

  return {
    count: typeof data.count === "number" && Number.isFinite(data.count) ? data.count : items.length,
    sourceRunId: typeof data.source_run_id === "string" ? data.source_run_id : null,
    generatedAt: typeof data.generated_at === "string" ? data.generated_at : null,
    items,
  };
}

function formatTime(value: string | null): string {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : parsed.toLocaleString();
}

export const EarlyWatchPanel: React.FC = () => {
  const { setSelectedSymbol, setCurrentPage } = useTrading();
  const [snapshot, setSnapshot] = useState<EarlyWatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<unknown>("/api/v1/scanner/early-watch");
      setSnapshot(mapSnapshot(data));
      setError(null);
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "Early Watch is unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const openChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  return (
    <section className="mb-4 rounded-lg border border-cyan-950 bg-zinc-950 p-3.5 font-mono text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-cyan-400" />
            <h2 className="font-bold uppercase tracking-wider text-zinc-100">Early Watch — Developing Setups</h2>
            <span className="rounded border border-amber-900 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              NON-EXECUTABLE
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] text-zinc-500">
            Developing conditions derived from the latest full-scan audit. These records are isolated from Signals, Risk and Execution.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">
        <span className="rounded border border-zinc-900 bg-black px-2 py-1">Count: <strong className="text-zinc-200">{snapshot?.count ?? 0}</strong></span>
        <span className="rounded border border-zinc-900 bg-black px-2 py-1">Source Run: <strong className="text-zinc-300">{snapshot?.sourceRunId ?? "Unavailable"}</strong></span>
        <span className="rounded border border-zinc-900 bg-black px-2 py-1">Generated: <strong className="text-zinc-300">{formatTime(snapshot?.generatedAt ?? null)}</strong></span>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-rose-300">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && !loading && snapshot?.items.length === 0 && (
        <div className="mt-3 rounded border border-zinc-900 bg-black p-3 text-zinc-500">
          No developing setup evidence is available from the latest full-universe scan.
        </div>
      )}

      {!error && snapshot && snapshot.items.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {snapshot.items.map((item) => (
            <article key={`${item.symbol}-${item.sourceCode}`} className="rounded border border-zinc-850 bg-zinc-900/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{item.symbol}</span>
                    <span className="rounded border border-cyan-900 bg-cyan-950/30 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">EARLY WATCH</span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-orange-400">{item.sourceCode}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openChart(item.symbol)}
                  className="flex items-center gap-1 rounded border border-zinc-800 bg-black px-2 py-1 text-[10px] text-zinc-300 hover:border-cyan-900 hover:text-cyan-300"
                >
                  <LineChart size={11} /> Chart
                </button>
              </div>
              <p className="mt-2 leading-relaxed text-zinc-300">{item.reason}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded bg-black p-2"><span className="text-zinc-600">Timeframe</span><div className="mt-0.5 text-zinc-300">{item.timeframe ?? "Unavailable"}</div></div>
                <div className="rounded bg-black p-2"><span className="text-zinc-600">Reference</span><div className="mt-0.5 text-zinc-300">{formatTime(item.referenceTime)}</div></div>
                <div className="rounded bg-black p-2"><span className="text-zinc-600">Observed</span><div className="mt-0.5 text-zinc-300">{item.observed ?? "Not supplied"}</div></div>
                <div className="rounded bg-black p-2"><span className="text-zinc-600">Threshold</span><div className="mt-0.5 text-zinc-300">{item.threshold ?? "Not supplied"}</div></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
