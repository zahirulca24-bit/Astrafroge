import React, { useState } from "react";
import { useTrading, NavigationPage } from "../store/TradingStore";
import {
  LayoutDashboard,
  Radar,
  Radio,
  LineChart,
  Activity,
  BookOpen,
  Settings,
  ShieldAlert,
  RefreshCw,
  Bell,
  Menu,
  X,
  Play,
  Pause,
  AlertCircle
} from "lucide-react";

// MetricCard Component
interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendText?: string;
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subValue, trend, trendText, id }) => {
  return (
    <div
      id={id || `metric-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex flex-col justify-between shadow-sm hover:border-zinc-700 transition-colors"
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
        {trend && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
              trend === "up"
                ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                : trend === "down"
                ? "bg-rose-950 text-rose-400 border border-rose-900"
                : "bg-zinc-850 text-zinc-400 border border-zinc-800"
            }`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"} {trendText}
          </span>
        )}
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight text-white font-mono">{value}</div>
        {subValue && <div className="text-[11px] text-zinc-500 mt-0.5 font-mono">{subValue}</div>}
      </div>
    </div>
  );
};

// PnLValue Component
export const PnLValue: React.FC<{ value: number; percent?: number; isPrefix?: boolean; className?: string }> = ({
  value,
  percent,
  isPrefix = true,
  className = ""
}) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return (
      <span className={`font-mono font-semibold text-zinc-500 ${className}`}>
        Unavailable
      </span>
    );
  }
  const isPositive = value >= 0;
  return (
    <span
      className={`font-mono font-semibold tabular-nums ${
        isPositive ? "text-emerald-400" : "text-rose-500"
      } ${className}`}
    >
      {isPrefix && (isPositive ? "+" : "")}
      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
      {percent !== undefined && !Number.isNaN(percent) && (
        <span className={`text-xs ml-1 font-medium ${isPositive ? "text-emerald-500" : "text-rose-600"}`}>
          ({isPositive ? "+" : ""}
          {percent.toFixed(2)}%)
        </span>
      )}
    </span>
  );
};

// GradeBadge Component
export const GradeBadge: React.FC<{ grade: string; className?: string }> = ({ grade, className = "" }) => {
  let badgeStyles = "bg-zinc-850 text-zinc-300 border-zinc-800";
  if (grade === "A+") {
    badgeStyles = "bg-emerald-950 text-emerald-400 border-emerald-900 font-bold";
  } else if (grade === "A") {
    badgeStyles = "bg-teal-950 text-teal-400 border-teal-900 font-bold";
  } else if (grade === "B+") {
    badgeStyles = "bg-amber-950 text-amber-400 border-amber-900 font-semibold";
  } else if (grade === "Rejected") {
    badgeStyles = "bg-zinc-900 text-zinc-500 border-zinc-800 line-through decoration-zinc-600";
  }

  return (
    <span
      className={`px-2 py-0.5 text-xs font-mono rounded border ${badgeStyles} uppercase tracking-wider ${className}`}
    >
      {grade}
    </span>
  );
};

// StatusBadge Component
export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = "" }) => {
  let style = "bg-zinc-900 text-zinc-400 border-zinc-800";
  if (["Ready Now", "Open", "Connected", "Active", "TP3 Hit", "Running", "Safe"].includes(status)) {
    style = "bg-emerald-950 text-emerald-400 border-emerald-900";
  } else if (["Near Setup", "Pending", "Submitted", "TP1 Hit", "TP2 Hit", "Breakeven Protected", "Paused", "Warning"].includes(status)) {
    style = "bg-amber-950 text-amber-400 border-amber-900";
  } else if (["Rejected", "Stop Loss Hit", "Disconnected", "Blocked", "Risk Engine Closed", "Danger"].includes(status)) {
    style = "bg-rose-950 text-rose-400 border-rose-900";
  } else if (["Closed", "Manually Closed"].includes(status)) {
    style = "bg-zinc-850 text-zinc-400 border-zinc-800";
  }

  return (
    <span className={`px-2 py-0.5 text-[11px] font-mono rounded border inline-block ${style} ${className}`}>
      {status}
    </span>
  );
};

// SymbolAvatar Component
export const SymbolAvatar: React.FC<{ symbol: string; className?: string }> = ({ symbol, className = "" }) => {
  const baseAsset = symbol.replace("USDT", "");
  return (
    <div
      className={`w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-xs font-bold text-zinc-200 select-none ${className}`}
    >
      {baseAsset.substring(0, 3)}
    </div>
  );
};

