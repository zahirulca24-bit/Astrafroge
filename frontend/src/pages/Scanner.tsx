import React, { useEffect, useState } from "react";
import { useTrading } from "../store/TradingStore";
import { ScannerResult } from "../types";
import { GradeBadge, StatusBadge, SymbolAvatar } from "../components/SharedComponents";
import {
  Radar,
  Search,
  RefreshCw,
  Info,
  ShieldAlert,
  SlidersHorizontal,
  LineChart,
  PlusCircle,
  X
} from "lucide-react";

function compareFiniteDescending(left: number, right: number): number {
  if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
  if (!Number.isFinite(left)) return 1;
  if (!Number.isFinite(right)) return -1;
  return right - left;
}

function formatFinite(value: number, digits = 2): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "Unavailable";
}

export const Scanner: React.FC = () => {
  const {
    scannerResults,
    scannerStatus,
    scannerSummary,
    scannerHealth,
    triggerScan,
    triggerStopScanner,
    isScanning,
    setSelectedSymbol,
    setCurrentPage,
  } = useTrading();

  const [selectedRow, setSelectedRow] = useState<ScannerResult | null>(scannerResults[0] || null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sideFilter, setSideFilter] = useState<string>("All");
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("score"); // score, grade, volume, rr

  useEffect(() => {
    setSelectedRow((previous): ScannerResult | null => {
      if (scannerResults.length === 0) return null;
      if (!previous) return scannerResults[0] ?? null;
      return (
        scannerResults.find(
          (row) => row.symbol === previous.symbol && row.side === previous.side,
        ) ?? scannerResults[0] ?? null
      );
    });
  }, [scannerResults]);

  // Handle Scanning trigger
  const handleScanNow = () => {
    triggerScan();
  };

  // Filter Results
  const filteredResults = scannerResults.filter((item) => {
    const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSide = sideFilter === "All" || item.side === sideFilter;
    const matchesGrade = gradeFilter === "All" || item.grade === gradeFilter;
    
    let matchesStatus = true;
    if (statusFilter !== "All") {
      if (statusFilter === "Ready Now") matchesStatus = item.status === "Ready Now";
      else if (statusFilter === "Near Setup") matchesStatus = item.status === "Near Setup";
      else if (statusFilter === "Rejected") matchesStatus = item.status === "Rejected";
    }

    return matchesSearch && matchesSide && matchesGrade && matchesStatus;
  });

  // Sort Results
  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === "score") return compareFiniteDescending(a.score, b.score);
    if (sortBy === "rr") return compareFiniteDescending(a.riskReward, b.riskReward);
    if (sortBy === "volume") return compareFiniteDescending(a.volume24h, b.volume24h);
    if (sortBy === "grade") {
      const grades: Record<string, number> = { "A+": 4, "A": 3, "B+": 2, "Rejected": 1 };
      return (grades[b.grade] || 0) - (grades[a.grade] || 0);
    }
    return 0;
  });


  const handleOpenChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  const totalScanned = scannerSummary?.evaluatedSymbols ?? scannerResults.length;
  const readyCount = scannerSummary?.qualifiedCandidates ?? scannerResults.filter(r => r.status === "Ready Now").length;
  const nearCount = scannerResults.filter(r => r.status === "Near Setup").length;
  const rejectedCount =
    scannerResults.filter(r => r.status === "Rejected").length +
    Math.max(
      0,
      (scannerSummary?.discoveredCandidates ?? 0) -
        (scannerSummary?.selectedCandidates ?? scannerResults.length),
    );
  const scannerHealthLabel =
    scannerHealth === "Running"
      ? scannerStatus?.runActive
        ? "RUNNING"
        : "ON"
      : scannerHealth === "Off"
      ? "OFF"
      : "UNAVAILABLE";
  const scannerHealthClass =
    scannerHealth === "Running"
      ? "text-emerald-400"
      : scannerHealth === "Off"
      ? "text-amber-400"
      : "text-rose-500";
  const autoscanLabel = scannerStatus?.schedulerRunning ? "Enabled" : "Disabled";
  const scanButtonLabel =
    isScanning ? "WORKING..." : scannerStatus?.state === "OFF" ? "START SCANNER" : "SCAN NOW";
  const emptyTitle =
    scannerHealth === "Unavailable"
      ? "Scanner Engine is unavailable."
      : scannerStatus?.state === "OFF"
      ? "Scanner runtime is OFF."
      : "No active scanner candidates yet.";
  const emptyDescription =
    scannerHealth === "Unavailable"
      ? "Confirm the frontend base URL and backend scanner service health."
      : scannerStatus?.state === "OFF"
      ? "Use Start Scanner to enable the backend scheduler and trigger the initial full-universe scan."
      : "The scanner is connected. It simply has not produced any active candidates yet.";
  const latestAudits = scannerSummary?.audits?.slice(0, 4) ?? [];

  return (
    <div id="scanner-page" className="flex flex-col gap-4">
      {/* Scanner Diagnostic Stats Strip */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Radar className={scannerHealth === "Running" ? "text-emerald-400" : scannerHealth === "Off" ? "text-amber-400" : "text-rose-500"} size={16} />
          <span className="text-zinc-400">Scanner Engine Health:</span>
          <span className={`${scannerHealthClass} font-bold`}>{scannerHealthLabel}</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-500">AutoScan:</span>
          <span className={scannerStatus?.schedulerRunning ? "text-emerald-400" : "text-zinc-400"}>{autoscanLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-zinc-900/60 px-3 py-1 rounded border border-zinc-900 text-zinc-400">
            Total Scanned: <span className="text-white font-bold">{totalScanned}</span>
          </div>
          <div className="bg-emerald-950/40 px-3 py-1 rounded border border-emerald-900 text-emerald-400">
            Ready: <span className="font-bold">{readyCount}</span>
          </div>
          <div className="bg-amber-950/40 px-3 py-1 rounded border border-amber-900 text-amber-400">
            Near Setup: <span className="font-bold">{nearCount}</span>
          </div>
          <div className="bg-rose-950/40 px-3 py-1 rounded border border-rose-900 text-rose-400">
            Rejected: <span className="font-bold">{rejectedCount}</span>
          </div>
          <button
            onClick={handleScanNow}
            disabled={isScanning || scannerHealth === "Unavailable"}
            className="bg-orange-600 hover:bg-orange-700 active:scale-95 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
            <span>{scanButtonLabel}</span>
          </button>
          <button
            onClick={triggerStopScanner}
            disabled={isScanning || scannerStatus?.state !== "ON"}
            className="bg-zinc-800 hover:bg-rose-900/60 disabled:opacity-40 text-zinc-200 font-bold px-3 py-1.5 rounded transition-all"
          >
            STOP
          </button>
        </div>
      </div>

      {scannerSummary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Radar className="text-orange-400" size={15} />
              <span className="text-zinc-300 font-bold uppercase tracking-wider">Last Scan Result</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-zinc-400">
                Type: <span className="text-white">{scannerSummary.runType === "FULL_UNIVERSE_SCAN" ? "Full Scan" : "Refresh"}</span>
              </span>
              <span className={`px-2 py-1 rounded border ${
                scannerSummary.status === "COMPLETED"
                  ? "border-emerald-900 bg-emerald-950/30 text-emerald-400"
                  : scannerSummary.status === "DEGRADED"
                  ? "border-amber-900 bg-amber-950/30 text-amber-400"
                  : scannerSummary.status === "FAILED"
                  ? "border-rose-900 bg-rose-950/30 text-rose-400"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300"
              }`}>
                {scannerSummary.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mb-3">
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Evaluated</div>
              <div className="text-white font-bold text-sm">{scannerSummary.evaluatedSymbols}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Success</div>
              <div className="text-emerald-400 font-bold text-sm">{scannerSummary.successfulSymbols}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Failed</div>
              <div className="text-rose-400 font-bold text-sm">{scannerSummary.failedSymbols}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Detected</div>
              <div className="text-white font-bold text-sm">{scannerSummary.discoveredCandidates}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Selected</div>
              <div className="text-amber-400 font-bold text-sm">{scannerSummary.selectedCandidates}</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded p-2">
              <div className="text-zinc-500 text-[10px] uppercase">Ready</div>
              <div className="text-emerald-400 font-bold text-sm">{scannerSummary.qualifiedCandidates}</div>
            </div>
          </div>

          {latestAudits.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-850 rounded p-3">
              <div className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">
                Latest Scan Notes
              </div>
              <div className="space-y-2">
                {latestAudits.map((audit, index) => (
                  <div key={`${audit.code}-${index}`} className="flex flex-col gap-0.5 border-l-2 border-zinc-800 pl-3">
                    <span className="text-orange-400 font-bold text-[11px]">{audit.code}</span>
                    <span className="text-zinc-300 text-[11px]">{audit.detail}</span>
                    {(audit.symbol || audit.timeframe) && (
                      <span className="text-zinc-500 text-[10px]">
                        {[audit.symbol, audit.timeframe].filter(Boolean).join(" | ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap gap-3 items-center justify-between text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Symbol Search */}
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-2 text-zinc-500" size={13} />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 pl-8 text-white w-full placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
            <span className="text-zinc-500">Side:</span>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value)}
              className="bg-transparent border-0 text-zinc-300 font-mono text-xs focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Long">Long Only</option>
              <option value="Short">Short Only</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
            <span className="text-zinc-500">Grade:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="bg-transparent border-0 text-zinc-300 font-mono text-xs focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="A+">Grade A+</option>
              <option value="A">Grade A</option>
              <option value="B+">Grade B+</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
            <span className="text-zinc-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 text-zinc-300 font-mono text-xs focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Ready Now">Ready Now</option>
              <option value="Near Setup">Near Setup</option>
              <option value="Rejected">Rejected Setups</option>
            </select>
          </div>
        </div>

        {/* Sorting selection */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <span className="text-zinc-500">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 rounded text-zinc-300 px-2 py-1.5 font-mono text-xs focus:outline-none cursor-pointer"
          >
            <option value="score">Score (High-Low)</option>
            <option value="grade">Grade Rank</option>
            <option value="rr">Risk:Reward Ratio</option>
            <option value="volume">24h Trade Vol</option>
          </select>
        </div>
      </div>

      {/* Two-Column Grid: Left is main Table, Right is Selected Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scanner Table */}
        <div className={`bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden ${selectedRow && !isPanelCollapsed ? "lg:col-span-8" : selectedRow && isPanelCollapsed ? "lg:col-span-11" : "lg:col-span-12"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono relative">
              <thead className="bg-zinc-950 text-zinc-500 sticky top-0 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-2.5">Symbol</th>
                  <th className="py-2 px-2.5">Side</th>
                  <th className="py-2 px-2.5">Price</th>
                  <th className="py-2 px-2.5">1H Trend</th>
                  <th className="py-2 px-2.5">15M Setup</th>
                  <th className="py-2 px-2.5">5M Entry</th>
                  <th className="py-2 px-2.5">Grade</th>
                  <th className="py-2 px-2.5">Score</th>
                  <th className="py-2 px-2.5">R:R</th>
                  <th className="py-2 px-2.5">Status</th>
                  <th className="py-2 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60">
                {sortedResults.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Radar className="text-zinc-700" size={24} />
                        <span className="font-bold text-zinc-400">{emptyTitle}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{emptyDescription}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedResults.map((row) => {
                    const isSelected = selectedRow?.symbol === row.symbol && selectedRow?.side === row.side;
                    return (
                      <tr
                        key={`${row.symbol}-${row.side}`}
                        onClick={() => {
                          setSelectedRow(row);
                          setIsPanelCollapsed(false);
                        }}
                        className={`hover:bg-zinc-850/40 transition-colors cursor-pointer ${
                          isSelected ? "bg-orange-600/5 border-l-2 border-l-orange-500" : ""
                        }`}
                      >
                        <td className="py-1.5 px-2.5 font-bold text-white flex items-center gap-2">
                          <SymbolAvatar symbol={row.symbol} className="w-5 h-5 text-[9px]" />
                          <span>{row.symbol}</span>
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${row.side === "Long" ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
                            {row.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-zinc-300 font-bold font-mono tabular-nums">${formatFinite(row.currentPrice)}</td>
                        <td className="py-1.5 px-2.5 text-zinc-400 text-[11px] max-w-[100px] truncate" title={row.trend1h}>{row.trend1h}</td>
                        <td className="py-1.5 px-2.5 text-zinc-400 text-[11px] max-w-[100px] truncate" title={row.setup15m}>{row.setup15m}</td>
                        <td className="py-1.5 px-2.5 text-zinc-400 text-[11px] max-w-[100px] truncate" title={row.entry5m}>{row.entry5m}</td>
                        <td className="py-1.5 px-2.5"><GradeBadge grade={row.grade} className="text-[10px]" /></td>
                        <td className="py-1.5 px-2.5 text-white font-bold font-mono tabular-nums">{Number.isFinite(row.score) ? row.score : "N/A"}</td>
                        <td className="py-1.5 px-2.5 text-emerald-400 font-bold font-mono tabular-nums">{Number.isFinite(row.riskReward) ? `1:${row.riskReward.toFixed(1)}` : "Unavailable"}</td>
                        <td className="py-1.5 px-2.5"><StatusBadge status={row.status} className="text-[10px]" /></td>
                        <td className="py-1.5 px-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenChart(row.symbol)}
                              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1 rounded transition-colors"
                              title="Open inside main charts"
                            >
                              <LineChart size={13} />
                            </button>
                            {row.status === "Ready Now" && (
                              <button
                                disabled={true}
                                className="bg-zinc-850 text-zinc-600 p-1 rounded cursor-not-allowed"
                                title="Backend Signal Engine is not available yet."
                              >
                                <PlusCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collapsed Sidebar Strip */}
        {selectedRow && isPanelCollapsed && (
          <div
            onClick={() => setIsPanelCollapsed(false)}
            className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 hover:bg-zinc-850 cursor-pointer flex flex-col items-center justify-start py-4 gap-4 transition-all"
            title="Expand setup review panel"
          >
            <button className="text-zinc-400 hover:text-white font-bold text-xs">«</button>
            <div className="flex flex-col gap-1 items-center mt-4">
              {selectedRow.symbol.split("").map((char, i) => (
                <span key={i} className="text-[10px] font-bold font-mono text-zinc-400 leading-none">{char}</span>
              ))}
            </div>
          </div>
        )}

        {/* Selected Pair Panel (Selected Drawer) */}
        {selectedRow && !isPanelCollapsed && (
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 font-mono text-xs flex flex-col justify-between shadow-lg relative">
            
            {/* Close Inspect Button & Collapse button */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                onClick={() => setIsPanelCollapsed(true)}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 flex items-center gap-0.5 text-[10px] font-mono border border-zinc-800 px-1.5"
                title="Collapse Panel"
              >
                <span>Collapse »</span>
              </button>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-850"
                title="Close panel"
              >
                <X size={15} />
              </button>
            </div>

            {/* Header detail */}
            <div className="pb-2.5 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <SymbolAvatar symbol={selectedRow.symbol} className="w-5 h-5 text-[10px]" />
                <h3 className="text-xs font-bold text-white">{selectedRow.symbol} Setup Review</h3>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Scan Status:</span>
                <StatusBadge status={selectedRow.status} />
              </div>
            </div>

            {/* Technical analysis stats */}
            <div className="space-y-3 flex-1 mb-4">
              <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 rounded border border-zinc-850">
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Grade Score</span>
                  <div className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
                    <GradeBadge grade={selectedRow.grade} className="text-[10px]" />
                    <span>({Number.isFinite(selectedRow.score) ? `${selectedRow.score}/100` : "Unavailable"})</span>
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase block">Confidence</span>
                  <div className="text-sm font-bold text-orange-400 mt-0.5">{Number.isFinite(selectedRow.confidence) ? `${selectedRow.confidence}%` : "Unavailable"}</div>
                </div>
              </div>

              {/* Timeframes hierarchy alignment */}
              <div>
                <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Timeframe Hierarchy Checklist:</span>
                <div className="space-y-1.5 bg-zinc-950/50 p-2 rounded border border-zinc-850">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500 font-mono">1H Primary Trend (Regime):</span>
                    <span className="text-zinc-200 font-bold font-mono">{selectedRow.trend1h}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500 font-mono">15M Detection Setup:</span>
                    <span className="text-zinc-200 font-bold font-mono">{selectedRow.setup15m}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500 font-mono">5M Trigger Timing:</span>
                    <span className="text-orange-500 font-bold font-mono">{selectedRow.entry5m}</span>
                  </div>
                </div>
              </div>

              {/* Trade parameters plan */}
              <div>
                <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Proposed Execution Targets:</span>
                <div className="bg-zinc-950/60 border border-zinc-850 rounded p-2.5 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Entry Zone:</span>
                    <span className="text-emerald-400 font-bold">${selectedRow.entryZone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Stop Loss:</span>
                    <span className="text-rose-400 font-bold">${formatFinite(selectedRow.stopLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 1:</span>
                    <span className="text-zinc-300 font-bold">${formatFinite(selectedRow.tp1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 2:</span>
                    <span className="text-zinc-300 font-bold">${formatFinite(selectedRow.tp2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 3:</span>
                    <span className="text-zinc-300 font-bold">${formatFinite(selectedRow.tp3)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5 font-bold">
                    <span className="text-zinc-400">Risk Reward Ratio:</span>
                    <span className="text-orange-500">{Number.isFinite(selectedRow.riskReward) ? `1 : ${selectedRow.riskReward.toFixed(1)}` : "Unavailable"}</span>
                  </div>
                </div>
              </div>

              {/* Supporting reasons checklist */}
              <div>
                <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Setup Reasons:</span>
                <ul className="list-disc pl-4 space-y-1 text-zinc-300 text-[11px] leading-relaxed">
                  {selectedRow.setupReasons.length > 0 ? (
                    selectedRow.setupReasons.map((reason, idx) => <li key={idx}>{reason}</li>)
                  ) : (
                    <li className="text-zinc-500 italic">No positive reasons listed.</li>
                  )}
                </ul>
              </div>

              {/* Rejection / Warning reasons if exist */}
              {selectedRow.status === "Rejected" && selectedRow.rejectionReasons && (
                <div className="bg-rose-950/20 border border-rose-950 p-2.5 rounded">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[10px] uppercase mb-1">
                    <ShieldAlert size={12} />
                    <span>Setup Rejection Reasons:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-rose-300 text-[11px] leading-relaxed">
                    {selectedRow.rejectionReasons.map((reason, idx) => (
                      <li key={idx} className="font-semibold">{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRow.riskWarnings && selectedRow.riskWarnings.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-950 p-2.5 rounded">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase mb-1">
                    <Info size={12} />
                    <span>Risk Warnings:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-amber-300 text-[11px] leading-relaxed">
                    {selectedRow.riskWarnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions button */}
            <div className="flex gap-2.5 pt-3.5 border-t border-zinc-800">
              <button
                onClick={() => handleOpenChart(selectedRow.symbol)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-2 rounded transition-colors text-center block"
              >
                Open inside Chart
              </button>
              {selectedRow.status === "Ready Now" && (
                <button
                  disabled={true}
                  className="flex-1 bg-zinc-800 text-zinc-500 cursor-not-allowed font-bold py-2 rounded transition-colors text-center text-[10px]"
                >
                  Backend Signal Engine is not available yet.
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
