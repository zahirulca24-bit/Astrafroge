import React, { useState, useEffect } from "react";
import { useTrading } from "../store/TradingStore";
import { MetricCard } from "../components/SharedComponents";
import { backendService } from "../services/backendService";
import { DashboardMiniChart } from "../components/DashboardMiniChart";
import {
  AstraForgeBackendStatus,
  BinanceAccountConnectionStatus,
  DemoExecutionAccountSnapshot,
  DemoExecutionStatusSnapshot,
} from "../types/trading";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldAlert,
  Clock,
  Scan,
  RefreshCw,
  Radio,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function formatUsdt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unavailable";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

function formatSignedUsdt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${formatUsdt(value)}`;
}

const MarketTickerCard: React.FC<{ label: string; ticker?: { price: number; change24h: number } }> = ({ label, ticker }) => {
  const available = ticker && Number.isFinite(ticker.price) && Number.isFinite(ticker.change24h);
  const change = available ? ticker.change24h : null;
  return (
    <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-md flex items-center justify-between">
      <div>
        <span className="text-[10px] text-zinc-500 uppercase font-mono">{label}</span>
        <div className="text-base font-bold text-white font-mono mt-0.5">
          {available ? `$${ticker.price.toLocaleString()}` : "Unavailable"}
        </div>
      </div>
      <div className={`text-xs font-mono font-bold flex items-center gap-0.5 ${change === null ? "text-zinc-500" : change >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
        {change === null ? null : change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {change === null ? "No data" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const {
    settings,
    updateSettings,
    activeTrades,
    scannerResults,
    activities,
    symbols,
    marketStatus,
    backendHealth,
    universeSummary,
    selectedSymbolIndicators,
    indicatorsLoading,
    scannerStatus,
    scannerHealth,
    mutationBanner,
  } = useTrading();

  const [backendStatus, setBackendStatus] = useState<AstraForgeBackendStatus>("Not connected");
  const [accountStatus, setAccountStatus] = useState<BinanceAccountConnectionStatus>("Not configured");
  const [demoStatus, setDemoStatus] = useState<DemoExecutionStatusSnapshot | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<DemoExecutionAccountSnapshot | null>(null);
  const [isRiskCollapsed, setIsRiskCollapsed] = useState(false);
  const [isScannerCollapsed, setIsScannerCollapsed] = useState(false);
  const [isLogsCollapsed, setIsLogsCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadStatuses = async () => {
      const [bStatus, executionStatus, demoAccount] = await Promise.all([
        backendService.getBackendStatus(controller.signal),
        backendService.getDemoExecutionStatus(controller.signal),
        backendService.getDemoAccountSnapshot(controller.signal),
      ]);
      const resolvedAccountStatus = backendService.resolveAccountExecutionStatus(executionStatus, demoAccount);
      if (!active) return;
      setBackendStatus(bStatus);
      setDemoStatus(executionStatus);
      setAccountSnapshot(demoAccount);
      setAccountStatus(resolvedAccountStatus);
      updateSettings((previous) => ({
        ...previous,
        binance: {
          ...previous.binance,
          connected: resolvedAccountStatus === "Connected",
          balance: demoAccount?.totalWalletBalanceUsdt ?? previous.binance.balance,
          lastSync: demoAccount?.updatedAt ?? previous.binance.lastSync,
          permissionStatus: demoAccount
            ? [
                demoAccount.canTrade ? "Demo account can trade" : "Demo account read-only or locked",
                executionStatus?.executionEnabled ? "Execution flag enabled" : "Execution flag disabled",
              ]
            : [resolvedAccountStatus],
        },
      }));
    };
    void loadStatuses();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const activeCount = activeTrades.length;
  const btcTicker = symbols.find((symbol) => symbol.symbol === "BTCUSDT" && !symbol.stale);
  const ethTicker = symbols.find((symbol) => symbol.symbol === "ETHUSDT" && !symbol.stale);
  const totalMarginUsed = activeTrades.reduce((acc, trade) => acc + trade.marginUsed, 0);
  const localDailyLossLimit = settings.risk.dailyLossLimitPercent;
  const marketBreadth = universeSummary ? `${universeSummary.tradableSymbols}/${universeSummary.totalSymbols}` : "Unavailable";
  const primaryBias = selectedSymbolIndicators?.bias ?? selectedSymbolIndicators?.trend ?? "Unavailable";
  const rsiValue = selectedSymbolIndicators?.rsi14;
  const accountStatusClass = accountStatus === "Connected" ? "text-emerald-400" : accountStatus === "Error" ? "text-rose-500" : accountStatus === "Blocked" || accountStatus === "Not configured" ? "text-amber-400" : "text-zinc-500";
  const accountDotClass = accountStatus === "Connected" ? "bg-emerald-400 animate-pulse" : accountStatus === "Error" ? "bg-rose-500" : accountStatus === "Blocked" || accountStatus === "Not configured" ? "bg-amber-400" : "bg-zinc-650";
  const automationLabel = scannerHealth === "Running" ? (scannerStatus?.runActive ? "RUNNING" : "ON") : scannerHealth === "Off" ? "OFF" : "UNAVAILABLE";
  const automationClass = scannerHealth === "Running" ? "text-emerald-400" : scannerHealth === "Off" ? "text-amber-400" : "text-zinc-500";
  const demoOpenTrades = demoStatus?.summary.openTrades ?? activeCount;
  const openTradeLimit = demoStatus?.maxOpenTradesLimit ?? "Unavailable";
  const accountBalanceValue = accountSnapshot ? formatUsdt(accountSnapshot.totalWalletBalanceUsdt) : "Unavailable";
  const accountBalanceSubValue = accountSnapshot ? `Available Margin: ${formatUsdt(accountSnapshot.availableBalanceUsdt)}` : "Available Margin: Unavailable";
  const todayPnlValue = accountSnapshot ? formatSignedUsdt(accountSnapshot.totalUnrealizedPnlUsdt) : demoStatus ? formatSignedUsdt(demoStatus.combinedUnrealizedPnlUsdt) : "Unavailable";
  const todayPnlSubValue = accountSnapshot ? "Unrealized PnL from Binance Demo account" : "Realized PnL: Unavailable";

  return (
    <div id="dashboard-page" className="flex flex-col gap-4">
      {mutationBanner?.page === "Dashboard" && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-2 text-xs font-mono text-rose-300">
          <div className="font-bold text-rose-200">{mutationBanner.title}</div>
          <div className="mt-1">{mutationBanner.message}</div>
          <div className="mt-1 text-[10px] text-rose-400/90">
            {mutationBanner.code ? `${mutationBanner.code}${mutationBanner.statusCode ? ` (${mutationBanner.statusCode})` : ""}` : mutationBanner.statusCode ? `HTTP ${mutationBanner.statusCode}` : ""}
          </div>
        </div>
      )}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-zinc-500 font-bold">Live Status:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px]">Market Data:</span>
            <span className={`flex items-center gap-1 font-bold ${marketStatus === "Connected" ? "text-emerald-400" : marketStatus === "Degraded" ? "text-amber-400" : "text-rose-500"}`}>
              <span className={`w-2 h-2 rounded-full ${marketStatus === "Connected" ? "bg-emerald-400 animate-pulse" : marketStatus === "Degraded" ? "bg-amber-400" : "bg-rose-500"}`} />
              {marketStatus.toUpperCase()}
            </span>
          </div>
          <span className="text-zinc-800">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px]">AstraForge Backend:</span>
            <span className={`flex items-center gap-1 font-bold ${backendStatus === "Connected" ? "text-emerald-400" : "text-zinc-500"}`}>
              <span className={`w-2 h-2 rounded-full ${backendStatus === "Connected" ? "bg-emerald-400 animate-pulse" : "bg-zinc-650"}`} />
              {backendStatus.toUpperCase()}
            </span>
          </div>
          <span className="text-zinc-800">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px]">Account Data:</span>
            <span className={`flex items-center gap-1 font-bold ${accountStatusClass}`}>
              <span className={`w-2 h-2 rounded-full ${accountDotClass}`} />
              {accountStatus.toUpperCase()}
            </span>
          </div>
          <span className="text-zinc-800">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px]">Automation:</span>
            <span className={`font-bold ${automationClass}`}>{automationLabel}</span>
          </div>
        </div>
        <button disabled={scannerHealth === "Unavailable"} className="text-zinc-600 flex items-center gap-1 text-[11px] font-bold cursor-not-allowed" title="Scanner sync is controlled through the Start Scanner button">
          <RefreshCw size={12} />
          <span>SYNC {automationLabel}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Account Balance" value={accountBalanceValue} subValue={accountBalanceSubValue} />
        <MetricCard title="Today's PnL" value={todayPnlValue} subValue={todayPnlSubValue} />
        <MetricCard title="Open Trades" value={`${demoOpenTrades} / ${openTradeLimit}`} subValue={demoStatus ? "Backend Tracked" : "Locally Tracked"} />
        <MetricCard title="Win Rate (30D)" value="Unavailable" subValue="Performance: pending persistence" />
        <MetricCard title="Universe Coverage" value={marketBreadth} subValue={universeSummary ? `${universeSummary.quoteAssets.join(", ") || "Quote assets unavailable"}` : "Backend universe unavailable"} />
        <MetricCard title="Indicator Bias" value={indicatorsLoading ? "Loading..." : primaryBias} subValue={rsiValue !== undefined && rsiValue !== null ? `RSI 14: ${rsiValue.toFixed(2)}` : "Indicator endpoint unavailable"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5"><Activity size={14} className="text-orange-500" />Intraday Market Regime & Multi-Timeframe Trend</h2>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900 font-mono">{selectedSymbolIndicators?.trend ? `TREND: ${selectedSymbolIndicators.trend.toUpperCase()}` : "TREND: UNAVAILABLE"}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-800 pb-4 mb-4">
              <MarketTickerCard label="BTC/USDT" ticker={btcTicker} />
              <MarketTickerCard label="ETH/USDT" ticker={ethTicker} />
              <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-md flex flex-col justify-between text-xs font-mono"><div className="flex justify-between"><span className="text-zinc-500">Backend Health:</span><span className={`${backendHealth?.ok ? "text-emerald-400" : "text-rose-500"} font-bold`}>{backendHealth?.status?.toUpperCase() || "UNAVAILABLE"}</span></div><div className="flex justify-between"><span className="text-zinc-500">Tradable Universe:</span><span className="text-emerald-400 font-bold">{marketBreadth}</span></div></div>
            </div>
            <DashboardMiniChart />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3"><h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5"><Radio size={14} className="text-zinc-600" />Backend Universe Snapshot</h2></div>
            {universeSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono"><div className="bg-zinc-950 border border-zinc-900 rounded-md p-3"><div className="text-zinc-500 text-[10px] uppercase">Total Symbols</div><div className="text-white text-lg font-bold mt-1">{universeSummary.totalSymbols}</div></div><div className="bg-zinc-950 border border-zinc-900 rounded-md p-3"><div className="text-zinc-500 text-[10px] uppercase">Tradable Symbols</div><div className="text-white text-lg font-bold mt-1">{universeSummary.tradableSymbols}</div></div><div className="bg-zinc-950 border border-zinc-900 rounded-md p-3"><div className="text-zinc-500 text-[10px] uppercase">Source</div><div className="text-emerald-400 text-sm font-bold mt-1">{universeSummary.source ?? "Backend"}</div></div></div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono border border-dashed border-zinc-800 rounded-md p-4">Universe endpoint unavailable. Confirm backend deployment and CORS configuration.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="flex items-center justify-between mb-3"><h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5"><ShieldAlert size={14} className="text-zinc-500" />Risk Snapshot</h2><button onClick={() => setIsRiskCollapsed(!isRiskCollapsed)} className="text-zinc-500 hover:text-white">{isRiskCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div>{!isRiskCollapsed && <div className="space-y-2 text-xs font-mono"><div className="flex justify-between"><span className="text-zinc-500">Local Loss-Limit Preference</span><span className="text-rose-400">-{localDailyLossLimit}%</span></div><div className="flex justify-between"><span className="text-zinc-500">Margin Used</span><span className="text-white">{formatUsdt(totalMarginUsed)}</span></div><div className="flex justify-between"><span className="text-zinc-500">Risk Engine</span><span className={demoStatus ? "text-emerald-400" : "text-zinc-500"}>{demoStatus?.riskEngineState?.toUpperCase() ?? "UNAVAILABLE"}</span></div><div className="flex justify-between"><span className="text-zinc-500">Execution</span><span className={demoStatus?.executionEnabled ? "text-emerald-400" : "text-amber-400"}>{demoStatus?.executionEnabled ? "ENABLED" : "DISABLED"}</span></div></div>}</div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="flex items-center justify-between mb-3"><h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5"><Scan size={14} className="text-zinc-500" />Scanner Summary</h2><button onClick={() => setIsScannerCollapsed(!isScannerCollapsed)} className="text-zinc-500 hover:text-white">{isScannerCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div>{!isScannerCollapsed && <div className="space-y-2 text-xs font-mono"><div className="flex justify-between"><span className="text-zinc-500">Candidates</span><span className="text-white">{scannerHealth === "Unavailable" ? "Unavailable" : scannerResults.length}</span></div><div className="flex justify-between"><span className="text-zinc-500">Scanner</span><span className={automationClass}>{automationLabel}</span></div><div className="flex justify-between"><span className="text-zinc-500">Executable Plans</span><span className="text-emerald-400">{demoStatus ? demoStatus.summary.executablePlans : "Unavailable"}</span></div><div className="flex justify-between"><span className="text-zinc-500">Watch Plans</span><span className="text-amber-400">{demoStatus ? demoStatus.summary.watchPlans : "Unavailable"}</span></div></div>}</div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="flex items-center justify-between mb-3"><h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1.5"><Clock size={14} className="text-zinc-500" />Activity Log</h2><button onClick={() => setIsLogsCollapsed(!isLogsCollapsed)} className="text-zinc-500 hover:text-white">{isLogsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div>{!isLogsCollapsed && <div className="space-y-2 text-xs font-mono max-h-72 overflow-y-auto">{activities.length === 0 ? <div className="text-zinc-500 border border-dashed border-zinc-800 rounded-md p-3">No frontend activities yet.</div> : activities.slice(0, 8).map((activity) => <div key={activity.id} className="bg-zinc-950 border border-zinc-900 rounded-md p-2"><div className="text-zinc-500 text-[10px]">{activity.time} · {activity.type.toUpperCase()}</div><div className="text-zinc-300 mt-0.5">{activity.message}</div></div>)}</div>}</div>
        </div>
      </div>
    </div>
  );
};
