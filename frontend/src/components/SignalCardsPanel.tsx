import React, { useEffect, useMemo, useState } from "react";
import { ChartLine, RefreshCw, SlidersHorizontal } from "lucide-react";

import { useTrading } from "../store/TradingStore";
import { signalService } from "../services/signalService";
import {
  getSelectedCandidateId,
  selectCandidateId,
  subscribeCandidateSelection,
} from "../services/scannerSignalSelection";
import { SignalRecordView, SignalStatusView } from "../types";
import { GradeBadge, SymbolAvatar } from "./SharedComponents";

const FILTER_OPTIONS = ["All", "A+", "A", "B+", "Long", "Short"] as const;
type SignalFilter = (typeof FILTER_OPTIONS)[number];
type SortKey = "score" | "confidence" | "rank";

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "Unavailable";
}

function compareDescending(left: number, right: number): number {
  if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
  if (!Number.isFinite(left)) return 1;
  if (!Number.isFinite(right)) return -1;
  return right - left;
}

export const SignalCardsPanel: React.FC = () => {
  const { setCurrentPage, setSelectedSymbol } = useTrading();
  const [status, setStatus] = useState<SignalStatusView | null>(null);
  const [signals, setSignals] = useState<SignalRecordView[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => getSelectedCandidateId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignalFilter>("All");
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => subscribeCandidateSelection(setSelectedCandidateId), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      signalService.getStatus(controller.signal),
      signalService.getCards(controller.signal),
    ])
      .then(([nextStatus, nextSignals]) => {
        if (!active) return;
        setStatus(nextStatus);
        setSignals(nextSignals);
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Signal Engine unavailable");
        setStatus(null);
        setSignals([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshNonce]);

  const visibleSignals = useMemo(() => {
    const filtered = signals.filter((signal) => {
      if (filter === "A+") return signal.grade === "A+";
      if (filter === "A") return signal.grade === "A";
      if (filter === "B+") return signal.grade === "B+";
      if (filter === "Long") return signal.side === "Long";
      if (filter === "Short") return signal.side === "Short";
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "confidence") return compareDescending(left.confidence, right.confidence);
      if (sortBy === "rank") return left.universeRank - right.universeRank;
      return compareDescending(left.score, right.score);
    });
  }, [filter, signals, sortBy]);

  const openChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg min-h-[520px] flex flex-col overflow-hidden">
      <div className="p-3 border-b border-zinc-800 bg-zinc-950/70 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Signal Engine Cards</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {status ? `${status.state} · Scanner ${status.scannerState}` : "Backend Signal Engine"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            disabled={loading}
            className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-[10px] font-bold flex items-center gap-1"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-[10px]">
          <Metric label="A+" value={status?.summary.aPlusSignals ?? 0} />
          <Metric label="A" value={status?.summary.aSignals ?? 0} />
          <Metric label="B+ Watch" value={status?.summary.bPlusWatch ?? 0} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <div className="flex flex-wrap gap-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`px-2 py-1 rounded text-[9px] font-bold ${filter === option ? "bg-orange-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[10px] text-zinc-500">
            <SlidersHorizontal size={11} />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
            >
              <option value="score">Score</option>
              <option value="confidence">Confidence</option>
              <option value="rank">Universe Rank</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error ? (
          <EmptyState title="Signal Engine unavailable" detail={error} />
        ) : loading ? (
          <EmptyState title="Loading signal cards" detail="Reading backend Signal Engine truth." />
        ) : visibleSignals.length === 0 ? (
          <EmptyState title="No card-eligible signals" detail="Only backend A+/A ACTIVE and B+ WATCH records appear here. No fake cards are created." />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {visibleSignals.map((signal) => {
              const isLong = signal.side === "Long";
              const isWatch = signal.lifecycle === "WATCH";
              const selected = selectedCandidateId === signal.candidateId;
              return (
                <article
                  key={signal.signalId}
                  onClick={() => selectCandidateId(signal.candidateId)}
                  className={`cursor-pointer rounded-lg border p-3 font-mono text-xs ${selected ? "border-orange-500 bg-orange-950/20 ring-1 ring-orange-600" : isWatch ? "border-amber-900/60 bg-amber-950/10" : isLong ? "border-emerald-900/50 bg-zinc-950" : "border-rose-900/50 bg-zinc-950"}`}
                  title="Select linked Scanner row"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-850 pb-2">
                    <div className="flex items-center gap-2">
                      <SymbolAvatar symbol={signal.symbol} className="w-7 h-7 text-[9px]" />
                      <div>
                        <div className="font-bold text-white">{signal.symbol}</div>
                        <div className="text-[9px] text-zinc-500">#{signal.universeRank} · {signal.setupName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <GradeBadge grade={signal.grade} className="text-[9px]" />
                      <div className={`mt-1 text-[9px] font-bold ${isWatch ? "text-amber-400" : "text-emerald-400"}`}>{signal.lifecycle}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 text-[10px]">
                    <Value label="Side" value={signal.side.toUpperCase()} />
                    <Value label="Score" value={Number.isFinite(signal.score) ? String(signal.score) : "Unavailable"} />
                    <Value label="Confidence" value={Number.isFinite(signal.confidence) ? `${signal.confidence}%` : "Unavailable"} />
                    <Value label="Entry State" value={signal.entryReady ? "READY" : "WATCH"} />
                    <Value label="Entry Trigger" value={formatNumber(signal.entryTriggerPrice, signal.entryTriggerPrice > 100 ? 2 : 4)} />
                    <Value label="Stop Loss" value={Number.isFinite(signal.stopLossPrice) ? formatNumber(signal.stopLossPrice, signal.stopLossPrice > 100 ? 2 : 4) : "Unavailable"} />
                    <Value label="TP / R:R" value="Unavailable" />
                    <Value label="Spread" value={`${formatNumber(signal.spreadBps, 2)} bps`} />
                  </div>

                  <div className="border-t border-zinc-850 pt-2 text-[10px]">
                    <div className="text-zinc-500 uppercase text-[9px]">Rationale</div>
                    <div className="text-zinc-300 mt-1 leading-relaxed">{signal.acceptedReasons[0] ?? "No backend rationale returned."}</div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-zinc-850 flex flex-col gap-1">
                    <button type="button" onClick={(event) => { event.stopPropagation(); openChart(signal.symbol); }} className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center justify-center gap-1 text-[10px]"><ChartLine size={11} /> Open Chart</button>
                    <div className="text-[8px] text-zinc-600 break-all">signal_id: {signal.signalId}</div>
                    <div className="text-[8px] text-zinc-600 break-all">candidate_id: {signal.candidateId}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
    <div className="text-zinc-500 uppercase">{label}</div>
    <div className="text-white font-bold text-sm mt-0.5">{value}</div>
  </div>
);

const Value: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-zinc-900/70 border border-zinc-850 rounded p-2">
    <div className="text-[8px] uppercase text-zinc-500">{label}</div>
    <div className="text-zinc-200 font-bold mt-0.5 break-words">{value}</div>
  </div>
);

const EmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div className="h-full min-h-[320px] flex items-center justify-center text-center font-mono px-6">
    <div>
      <div className="text-zinc-300 text-xs font-bold">{title}</div>
      <div className="text-zinc-600 text-[10px] mt-1 max-w-sm">{detail}</div>
    </div>
  </div>
);
