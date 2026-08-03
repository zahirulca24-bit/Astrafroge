import React, { useState } from "react";
import { useTrading } from "../store/TradingStore";
import { ActiveTrade } from "../types";
import { PnLValue, StatusBadge, SymbolAvatar, TradeProgress, EmptyState } from "../components/SharedComponents";
import { SlidersHorizontal, Clock, Shield, Trash2, ChartLine as LineChart, X } from "lucide-react";

export const ActiveTrades: React.FC = () => {
  const {
    activeTrades,
    closeTrade,
    settings,
    setCurrentPage,
    setSelectedSymbol,
    marketStatus,
  } = useTrading();

  const [filterSide, setFilterSide] = useState<string>("All"); // All, Long, Short
  const [filterGrade, setFilterGrade] = useState<string>("All"); // All, A+, A, B+
  const [sortBy, setSortBy] = useState<string>("pnl"); // pnl, duration

  // State to manage selected trade for detail drawer
  const [selectedTrade, setSelectedTrade] = useState<ActiveTrade | null>(activeTrades[0] || null);

  // State to manage close trade confirmation modal
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);

  // Calculate Metrics
  const openCount = activeTrades.length;
  const longCount = activeTrades.filter(t => t.side === "Long").length;
  const shortCount = activeTrades.filter(t => t.side === "Short").length;
  
  const totalUnrealizedPnL = marketStatus === "Disconnected"
    ? Number.NaN
    : activeTrades.reduce(
        (total, trade) => total + (Number.isFinite(trade.unrealizedPnL) ? trade.unrealizedPnL : 0),
        0,
      );
  const totalMarginUsed = activeTrades.reduce((acc, t) => acc + t.marginUsed, 0);

  const slotsAvailable = Math.max(0, settings.risk.maxOpenTrades - openCount);

  // Apply filters
  const filteredTrades = activeTrades.filter((t) => {
    const matchesSide = filterSide === "All" || t.side === filterSide;
    const matchesGrade = filterGrade === "All" || t.grade === filterGrade;
    return matchesSide && matchesGrade;
  });

  // Apply Sorting
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (sortBy === "pnl") {
      return b.unrealizedPnL - a.unrealizedPnL;
    }
    if (sortBy === "duration") {
      return b.duration.localeCompare(a.duration);
    }
    return 0;
  });

  const handleOpenChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCurrentPage("Chart & Watchlist");
  };

  const handleClosePositionClick = (id: string) => {
    setCloseConfirmId(id);
  };

  const confirmClosePosition = () => {
    if (closeConfirmId) {
      closeTrade(closeConfirmId, "Manual Market Exit");
      if (selectedTrade?.id === closeConfirmId) {
        setSelectedTrade(null);
      }
      setCloseConfirmId(null);
    }
  };

  return (
    <div id="active-trades-page" className="flex flex-col gap-4">
      {marketStatus !== "Connected" && activeTrades.length > 0 && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 font-mono text-[11px] text-amber-300">
          {marketStatus === "Disconnected"
            ? "Market data is unavailable. Per-trade prices shown below are the last validated local snapshots and are not live."
            : "Market data is degraded. Some per-trade prices may be last-known snapshots rather than current values."}
        </div>
      )}
      {/* Active Trades summary stats */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center font-mono text-xs select-none">
        <div className="bg-zinc-900 p-2 rounded">
          <div className="text-zinc-500 text-[10px] uppercase">Manual Demo Trades</div>
          <div className="text-base font-bold text-white mt-0.5">{openCount} / {settings.risk.maxOpenTrades}</div>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-900/40 p-2 rounded">
          <div className="text-emerald-400 text-[10px] uppercase">Long Demo</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">{longCount}</div>
        </div>
        <div className="bg-rose-950/30 border border-rose-900/40 p-2 rounded">
          <div className="text-rose-400 text-[10px] uppercase">Short Demo</div>
          <div className="text-base font-bold text-rose-500 mt-0.5">{shortCount}</div>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <div className="text-zinc-500 text-[10px] uppercase">
            {marketStatus === "Connected" ? "Combined Unrealized PnL" : "Combined Live PnL"}
          </div>
          <div className="mt-0.5">
            <PnLValue value={totalUnrealizedPnL} className="text-sm" />
          </div>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <div className="text-zinc-500 text-[10px] uppercase">Total Tracked Margin</div>
          <div className="text-base font-bold text-white mt-0.5">${totalMarginUsed.toFixed(2)} USDT</div>
        </div>
        <div className="bg-zinc-900 p-2 rounded">
          <div className="text-zinc-500 text-[10px] uppercase">Available Tracking Slots</div>
          <div className="text-base font-bold text-orange-400 mt-0.5">{slotsAvailable} slots</div>
        </div>
      </div>

      {/* Filters & Sorter bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {/* Side filter */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
            <span className="text-zinc-500">Side:</span>
            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              className="bg-transparent border-0 text-zinc-300 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="All">All Trades</option>
              <option value="Long">Long Only</option>
              <option value="Short">Short Only</option>
            </select>
          </div>

          {/* Grade filter */}
          <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1.5 border border-zinc-850 rounded">
            <span className="text-zinc-500">Min Grade:</span>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="bg-transparent border-0 text-zinc-300 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="All">All Grades</option>
              <option value="A+">A+ setups</option>
              <option value="A">A setups</option>
              <option value="B+">B+ watch setups</option>
            </select>
          </div>
        </div>

        {/* Sorter */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <span className="text-zinc-500">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 rounded text-zinc-300 px-2.5 py-1.5 font-mono text-xs focus:outline-none cursor-pointer"
          >
            <option value="pnl">Unrealized profit/loss</option>
            <option value="duration">Trade holding time</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column split for Active trades list & selected trade details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left column: Positions list */}
        <div className={`flex flex-col gap-3 ${selectedTrade ? "lg:col-span-8" : "lg:col-span-12"}`}>
          {sortedTrades.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <EmptyState
                title="No Active Trades Found"
                description="No trades are currently tracked. You can manually enter demo trades from the Chart page."
              />
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setCurrentPage("Signals")}
                  className="bg-orange-600 hover:bg-orange-700 font-mono font-bold text-xs text-white px-4 py-2 rounded transition-all"
                >
                  Explore Trade Signals »
                </button>
              </div>
            </div>
          ) : (
            sortedTrades.map((trade) => {
              const isSelected = selectedTrade?.id === trade.id;
              const isLong = trade.side === "Long";

              return (
                <div
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  className={`bg-zinc-900 border rounded-lg p-3 font-mono text-xs flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                    isSelected ? "border-orange-500 shadow-md bg-zinc-900/80" : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Title Bar */}
                  <div className="flex flex-wrap items-center justify-between pb-2 border-b border-zinc-850 mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      <SymbolAvatar symbol={trade.symbol} className="w-6 h-6 text-[10px]" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{trade.symbol}</span>
                          <span className={`px-1.5 py-0.5 text-[8.5px] font-bold rounded ${isLong ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}`}>
                            {trade.side.toUpperCase()} {trade.leverage}x
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-500">Strategy: {trade.setupName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[8px] text-zinc-500 uppercase block">Age</span>
                        <span className="text-zinc-300 flex items-center gap-0.5 text-[10px]">
                          <Clock size={10} className="text-zinc-500" />
                          {trade.duration}
                        </span>
                      </div>
                      <StatusBadge status={trade.status} className="text-[8.5px] font-bold px-1.5" />
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-zinc-950 p-2 rounded border border-zinc-850/60 mb-2.5 text-[11px]">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase block">Entry Price</span>
                      <span className="text-zinc-300 font-bold font-mono tabular-nums">${trade.entryPrice.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase block">Current Price</span>
                      <span className="text-white font-bold font-mono tabular-nums">${trade.currentPrice.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase block">Value</span>
                      <span className="text-zinc-300 font-bold font-mono tabular-nums">
                        {(trade.positionSize).toFixed(4)} {trade.symbol.replace("USDT", "")}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase block">Margin (Lev)</span>
                      <span className="text-zinc-300 font-bold font-mono tabular-nums">${trade.marginUsed} ({trade.leverage}x)</span>
                    </div>
                  </div>

                  {/* Progress slide bar indicator */}
                  <div className="mb-2.5">
                    <TradeProgress
                      side={trade.side}
                      entry={trade.entryPrice}
                      current={trade.currentPrice}
                      stopLoss={trade.stopLoss}
                      tp1={trade.tp1}
                      tp2={trade.tp2}
                      tp3={trade.tp3}
                      status={trade.status}
                    />
                  </div>

                  {/* Profit overlay and actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t border-zinc-850 gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 text-[9px] uppercase">Unrealized PnL:</span>
                      <PnLValue value={trade.unrealizedPnL} percent={trade.unrealizedPnLPercent} className="text-xs font-bold" />
                    </div>

                    <div className="flex gap-1.5 w-full sm:w-auto text-[10px]" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenChart(trade.symbol)}
                        className="flex-1 sm:flex-initial bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300 px-2.5 py-1 rounded transition-colors flex items-center justify-center gap-1 text-[10.5px]"
                      >
                        <LineChart size={11} />
                        <span>Chart</span>
                      </button>
                      <button
                        onClick={() => handleClosePositionClick(trade.id)}
                        className="flex-1 sm:flex-initial border border-rose-600/60 hover:border-rose-500 text-rose-400 hover:text-white px-2.5 py-1 rounded transition-colors flex items-center justify-center gap-1 text-[10.5px] font-semibold"
                      >
                        <Trash2 size={11} />
                        <span className="hidden sm:inline">Remove Trade</span>
                        <span className="sm:hidden">Remove</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Right column: Selected Trade Detail Drawer (Selected Row Panel) */}
        {selectedTrade && (
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs flex flex-col justify-between shadow-xl relative select-none">
            
            {/* Close detail view */}
            <button
              onClick={() => setSelectedTrade(null)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800"
            >
              <X size={15} />
            </button>

            {/* Header info */}
            <div className="pb-3 border-b border-zinc-800 mb-3.5">
              <div className="flex items-center gap-2 mb-1">
                <SymbolAvatar symbol={selectedTrade.symbol} className="w-6.5 h-6.5" />
                <h3 className="text-sm font-bold text-white">{selectedTrade.symbol} Trade Detail</h3>
              </div>
              <span className="text-[10px] text-zinc-500">ID: {selectedTrade.id}</span>
            </div>

            {/* Structured details */}
            <div className="space-y-4 flex-1 mb-4 overflow-y-auto pr-1">
              {/* Technical checks */}
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block mb-1">Trade Diagnostics:</span>
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Trigger Strategy:</span>
                    <span className="text-zinc-300 font-bold">{selectedTrade.setupName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Opened At:</span>
                    <span className="text-zinc-300">{selectedTrade.openedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Current R Multiple:</span>
                    <span className={`font-bold ${selectedTrade.currentRMultiple >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                      {selectedTrade.currentRMultiple >= 0 ? "+" : ""}{selectedTrade.currentRMultiple} R
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Source:</span>
                    <span className="text-orange-400 font-semibold">{selectedTrade.source || "Manual"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Mode:</span>
                    <span className="text-orange-400 font-semibold">{selectedTrade.mode || "Demo"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Execution Status:</span>
                    <span className="text-zinc-300">{selectedTrade.executionStatus || "Not Executed"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Signal Status:</span>
                    <span className="text-zinc-300">{selectedTrade.signalStatus || "Not Generated by Scanner"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Est. Exchange Fees:</span>
                    <span className="text-zinc-500 italic">{selectedTrade.exchangeFees || "Unavailable (Manual Demo)"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Funding Fees:</span>
                    <span className="text-zinc-500 italic">{selectedTrade.fundingFees || "Unavailable (Manual Demo)"}</span>
                  </div>
                </div>
              </div>

              {/* SL, TP modifications ledger */}
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block mb-1.5">Trade Targets Ledger:</span>
                <div className="bg-zinc-950/60 p-2.5 border border-zinc-850 rounded space-y-1 text-[11px]">
                  <div className="flex justify-between text-rose-400 font-semibold">
                    <span>Stop Loss Target:</span>
                    <span>${selectedTrade.stopLoss.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Take Profit Target 1:</span>
                    <span>${selectedTrade.tp1.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Take Profit Target 2:</span>
                    <span>${selectedTrade.tp2.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Take Profit Target 3:</span>
                    <span>${selectedTrade.tp3.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Bot Decisions Activities list */}
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block mb-1.5">Trade Audit Trail:</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {selectedTrade.timeline.map((evt, idx) => (
                    <div key={idx} className="bg-zinc-950 p-2 rounded border border-zinc-900 text-[11px] leading-relaxed">
                      <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5">
                        <span>{evt.time}</span>
                        <span className={`uppercase font-bold ${evt.type === "risk" ? "text-rose-400" : "text-orange-500"}`}>
                          [{evt.type}]
                        </span>
                      </div>
                      <p className="text-zinc-300">{evt.event}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signal rationale detail */}
              <div>
                <span className="text-zinc-500 text-[10px] uppercase block mb-1">Strategy Rationale:</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed bg-zinc-950/30 p-2 rounded border border-zinc-850/50">
                  {selectedTrade.history}
                </p>
              </div>
            </div>

            {/* Instant Exit buttons */}
            <div className="pt-3.5 border-t border-zinc-800">
              <button
                onClick={() => handleClosePositionClick(selectedTrade.id)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded transition-colors text-center"
              >
                Remove Trade
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {closeConfirmId && (() => {
        const tradeToClose = activeTrades.find(t => t.id === closeConfirmId);
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 font-mono text-xs">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-sm w-full p-4 space-y-3.5 shadow-2xl">
              <div className="flex items-center gap-2 text-rose-500 font-bold uppercase border-b border-zinc-800 pb-2">
                <Shield size={16} />
                <span className="text-xs">Confirm Trade Removal</span>
              </div>
              
              <p className="text-zinc-400 leading-relaxed text-[10.5px]">
                You are about to remove this tracked trade. It will be moved to the Journal for record keeping.
              </p>

              {tradeToClose && (
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850/80 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Asset Pair:</span>
                    <span className="text-white font-bold">{tradeToClose.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Trade Side:</span>
                    <span className={`font-bold uppercase ${tradeToClose.side === "Long" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tradeToClose.side} {tradeToClose.leverage}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Entry / Current:</span>
                    <span className="text-zinc-300 font-mono">${tradeToClose.entryPrice.toLocaleString()} / ${tradeToClose.currentPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
                    <span className="text-zinc-400 font-bold">Unrealized PnL:</span>
                    <PnLValue value={tradeToClose.unrealizedPnL} percent={tradeToClose.unrealizedPnLPercent} className="text-[11px] font-bold" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCloseConfirmId(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 rounded font-bold transition-all"
                >
                  Cancel Escape
                </button>
                <button
                  onClick={confirmClosePosition}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded font-bold transition-all border border-rose-500"
                >
                  Remove Now
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
