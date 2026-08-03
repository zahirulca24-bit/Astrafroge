import React, { useMemo, useState } from "react";
import { useTrading } from "../store/TradingStore";
import { JournalTrade, TradingGrade } from "../types";
import { GradeBadge, MetricCard, PnLValue, SymbolAvatar } from "../components/SharedComponents";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, Download, Filter, Search, X } from "lucide-react";

const DAY_MS = 86_400_000;
const GRADE_ORDER: TradingGrade[] = ["A+", "A", "B+", "N/A", "Rejected"];

function parseTradeDate(value: string): number | null {
  const timestamp = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatMoney(value: number): string {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const Journal: React.FC = () => {
  const { journalTrades, exportJournalCSV } = useTrading();
  const [dateFilter, setDateFilter] = useState<"7D" | "30D" | "ALL">("30D");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<JournalTrade | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"equity" | "grades" | "winloss">("equity");

  const strategies = useMemo(
    () => [...new Set(journalTrades.map((trade) => trade.strategy).filter(Boolean))].sort(),
    [journalTrades],
  );

  const filteredTrades = useMemo(() => {
    const now = Date.now();
    const lowerSearch = searchTerm.trim().toLowerCase();
    return journalTrades.filter((trade) => {
      const timestamp = parseTradeDate(trade.date);
      const withinDate =
        dateFilter === "ALL" ||
        (timestamp !== null && now - timestamp <= (dateFilter === "7D" ? 7 : 30) * DAY_MS);
      const matchesSearch =
        !lowerSearch ||
        trade.symbol.toLowerCase().includes(lowerSearch) ||
        trade.strategy.toLowerCase().includes(lowerSearch) ||
        trade.details.toLowerCase().includes(lowerSearch);
      const matchesStrategy = strategyFilter === "All" || trade.strategy === strategyFilter;
      return withinDate && matchesSearch && matchesStrategy;
    });
  }, [dateFilter, journalTrades, searchTerm, strategyFilter]);

  const metrics = useMemo(() => {
    const wins = filteredTrades.filter((trade) => trade.pnl > 0);
    const losses = filteredTrades.filter((trade) => trade.pnl < 0);
    const totalWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const netPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winRate = filteredTrades.length > 0 ? (wins.length / filteredTrades.length) * 100 : null;
    const avgR = filteredTrades.length > 0
      ? filteredTrades.reduce((sum, trade) => sum + trade.r, 0) / filteredTrades.length
      : null;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Number.POSITIVE_INFINITY : null;
    const best = filteredTrades.length > 0 ? Math.max(...filteredTrades.map((trade) => trade.pnl)) : null;
    const worst = filteredTrades.length > 0 ? Math.min(...filteredTrades.map((trade) => trade.pnl)) : null;
    return { wins, losses, totalWin, totalLoss, netPnl, winRate, avgR, profitFactor, best, worst };
  }, [filteredTrades]);

  const equityData = useMemo(() => {
    let cumulative = 0;
    return [...filteredTrades]
      .sort((a, b) => (parseTradeDate(a.date) ?? 0) - (parseTradeDate(b.date) ?? 0))
      .map((trade, index) => {
        cumulative += trade.pnl;
        return { trade: `${index + 1}. ${trade.symbol}`, cumulative: Number(cumulative.toFixed(2)) };
      });
  }, [filteredTrades]);

  const winLossData = useMemo(
    () => [
      { name: "Wins", value: metrics.wins.length, color: "#10b981" },
      { name: "Losses", value: metrics.losses.length, color: "#ef4444" },
    ].filter((item) => item.value > 0),
    [metrics.losses.length, metrics.wins.length],
  );

  const gradeData = useMemo(
    () => GRADE_ORDER.flatMap((grade) => {
      const trades = filteredTrades.filter((trade) => trade.grade === grade);
      if (trades.length === 0) return [];
      return [{
        grade,
        pnl: Number(trades.reduce((sum, trade) => sum + trade.pnl, 0).toFixed(2)),
        averageR: Number((trades.reduce((sum, trade) => sum + trade.r, 0) / trades.length).toFixed(2)),
      }];
    }),
    [filteredTrades],
  );

  const hasChartData = activeChartTab === "equity"
    ? equityData.length > 0
    : activeChartTab === "grades"
      ? gradeData.length > 0
      : winLossData.length > 0;

  return (
    <div id="journal-page" className="flex flex-col gap-4">
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <label className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800">
            <Calendar size={13} className="text-zinc-500" />
            <span className="text-zinc-400">Date Range:</span>
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as "7D" | "30D" | "ALL")} className="bg-transparent text-white focus:outline-none">
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="ALL">All History</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800">
            <Filter size={13} className="text-zinc-500" />
            <span className="text-zinc-400">Strategy:</span>
            <select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} className="bg-transparent text-white focus:outline-none">
              <option value="All">All Strategies</option>
              {strategies.map((strategy) => <option key={strategy} value={strategy}>{strategy}</option>)}
            </select>
          </label>
          <label className="relative w-52">
            <Search className="absolute left-2.5 top-2 text-zinc-500" size={13} />
            <input type="text" placeholder="Search journal…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-white w-full placeholder-zinc-600 focus:outline-none focus:border-zinc-700" />
          </label>
        </div>
        <button onClick={exportJournalCSV} disabled={journalTrades.length === 0} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded flex items-center gap-1.5">
          <Download size={13} /> EXPORT CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Net PnL" value={filteredTrades.length ? formatMoney(metrics.netPnl) : "Unavailable"} subValue="Filtered local journal" trend={metrics.netPnl > 0 ? "up" : metrics.netPnl < 0 ? "down" : "neutral"} />
        <MetricCard title="Win Rate" value={metrics.winRate === null ? "Unavailable" : `${metrics.winRate.toFixed(1)}%`} subValue={`${metrics.wins.length} wins / ${metrics.losses.length} losses`} />
        <MetricCard title="Profit Factor" value={metrics.profitFactor === null ? "Unavailable" : Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞"} subValue="Gross win / gross loss" />
        <MetricCard title="Average R" value={metrics.avgR === null ? "Unavailable" : `${metrics.avgR >= 0 ? "+" : ""}${metrics.avgR.toFixed(2)} R`} subValue="Filtered records" />
        <MetricCard title="Best Trade" value={metrics.best === null ? "Unavailable" : formatMoney(metrics.best)} subValue="Recorded journal PnL" />
        <MetricCard title="Worst Trade" value={metrics.worst === null ? "Unavailable" : formatMoney(metrics.worst)} subValue="Recorded journal PnL" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs">
        <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2.5 pb-2 border-b border-zinc-800">Closed Trade Records ({filteredTrades.length})</h2>
        {filteredTrades.length === 0 ? (
          <p className="text-zinc-500 py-8 text-center">No validated journal records match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-500 uppercase text-[9px] tracking-wider border-b border-zinc-800">
                <tr><th className="p-2.5">Date</th><th className="p-2.5">Symbol</th><th className="p-2.5">Side</th><th className="p-2.5">Grade</th><th className="p-2.5">Strategy</th><th className="p-2.5">PnL</th><th className="p-2.5">R</th><th className="p-2.5">Execution</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredTrades.map((trade) => (
                  <tr key={trade.id} onClick={() => setSelectedTrade(trade)} className="hover:bg-zinc-850/50 cursor-pointer">
                    <td className="p-2.5 text-zinc-400 whitespace-nowrap">{trade.date}</td>
                    <td className="p-2.5"><div className="flex items-center gap-2"><SymbolAvatar symbol={trade.symbol} /><span className="font-bold text-white">{trade.symbol}</span></div></td>
                    <td className={`p-2.5 font-bold ${trade.side === "Long" ? "text-emerald-400" : "text-rose-400"}`}>{trade.side}</td>
                    <td className="p-2.5"><GradeBadge grade={trade.grade} /></td>
                    <td className="p-2.5 text-zinc-300">{trade.strategy}</td>
                    <td className="p-2.5"><PnLValue value={trade.pnl} /></td>
                    <td className="p-2.5 text-zinc-300">{trade.r >= 0 ? "+" : ""}{trade.r.toFixed(2)} R</td>
                    <td className="p-2.5 text-zinc-500">{trade.executionStatus ?? "Unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Performance from filtered journal records</h2>
          <div className="flex gap-1 text-xs font-mono">
            {(["equity", "grades", "winloss"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveChartTab(tab)} className={`px-3 py-1.5 rounded ${activeChartTab === tab ? "bg-orange-600 text-white" : "bg-zinc-950 text-zinc-400 border border-zinc-800"}`}>{tab === "equity" ? "Cumulative PnL" : tab === "grades" ? "Grade PnL" : "Wins / Losses"}</button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {!hasChartData ? (
            <div className="h-full flex items-center justify-center border border-dashed border-zinc-800 rounded text-zinc-500 text-xs font-mono">No chart data is available for the selected filters.</div>
          ) : activeChartTab === "equity" ? (
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={equityData}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="trade" stroke="#71717a" /><YAxis stroke="#71717a" /><Tooltip /><Area type="monotone" dataKey="cumulative" stroke="#f97316" fill="#7c2d12" /></AreaChart></ResponsiveContainer>
          ) : activeChartTab === "grades" ? (
            <ResponsiveContainer width="100%" height="100%"><BarChart data={gradeData}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="grade" stroke="#71717a" /><YAxis stroke="#71717a" /><Tooltip /><Bar dataKey="pnl" fill="#f97316" /></BarChart></ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={winLossData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label>{winLossData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          )}
        </div>
        <p className="mt-3 text-[10px] text-zinc-500 font-mono">These metrics use only saved journal records. They do not claim exchange fills unless a record is marked as backend-managed.</p>
      </div>

      {selectedTrade && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedTrade(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-xl w-full p-5 font-mono text-xs" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><SymbolAvatar symbol={selectedTrade.symbol} /><div><div className="text-white font-bold">{selectedTrade.symbol} · {selectedTrade.side}</div><div className="text-zinc-500">{selectedTrade.date}</div></div></div><button onClick={() => setSelectedTrade(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button></div>
            <div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-zinc-950 border border-zinc-800 rounded p-3"><div className="text-zinc-500">Entry / Exit</div><div className="text-white mt-1">{selectedTrade.entry} / {selectedTrade.exit}</div></div><div className="bg-zinc-950 border border-zinc-800 rounded p-3"><div className="text-zinc-500">PnL / R</div><div className="mt-1"><PnLValue value={selectedTrade.pnl} /> · {selectedTrade.r.toFixed(2)} R</div></div></div>
            <div className="space-y-2 text-zinc-300"><p><span className="text-zinc-500">Strategy:</span> {selectedTrade.strategy}</p><p><span className="text-zinc-500">Exit reason:</span> {selectedTrade.exitReason}</p><p><span className="text-zinc-500">Execution:</span> {selectedTrade.executionStatus ?? "Unavailable"}</p><p className="leading-relaxed"><span className="text-zinc-500">Details:</span> {selectedTrade.details}</p></div>
          </div>
        </div>
      )}
    </div>
  );
};
