import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Radar, RefreshCw, Search } from "lucide-react";

import { useTrading } from "../store/TradingStore";
import {
  ScannerTableRow,
  ScannerTableSnapshot,
  ScannerTableStatus,
  scannerTableService,
} from "../services/scannerTableService";
import { signalService } from "../services/signalService";
import {
  getSelectedCandidateId,
  selectCandidateId,
  subscribeCandidateSelection,
} from "../services/scannerSignalSelection";

const STATUS_LABEL: Record<ScannerTableStatus, string> = {
  READY: "Ready",
  NEAR_SETUP: "Near Setup",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

const STATUS_CLASS: Record<ScannerTableStatus, string> = {
  READY: "text-emerald-400 border-emerald-900 bg-emerald-950/30",
  NEAR_SETUP: "text-amber-400 border-amber-900 bg-amber-950/30",
  REJECTED: "text-rose-400 border-rose-900 bg-rose-950/25",
  FAILED: "text-red-300 border-red-900 bg-red-950/40",
};

function valueOrDash(value: number | null): string {
  return value === null ? "—" : String(value);
}

export const ScannerTablePanel: React.FC = () => {
  const {
    scannerStatus,
    scannerHealth,
    triggerScan,
    triggerStopScanner,
    isScanning,
    setSelectedSymbol,
    setCurrentPage,
    protectedControlsEnabled,
    protectedControlsReason,
  } = useTrading();

  const [snapshot, setSnapshot] = useState<ScannerTableSnapshot | null>(null);
  const [signalLinks, setSignalLinks] = useState<Map<string, string>>(new Map());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => getSelectedCandidateId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [side, setSide] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [strategy, setStrategy] = useState("ALL");
  const [sort, setSort] = useState("RANK");

  useEffect(() => subscribeCandidateSelection(setSelectedCandidateId), []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await scannerTableService.getLatest();
        if (!active) return;
        setSnapshot(next);
        setError(null);
      } catch (cause) {
        if (!active) return;
        setSnapshot(null);
        setError(cause instanceof Error ? cause.message : "Scanner table unavailable");
      } finally {
        if (active) setLoading(false);
      }
      try {
        const links = await signalService.getLinks();
        if (active) setSignalLinks(links);
      } catch {
        if (active) setSignalLinks(new Map());
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const strategies = useMemo(
    () => [...new Set((snapshot?.rows ?? []).map((row) => row.setupName).filter((item): item is string => Boolean(item)))].sort(),
    [snapshot],
  );

  const rows = useMemo(() => {
    const query = search.trim().toUpperCase();
    const filtered = (snapshot?.rows ?? []).filter((row) => {
      if (query && !row.symbol.includes(query)) return false;
      if (side !== "ALL" && row.direction !== side) return false;
      if (status !== "ALL" && row.status !== status) return false;
      if (strategy !== "ALL" && row.setupName !== strategy) return false;
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (sort === "SCORE") return (right.score ?? -1) - (left.score ?? -1) || left.universeRank - right.universeRank;
      if (sort === "CONFIDENCE") return (right.confidence ?? -1) - (left.confidence ?? -1) || left.universeRank - right.universeRank;
      if (sort === "STATUS") return left.status.localeCompare(right.status) || left.universeRank - right.universeRank;
      return left.universeRank - right.universeRank;
    });
  }, [search, side, snapshot, sort, status, strategy]);

  const openChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  const scanLabel = isScanning ? "WORKING..." : scannerStatus?.state === "OFF" ? "START SCANNER" : "SCAN NOW";

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Radar size={15} className="text-orange-400" />
          <div>
            <div className="font-bold uppercase tracking-wider text-zinc-200">Scanner Table</div>
            <div className="text-[10px] text-zinc-500">Backend authoritative latest full-universe evaluation</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={scannerHealth === "Running" ? "text-emerald-400" : scannerHealth === "Off" ? "text-amber-400" : "text-rose-400"}>
            {scannerHealth.toUpperCase()}
          </span>
          <button
            onClick={triggerScan}
            disabled={isScanning || scannerHealth === "Unavailable" || !protectedControlsEnabled}
            title={protectedControlsEnabled ? "Run scanner" : protectedControlsReason}
            className="flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1.5 font-bold text-white disabled:opacity-40"
          >
            <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} /> {scanLabel}
          </button>
          <button
            onClick={triggerStopScanner}
            disabled={isScanning || scannerStatus?.state !== "ON" || !protectedControlsEnabled}
            className="rounded bg-zinc-800 px-2.5 py-1.5 font-bold text-zinc-200 disabled:opacity-40"
          >
            STOP
          </button>
        </div>
      </div>

      {snapshot && (
        <div className="grid grid-cols-5 gap-2">
          <Metric label="Total" value={snapshot.summary.total} />
          <Metric label="Ready" value={snapshot.summary.ready} />
          <Metric label="Near" value={snapshot.summary.nearSetup} />
          <Metric label="Rejected" value={snapshot.summary.rejected} />
          <Metric label="Failed" value={snapshot.summary.failed} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded border border-zinc-800 bg-zinc-950/60 p-2">
        <label className="relative min-w-36 flex-1">
          <Search size={12} className="absolute left-2 top-2 text-zinc-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" className="w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 pl-7 pr-2 text-zinc-200 outline-none" />
        </label>
        <Select value={side} onChange={setSide} options={["ALL", "LONG", "SHORT"]} />
        <Select value={status} onChange={setStatus} options={["ALL", "READY", "NEAR_SETUP", "REJECTED", "FAILED"]} />
        <select value={strategy} onChange={(event) => setStrategy(event.target.value)} className="rounded border border-zinc-800 bg-zinc-950 px-2 text-zinc-300">
          <option value="ALL">All strategies</option>
          {strategies.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Select value={sort} onChange={setSort} options={["RANK", "SCORE", "CONFIDENCE", "STATUS"]} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-zinc-800">
        <table className="w-full min-w-[1050px] border-collapse text-[10px]">
          <thead className="sticky top-0 z-10 bg-zinc-950 text-left uppercase tracking-wide text-zinc-500">
            <tr>
              {["#", "Symbol", "Side", "1H Trend", "15M Setup", "5M Entry", "Strategy", "Score", "Confidence", "R:R", "Status", "Reason", "Chart"].map((label) => <th key={label} className="border-b border-zinc-800 px-2 py-2">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ScannerRow
                key={`${snapshot?.summary.runId}-${row.universeRank}-${row.symbol}`}
                row={row}
                openChart={openChart}
                linked={Boolean(row.candidateId && signalLinks.has(row.candidateId))}
                selected={Boolean(row.candidateId && row.candidateId === selectedCandidateId)}
                onSelect={() => row.candidateId && signalLinks.has(row.candidateId) && selectCandidateId(row.candidateId)}
              />
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="p-10 text-center text-zinc-500">{error ?? "No scanner rows match the current filters."}</div>
        )}
        {loading && <div className="p-10 text-center text-zinc-500">Loading scanner table…</div>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-zinc-600">
        <span>Rows shown: {rows.length}{snapshot ? ` / ${snapshot.summary.total}` : ""}</span>
        <span>{snapshot ? `Run ${snapshot.summary.runId.slice(0, 12)} · ${snapshot.summary.runStatus}` : error ?? "Waiting for backend"}</span>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center">
    <div className="text-[9px] uppercase text-zinc-500">{label}</div>
    <div className="mt-0.5 text-sm font-bold text-zinc-100">{value}</div>
  </div>
);

const Select: React.FC<{ value: string; onChange: (value: string) => void; options: string[] }> = ({ value, onChange, options }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-zinc-800 bg-zinc-950 px-2 text-zinc-300">
    {options.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}
  </select>
);

const ScannerRow: React.FC<{
  row: ScannerTableRow;
  openChart: (symbol: string) => void;
  linked: boolean;
  selected: boolean;
  onSelect: () => void;
}> = ({ row, openChart, linked, selected, onSelect }) => (
  <tr
    onClick={linked ? onSelect : undefined}
    className={`border-b border-zinc-850 ${selected ? "bg-orange-950/35 outline outline-1 outline-orange-700" : "bg-zinc-900/60 hover:bg-zinc-800/60"} ${linked ? "cursor-pointer" : ""}`}
    title={linked ? "Select linked Signal card" : undefined}
  >
    <td className="px-2 py-2 text-zinc-500">{row.universeRank}</td>
    <td className="px-2 py-2 font-bold text-white">{row.symbol}</td>
    <td className={row.direction === "LONG" ? "px-2 py-2 text-emerald-400" : row.direction === "SHORT" ? "px-2 py-2 text-rose-400" : "px-2 py-2 text-zinc-500"}>{row.direction ?? "—"}</td>
    <td className="px-2 py-2 text-zinc-300">{row.trend1h}</td>
    <td className="max-w-36 truncate px-2 py-2 text-zinc-300" title={row.setup15m}>{row.setup15m}</td>
    <td className="px-2 py-2 text-zinc-300">{row.entry5m}</td>
    <td className="max-w-36 truncate px-2 py-2 text-zinc-300" title={row.setupName ?? ""}>{row.setupName ?? "—"}</td>
    <td className="px-2 py-2 text-zinc-200">{valueOrDash(row.score)}</td>
    <td className="px-2 py-2 text-zinc-200">{row.confidence === null ? "—" : `${row.confidence}%`}</td>
    <td className="px-2 py-2 text-zinc-500">—</td>
    <td className="px-2 py-2"><span className={`rounded border px-1.5 py-0.5 font-bold ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span></td>
    <td className="max-w-64 px-2 py-2 text-zinc-400" title={row.primaryReason ?? row.primaryReasonCode ?? ""}>{row.primaryReason ?? row.primaryReasonCode ?? "—"}</td>
    <td className="px-2 py-2"><button onClick={(event) => { event.stopPropagation(); openChart(row.symbol); }} className="rounded bg-zinc-800 p-1.5 text-zinc-300 hover:text-white" title={`Open ${row.symbol} chart`}><LineChart size={12} /></button></td>
  </tr>
);
