import React, { useMemo, useState } from "react";
import { useTrading } from "../store/TradingStore";
import { GradeBadge, SymbolAvatar } from "../components/SharedComponents";
import { SlidersHorizontal, ChartLine as LineChart } from "lucide-react";

const FILTER_OPTIONS = [
  ["All candidates", "All"],
  ["A+ priority", "A+"],
  ["A quality", "A"],
  ["B+ watch", "B+ Watch"],
  ["Long", "Long"],
  ["Short", "Short"],
] as const;

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "Unavailable";
}

export const Signals: React.FC = () => {
  const {
    scannerResults,
    scannerSummary,
    scannerHealth,
    setCurrentPage,
    setSelectedSymbol,
    settings,
  } = useTrading();

  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"score" | "rr" | "confidence">("score");

  const qualifiedSetups = scannerResults.filter((result) => result.grade !== "Rejected");
  const sortedSignals = useMemo(() => {
    const filtered = qualifiedSetups.filter((signal) => {
      if (activeFilter === "A+") return signal.grade === "A+";
      if (activeFilter === "A") return signal.grade === "A";
      if (activeFilter === "B+ Watch") return signal.grade === "B+";
      if (activeFilter === "Long") return signal.side === "Long";
      if (activeFilter === "Short") return signal.side === "Short";
      return true;
    });
    return [...filtered].sort((a, b) => {
      const left = sortBy === "rr" ? a.riskReward : sortBy === "confidence" ? a.confidence : a.score;
      const right = sortBy === "rr" ? b.riskReward : sortBy === "confidence" ? b.confidence : b.score;
      if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
      if (!Number.isFinite(left)) return 1;
      if (!Number.isFinite(right)) return -1;
      return right - left;
    });
  }, [activeFilter, qualifiedSetups, sortBy]);

  const totalCount = qualifiedSetups.length;
  const aPlusCount = qualifiedSetups.filter((signal) => signal.grade === "A+").length;
  const aCount = qualifiedSetups.filter((signal) => signal.grade === "A").length;
  const bPlusWatchCount = qualifiedSetups.filter((signal) => signal.grade === "B+").length;
  const backendRejectedCount = scannerResults.filter((signal) => signal.grade === "Rejected").length;
  const localRiskPreferenceBlocked = settings.risk.currentRiskStatus === "Blocked";
  const lastUpdated = scannerSummary?.completedAt ?? scannerSummary?.runStartedAt ?? null;

  const handleOpenChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  return (
    <div id="signals-page" className="flex flex-col gap-4">
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-center font-mono text-xs">
        <SummaryCard label="Qualified Candidates" value={totalCount} />
        <SummaryCard label="A+" value={aPlusCount} tone="emerald" />
        <SummaryCard label="A" value={aCount} tone="teal" />
        <SummaryCard label="B+ Watch" value={bPlusWatchCount} tone="amber" />
        <SummaryCard label="Rejected Returned" value={backendRejectedCount} />
        <SummaryCard label="Local Risk Preference" value={localRiskPreferenceBlocked ? "BLOCKED" : "NOT BLOCKED"} tone={localRiskPreferenceBlocked ? "rose" : "neutral"} />
        <div className="bg-zinc-900 p-2 rounded flex flex-col justify-center text-[10px] text-zinc-500 text-left pl-3 col-span-2 sm:col-span-1">
          <div>Scanner: {scannerHealth.toUpperCase()}</div>
          <div>Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Unavailable"}</div>
          <div>Candidate ID: {scannerResults[0]?.candidateId ?? "Unavailable"}</div>
        </div>
      </div>
      {scannerHealth === "Unavailable" && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 font-mono text-[11px] text-rose-300">
          Scanner data is unavailable from the backend.
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map(([label, value]) => (
            <button key={value} onClick={() => setActiveFilter(value)} className={`px-3 py-1.5 rounded transition-all ${activeFilter === value ? "bg-orange-600 text-white font-bold" : "bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <span className="text-zinc-500">Sort:</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "score" | "rr" | "confidence")} className="bg-zinc-950 border border-zinc-850 rounded text-zinc-300 px-2 py-1.5 focus:outline-none">
            <option value="score">Score</option>
            <option value="confidence">Confidence</option>
            <option value="rr">Risk / Reward</option>
          </select>
        </label>
      </div>

      {sortedSignals.length === 0 ? (
        <div className="py-12 text-center bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-zinc-500 font-mono text-xs font-bold">
            {scannerHealth === "Unavailable" ? "Scanner data is unavailable." : "No qualified scanner candidates are available."}
          </p>
          <p className="text-zinc-600 font-mono text-[10px] mt-1">No fabricated signal cards are displayed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedSignals.map((signal) => {
            const isLong = signal.side === "Long";
            const isWatch = signal.grade === "B+" || signal.status === "Near Setup";
            return (
              <article key={`${signal.symbol}-${signal.side}`} className={`bg-zinc-900 border rounded-lg p-3 font-mono text-xs flex flex-col justify-between ${isWatch ? "border-amber-950/80" : isLong ? "border-emerald-950/60" : "border-rose-950/60"}`}>
                <div>
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-850 mb-2">
                    <div className="flex items-center gap-1.5"><SymbolAvatar symbol={signal.symbol} className="w-6 h-6 text-[9px]" /><div><span className="font-bold text-white block">{signal.symbol}</span><span className="text-[9px] text-zinc-500">Scanner candidate</span></div></div>
                    <div className="flex items-center gap-1"><GradeBadge grade={signal.grade} className="text-[9px]" /><span className="text-[9px] text-zinc-400">{Number.isFinite(signal.score) ? signal.score : "N/A"}</span></div>
                  </div>

                  <div className="space-y-1 mb-2 bg-zinc-950 p-2 rounded border border-zinc-850 text-[10px]">
                    <Row label="1H trend" value={signal.trend1h} />
                    <Row label="15M setup" value={signal.setup15m} />
                    <Row label="5M entry" value={signal.entry5m} accent />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-2 bg-zinc-950/40 p-2 rounded border border-zinc-850 text-[10px]">
                    <ValueBlock label="Side" value={signal.side.toUpperCase()} className={isLong ? "text-emerald-400" : "text-rose-500"} />
                    <ValueBlock label="Current Price" value={Number.isFinite(signal.currentPrice) ? `$${formatNumber(signal.currentPrice)}` : "Unavailable"} />
                    <ValueBlock label="Entry Trigger" value={signal.entryZone || "Unavailable"} />
                    <ValueBlock label="R:R" value={Number.isFinite(signal.riskReward) ? `1 : ${signal.riskReward.toFixed(1)}` : "Unavailable"} className="text-emerald-400" />
                  </div>

                  <div className="border-t border-zinc-850 pt-1.5 mb-2 space-y-0.5 text-[10px]">
                    <PriceRow label="Stop Loss" value={signal.stopLoss} className="text-rose-400" />
                    <PriceRow label="TP1" value={signal.tp1} />
                    <PriceRow label="TP2" value={signal.tp2} />
                    <PriceRow label="TP3" value={signal.tp3} />
                  </div>
                  <div className="mb-2"><span className="text-zinc-500 text-[9px] block mb-0.5">RATIONALE</span><p className="text-zinc-400 text-[10px] leading-relaxed">{signal.setupReasons[0] ?? "No rationale returned."}</p></div>
                </div>

                <div className="pt-2 border-t border-zinc-850 flex flex-col gap-1">
                  <div className={`py-1 rounded text-center font-bold text-[9px] uppercase border ${signal.status === "Ready Now" ? "text-emerald-400 bg-emerald-950/20 border-emerald-900" : signal.status === "Near Setup" ? "text-amber-400 bg-amber-950/20 border-amber-900" : "text-zinc-500 bg-zinc-950 border-zinc-850"}`}>{signal.status}</div>
                  <button onClick={() => handleOpenChart(signal.symbol)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-1.5 rounded flex items-center justify-center gap-1 text-[10.5px]"><LineChart size={11} /> Open Chart</button>
                  <div className="text-[9px] text-zinc-500 pt-1">candidate_id: {signal.candidateId ?? "Unavailable"}</div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string | number; tone?: "neutral" | "emerald" | "teal" | "amber" | "rose" }> = ({ label, value, tone = "neutral" }) => {
  const classes = tone === "emerald" ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-400" : tone === "teal" ? "bg-teal-950/30 border-teal-900/60 text-teal-400" : tone === "amber" ? "bg-amber-950/30 border-amber-900/60 text-amber-400" : tone === "rose" ? "bg-rose-950/20 border-rose-900/50 text-rose-400" : "bg-zinc-900 border-transparent text-zinc-400";
  return <div className={`border p-2 rounded ${classes}`}><div className="text-[10px] uppercase">{label}</div><div className="text-base font-bold mt-0.5">{value}</div></div>;
};

const Row: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => <div className="flex justify-between items-center"><span className="text-zinc-500">{label}:</span><span className={`${accent ? "text-emerald-400" : "text-zinc-300"} font-bold truncate max-w-[135px]`} title={value}>{value}</span></div>;
const ValueBlock: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = "text-white" }) => <div><span className="text-zinc-500 text-[8px] uppercase">{label}</span><span className={`block font-bold mt-0.5 text-[10px] ${className}`}>{value}</span></div>;
const PriceRow: React.FC<{ label: string; value: number; className?: string }> = ({ label, value, className = "text-zinc-300" }) => <div className={`flex justify-between font-mono tabular-nums ${className}`}><span>{label}:</span><span>{Number.isFinite(value) ? `$${formatNumber(value)}` : "Unavailable"}</span></div>;