// TradeProgress Component
export const TradeProgress: React.FC<{
  side: "Long" | "Short";
  entry: number;
  current: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  status: string;
}> = ({ side, entry, current, stopLoss, tp1, tp2, tp3, status }) => {
  const isLong = side === "Long";
  
  // High contrast checks
  const tp1Hit = isLong ? current >= tp1 : current <= tp1;
  const tp2Hit = isLong ? current >= tp2 : current <= tp2;
  const tp3Hit = isLong ? current >= tp3 : current <= tp3;
  const denominator = isLong ? (tp3 - stopLoss) : (stopLoss - tp3);
  
  const getPercentage = (price: number) => {
    if (denominator === 0) return 50;
    const val = isLong ? (price - stopLoss) : (stopLoss - price);
    return Math.min(Math.max((val / denominator) * 100, 0), 100);
  };

  const entryPct = getPercentage(entry);
  const currentPct = getPercentage(current);
  const tp1Pct = getPercentage(tp1);
  const tp2Pct = getPercentage(tp2);

  // Profit vs loss color logic
  const isProfit = isLong ? current >= entry : current <= entry;
  const fillLeft = Math.min(entryPct, currentPct);
  const fillWidth = Math.abs(currentPct - entryPct);

  // Distances
  const distToSLPercent = ((Math.abs(current - stopLoss)) / current) * 100;
  
  let nextTargetLabel = "TP1";
  let nextTargetPrice = tp1;
  if (isLong) {
    if (current >= tp2) { nextTargetLabel = "TP3"; nextTargetPrice = tp3; }
    else if (current >= tp1) { nextTargetLabel = "TP2"; nextTargetPrice = tp2; }
  } else {
    if (current <= tp2) { nextTargetLabel = "TP3"; nextTargetPrice = tp3; }
    else if (current <= tp1) { nextTargetLabel = "TP2"; nextTargetPrice = tp2; }
  }
  const distToTPPercent = ((Math.abs(current - nextTargetPrice)) / current) * 100;

  return (
    <div className="w-full bg-zinc-950 border border-zinc-900 rounded-lg p-2 flex flex-col gap-1.5 font-mono text-[11px] select-none">
      {/* Top markers labels */}
      <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
        <span className="text-rose-400 font-bold">SL: ${stopLoss.toLocaleString()}</span>
        <span className="text-zinc-400">ENTRY: ${entry.toLocaleString()}</span>
        <span className={tp1Hit ? "text-emerald-400 font-bold" : "text-zinc-500"}>TP1: ${tp1.toLocaleString()}</span>
        <span className={tp2Hit ? "text-emerald-400 font-bold" : "text-zinc-500"}>TP2: ${tp2.toLocaleString()}</span>
        <span className={tp3Hit ? "text-emerald-400 font-bold" : "text-zinc-500"}>TP3: ${tp3.toLocaleString()}</span>
      </div>

      {/* Progress Track */}
      <div className="relative h-1.5 bg-zinc-900 rounded-full my-1.5 border border-zinc-850">
        {/* Dynamic Profit/Loss Fill */}
        <div
          className={`absolute h-full rounded-full ${isProfit ? "bg-emerald-500/80" : "bg-rose-500/80"}`}
          style={{
            left: `${fillLeft}%`,
            width: `${Math.max(fillWidth, 1.5)}%`
          }}
        />

        {/* Marker Dots */}
        {/* SL at 0% */}
        <div 
          className="absolute w-2 h-2 rounded-full bg-rose-600 border border-black -top-0.5" 
          style={{ left: `calc(0% - 4px)` }} 
          title={`Stop Loss: $${stopLoss}`} 
        />
        {/* Entry */}
        <div 
          className="absolute w-2 h-2 rounded-full bg-zinc-400 border border-black -top-0.5" 
          style={{ left: `calc(${entryPct}% - 4px)` }} 
          title={`Entry Price: $${entry}`} 
        />
        {/* TP1 */}
        <div 
          className={`absolute w-2 h-2 rounded-full border border-black -top-0.5 ${tp1Hit ? "bg-emerald-400" : "bg-zinc-700"}`} 
          style={{ left: `calc(${tp1Pct}% - 4px)` }} 
          title={`TP1: $${tp1}`} 
        />
        {/* TP2 */}
        <div 
          className={`absolute w-2 h-2 rounded-full border border-black -top-0.5 ${tp2Hit ? "bg-emerald-400" : "bg-zinc-700"}`} 
          style={{ left: `calc(${tp2Pct}% - 4px)` }} 
          title={`TP2: $${tp2}`} 
        />
        {/* TP3 at 100% */}
        <div 
          className={`absolute w-2 h-2 rounded-full border border-black -top-0.5 ${tp3Hit ? "bg-emerald-400" : "bg-zinc-700"}`} 
          style={{ left: `calc(100% - 4px)` }} 
          title={`TP3: $${tp3}`} 
        />

        {/* Current Price Marker */}
        <div 
          className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white -top-[3px] shadow-sm animate-pulse ${isProfit ? "bg-emerald-400" : "bg-rose-500"}`}
          style={{ left: `calc(${currentPct}% - 5px)` }}
          title={`Current Price: $${current}`}
        />
      </div>

      {/* Info labels underneath */}
      <div className="flex justify-between items-center text-[9px] text-zinc-500 mt-0.5">
        <div className="flex gap-2">
          <span>Current: <span className="text-zinc-200 font-bold font-mono">${current.toLocaleString()}</span></span>
          <span className="text-zinc-600">|</span>
          <span>To SL: <span className="text-rose-400 font-mono">{distToSLPercent.toFixed(1)}%</span></span>
          <span className="text-zinc-600">|</span>
          <span>To {nextTargetLabel}: <span className="text-emerald-400 font-mono">{distToTPPercent.toFixed(1)}%</span></span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <span>Lifecycle:</span>
          <StatusBadge status={status} className="text-[8px] py-0 px-1 font-bold" />
        </div>
      </div>
    </div>
  );
};

// EmptyState Component
export const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-zinc-800 rounded-lg text-center bg-zinc-900/40">
      <AlertCircle className="w-10 h-10 text-zinc-600 mb-3" />
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-sm">{description}</p>
    </div>
  );
};

// LoadingSkeleton Component
export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-zinc-900 border border-zinc-800 rounded-md w-full" />
      ))}
    </div>
  );
};

// Sidebar Layout
export const AppSidebar: React.FC = () => {
  const { currentPage, setCurrentPage, settings, scannerStatus, scannerHealth } = useTrading();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const scannerStatusText =
    scannerHealth === "Running"
      ? scannerStatus?.runActive
        ? "RUNNING"
        : "ON"
      : scannerHealth === "Off"
      ? "OFF"
      : "UNAVAILABLE";
  const scannerStatusClass =
    scannerHealth === "Running"
      ? "bg-emerald-950 text-emerald-400 border-emerald-900"
      : scannerHealth === "Off"
      ? "bg-amber-950 text-amber-400 border-amber-900"
      : "bg-zinc-900 text-zinc-500 border-zinc-800";

  const menuItems: { name: NavigationPage; icon: React.ReactNode }[] = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { name: "Scanner", icon: <Radar size={18} /> },
    { name: "Signals", icon: <Radio size={18} /> },
    { name: "Chart & Watchlist", icon: <LineChart size={18} /> },
    { name: "Active Trades", icon: <Activity size={18} /> },
    { name: "Journal", icon: <BookOpen size={18} /> },
    { name: "Settings", icon: <Settings size={18} /> }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-900 p-3 select-none">
      {/* Header / Logo */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-black text-sm">
            AF
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">ASTRAFORGE</span>
              <span className="text-[9px] text-zinc-500 font-mono">Crypto Intraday Bot</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block text-zinc-500 hover:text-white rounded p-1 hover:bg-zinc-900 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentPage === item.name;
          return (
            <button
              key={item.name}
              onClick={() => {
                setCurrentPage(item.name);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium font-mono transition-all duration-150 group relative ${
                isActive
                  ? "bg-orange-600/10 text-orange-500 border-l-2 border-orange-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              {item.icon}
              {!isCollapsed && <span>{item.name}</span>}

              {/* Tooltip on collapse */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-zinc-800">
                  {item.name}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bot Controls & Bottom Meta */}
      <div className="pt-4 border-t border-zinc-900 space-y-3">
        {/* Toggle Controls */}
        {!isCollapsed ? (
          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-900 space-y-2 text-[11px] font-mono">
            {/* Binance Status */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Binance API:</span>
              <span className={`flex items-center gap-1 font-bold ${settings.binance.connected ? "text-emerald-400" : "text-rose-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${settings.binance.connected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                {settings.binance.connected ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>

            {/* Trading Mode */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Trading Mode:</span>
              <button
                disabled={true}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase bg-amber-950 text-amber-400 border border-amber-900 cursor-not-allowed"
                title="Live trading is disabled"
              >
                Demo Only
              </button>
            </div>

            {/* Automation status */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Automation:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${scannerStatusClass}`}
                title="Scanner runtime state from the backend"
              >
                {scannerHealth === "Running" ? <Play size={10} /> : <Pause size={10} />}
                {scannerStatusText}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${settings.binance.connected ? "bg-emerald-400" : "bg-rose-500"}`}
              title={`Binance: ${settings.binance.connected ? "Connected" : "Disconnected"}`}
            />
            <button
              disabled={true}
              className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center border bg-amber-950 text-amber-400 border-amber-900 cursor-not-allowed"
              title="Demo Only — Live trading is disabled"
            >
              D
            </button>
            <button
              disabled={true}
              className={`w-5 h-5 rounded-full flex items-center justify-center border ${scannerStatusClass} cursor-not-allowed`}
              title="Scanner runtime state from the backend"
            >
              {scannerHealth === "Running" ? <Play size={8} /> : <Pause size={8} />}
            </button>
          </div>
        )}

        {/* Emergency Stop Button */}
        <button
          disabled={true}
          className="w-full font-bold font-mono py-2 rounded text-xs flex items-center justify-center gap-1.5 border transition-all bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed"
          title="Execution Engine is Not Implemented"
        >
          <ShieldAlert size={14} />
          {!isCollapsed && <span>ESTOP UNAVAILABLE</span>}
        </button>

        {/* App Version */}
        {!isCollapsed && (
          <div className="text-[10px] text-zinc-600 text-center font-mono pt-1">
            {settings.system.version}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden bg-zinc-950 border-b border-zinc-900 flex items-center justify-between p-3 select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-orange-600 flex items-center justify-center font-bold text-black text-xs">
            AF
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">ASTRAFORGE</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-zinc-400 hover:text-white p-1"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden">
          <div className="w-64 h-full">
            {sidebarContent}
          </div>
          <button onClick={() => setMobileOpen(false)} className="absolute inset-0 -z-10 w-full h-full" />
        </div>
      )}

      {/* Desktop Sidebar */}
      <div
        className={`hidden md:block h-screen transition-all duration-200 shrink-0 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

// Compact Header
export const AppHeader: React.FC = () => {
  const { currentPage, settings, triggerScan, isScanning, scannerStatus, scannerHealth } = useTrading();
  const scanActionLabel =
    isScanning ? "Working..." : scannerStatus?.state === "OFF" ? "Start Scanner" : "Scan Now";
  const botLabel =
    scannerHealth === "Running"
      ? scannerStatus?.runActive
        ? "RUNNING"
        : "ON"
      : scannerHealth === "Off"
      ? "OFF"
      : "UNAVAILABLE";
  const botClass =
    scannerHealth === "Running"
      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900"
      : scannerHealth === "Off"
      ? "bg-amber-950/40 text-amber-400 border-amber-900"
      : "bg-zinc-900/40 text-zinc-500 border-zinc-800";

  return (
    <header className="bg-zinc-950 border-b border-zinc-900 py-2.5 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none">
      {/* Left Title */}
      <div className="flex items-center gap-3.5">
        <h1 className="text-sm font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded bg-orange-500 block" />
          {currentPage}
        </h1>

        {/* Sync Status / Scanning Indicator */}
        <div className="flex items-center gap-2">
          {(currentPage === "Dashboard" || currentPage === "Scanner") && (
            <button
              onClick={() => triggerScan()}
              disabled={isScanning || scannerHealth === "Unavailable"}
              className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-[11px] font-mono"
              title="Trigger a backend scanner action"
            >
              <RefreshCw size={11} className={isScanning ? "animate-spin" : ""} />
              <span>{scanActionLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Badges */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
        {/* Binance Status Badge */}
        <div className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500">Binance:</span>
          <span className={`w-1.5 h-1.5 rounded-full ${settings.binance.connected ? "bg-emerald-400" : "bg-rose-500"}`} />
          <span className={settings.binance.connected ? "text-emerald-400 font-medium" : "text-rose-500"}>
            {settings.binance.connected ? "Connected" : "Offline"}
          </span>
        </div>

        {/* Demo/Live Mode Badge */}
        <div
          className="border px-2.5 py-1 rounded-md text-[11px] font-medium uppercase bg-amber-950/40 text-amber-400 border-amber-900 cursor-help"
          title="Demo Only — Live trading is disabled"
        >
          Mode: Demo Only
        </div>

        {/* Automation Status */}
        <div
          className={`border px-2.5 py-1 rounded-md text-[11px] font-medium uppercase flex items-center gap-1 cursor-help ${botClass}`}
          title="Scanner runtime state from the backend"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${scannerHealth === "Running" ? "bg-emerald-400" : scannerHealth === "Off" ? "bg-amber-400" : "bg-zinc-700"}`} />
          Bot: {botLabel}
        </div>

        {/* Notification indicator */}
        <button className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors relative">
          <Bell size={13} />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full" />
        </button>

        {/* Emergency Stop Button */}
        {!settings.risk.emergencyStop ? (
          <button
            disabled={true}
            className="bg-zinc-800 text-zinc-500 font-bold px-3 py-1 rounded-md text-[11px] tracking-tight flex items-center gap-1 cursor-not-allowed border border-zinc-700"
            title="Execution Engine is Not Implemented"
          >
            <ShieldAlert size={12} />
            <span>ESTOP UNAVAILABLE</span>
          </button>
        ) : (
          <div className="bg-rose-950 text-rose-400 border border-rose-900 px-3 py-1 rounded-md text-[11px] font-bold">
            ⚠️ ESTOP BLOCKED
          </div>
        )}
      </div>
    </header>
  );
};
