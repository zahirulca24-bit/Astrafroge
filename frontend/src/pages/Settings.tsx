import React, { useState, useEffect } from "react";
import { useTrading } from "../store/TradingStore";
import { AppSettings } from "../types";
import { backendService } from "../services/backendService";
import {
  DemoManualTestTradeResult,
  demoExecutionService,
} from "../services/demoExecutionService";
import {
  Globe,
  Sliders,
  ShieldCheck,
  Cpu,
  Bell,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

type SettingsTab =
  | "binance"
  | "rules"
  | "risk"
  | "automation"
  | "notifications"
  | "system";

export const Settings: React.FC = () => {
  const {
    settings,
    saveSettings,
    restoreDefaultSettings,
    marketStatus,
    scannerStatus,
    scannerHealth,
    operatorSessionState,
    operatorSession,
    operatorSessionMessage,
    mutationBanner,
    loginOperatorSession,
    logoutOperatorSession,
    protectedControlsEnabled,
    protectedControlsReason,
    clearMutationBanner,
  } = useTrading();

  const [activeTab, setActiveTab] = useState<SettingsTab>("binance");
  const [backendStatus, setBackendStatus] = useState<string>("Not connected");
  const [operatorTokenInput, setOperatorTokenInput] = useState("");
  const [operatorLoginBusy, setOperatorLoginBusy] = useState(false);
  const [manualTestBusy, setManualTestBusy] = useState(false);
  const [manualTestResult, setManualTestResult] = useState<DemoManualTestTradeResult | null>(null);
  const [manualTestError, setManualTestError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatuses = async () => {
      const bStatus = await backendService.getBackendStatus();
      if (active) {
        setBackendStatus(bStatus);
      }
    };
    fetchStatuses();
    return () => {
      active = false;
    };
  }, []);

  const [editableSettings, setEditableSettings] = useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    setEditableSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const updateField = (
    section: keyof AppSettings,
    field: string,
    value: string | number | boolean
  ) => {
    setEditableSettings((prev) => {
      const next = {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(settings));
      return next;
    });
  };

  const handleSaveChanges = () => {
    saveSettings(editableSettings);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDiscardChanges = () => {
    setEditableSettings(settings);
    setHasChanges(false);
  };

  const handleRestoreDefaults = () => {
    setShowRestoreModal(true);
  };

  const confirmRestoreDefaults = () => {
    restoreDefaultSettings();
    setShowRestoreModal(false);
    setHasChanges(false);
  };

  const saveOperatorTokenForSession = async () => {
    setOperatorLoginBusy(true);
    clearMutationBanner();
    try {
      await loginOperatorSession(operatorTokenInput);
      setOperatorTokenInput("");
    } finally {
      setOperatorLoginBusy(false);
    }
  };

  const clearOperatorTokenForSession = async () => {
    setOperatorLoginBusy(true);
    clearMutationBanner();
    try {
      await logoutOperatorSession();
      setOperatorTokenInput("");
    } finally {
      setOperatorLoginBusy(false);
    }
  };

  const openManualDemoTestTrade = async () => {
    setManualTestBusy(true);
    setManualTestError(null);
    setManualTestResult(null);
    try {
      setManualTestResult(await demoExecutionService.openManualTestTrade());
    } catch (error) {
      setManualTestError(
        error instanceof Error ? error.message : "Manual Binance Demo test trade failed.",
      );
    } finally {
      setManualTestBusy(false);
    }
  };

  const menuItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "binance", label: "Backend Integration", icon: <Globe size={15} /> },
    { id: "rules", label: "Trading Setup Rules", icon: <Sliders size={15} /> },
    { id: "risk", label: "Risk Management Engine", icon: <ShieldCheck size={15} /> },
    { id: "automation", label: "Automation Core", icon: <Cpu size={15} /> },
    { id: "notifications", label: "Alerts & Telegram", icon: <Bell size={15} /> },
    { id: "system", label: "System Diagnostics", icon: <HardDrive size={15} /> }
  ];

  const scannerRuntimeAvailable = scannerHealth !== "Unavailable";
  const scannerRuntimeOn = scannerStatus?.state === "ON";

  return (
    <div id="settings-page" className="flex flex-col gap-4 relative">
      {hasChanges && (
        <div className="bg-amber-950 border border-amber-900 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs font-mono animate-fade-in z-20">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={15} className="animate-pulse" />
            <span className="font-bold">UNSAVED CONFIGURATION CHANGES DETECTED</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDiscardChanges} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded font-bold transition-colors">
              Discard Changes
            </button>
            <button onClick={handleSaveChanges} className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-3 py-1.5 rounded font-bold transition-colors">
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-950 border border-emerald-900 rounded-lg p-3 flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
          <CheckCircle size={15} />
          <span>Frontend preferences saved in this browser. Backend configuration was not changed.</span>
        </div>
      )}

      {mutationBanner?.page === "Settings" && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-2 text-xs font-mono text-rose-300">
          <div className="font-bold text-rose-200">{mutationBanner.title}</div>
          <div className="mt-1">{mutationBanner.message}</div>
          <div className="mt-1 text-[10px] text-rose-400/90">
            {mutationBanner.code ? `${mutationBanner.code}${mutationBanner.statusCode ? ` (${mutationBanner.statusCode})` : ""}` : mutationBanner.statusCode ? `HTTP ${mutationBanner.statusCode}` : ""}
          </div>
        </div>
      )}

      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs font-mono select-none">
        <div className="flex flex-col gap-1 border-r border-zinc-850/60 pr-2 last:border-0">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Binance API</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${backendStatus === "Connected" ? "bg-emerald-500" : "bg-rose-500/85"}`} />
            <span className="text-zinc-200 font-bold">{backendStatus === "Connected" ? "Backend Managed" : "Unavailable"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-zinc-850/60 pr-2 last:border-0 md:border-r-0 lg:border-r">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Trading Side</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-zinc-200 font-bold">
              {editableSettings.rules.longEnabled && editableSettings.rules.shortEnabled ? "Long & Short" : editableSettings.rules.longEnabled ? "Long Only" : editableSettings.rules.shortEnabled ? "Short Only" : "None (Disabled)"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-zinc-850/60 pr-2 last:border-0">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Risk Per Trade</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-orange-400 font-bold">{editableSettings.risk.riskPerTradePercent}% Max</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-zinc-850/60 pr-2 last:border-0 lg:border-r-0 xl:border-r">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Open Trades Limit</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-zinc-200 font-bold">{editableSettings.risk.maxOpenTrades} Positions</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-zinc-850/60 pr-2 last:border-0">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Automation Core</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${scannerRuntimeOn ? "bg-emerald-500" : scannerRuntimeAvailable ? "bg-amber-500" : "bg-zinc-600"}`} />
            <span className="text-zinc-200 font-bold">{scannerRuntimeOn ? "Scanner ON" : scannerRuntimeAvailable ? "Scanner OFF" : "Unavailable"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 last:border-0">
          <span className="text-zinc-500 text-[9px] uppercase font-bold block">Telegram Dispatch</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${editableSettings.notifications.telegramEnabled ? "bg-emerald-500" : "bg-zinc-600"}`} />
            <span className="text-zinc-200 font-bold">{editableSettings.notifications.telegramEnabled ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 font-mono text-xs select-none h-fit">
          <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider p-2 border-b border-zinc-850 mb-1">Settings Menu</h3>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-left font-semibold transition-all ${isActive ? "bg-orange-600/10 text-orange-500 border-l-2 border-orange-500 font-bold" : "text-zinc-400 hover:bg-zinc-950 hover:text-white"}`}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="mt-4 pt-3 border-t border-zinc-850 p-2">
            <button onClick={handleRestoreDefaults} className="w-full bg-zinc-950 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 text-zinc-500 py-2 rounded font-bold flex items-center justify-center gap-1.5 transition-all text-[11px]">
              <RotateCcw size={12} />
              <span>Restore Factory Defaults</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-9 bg-zinc-900 border border-zinc-800 rounded-lg p-5 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-zinc-800 mb-4 flex justify-between items-center select-none">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                {menuItems.find((m) => m.id === activeTab)?.icon}
                <span>{menuItems.find((m) => m.id === activeTab)?.label} Configuration</span>
              </h2>
              <span className="text-[10px] text-zinc-500">Client: React / Vite</span>
            </div>

            {activeTab === "binance" && (
              <div className="space-y-4">
                <div className="bg-amber-950/15 border border-amber-900/40 p-4 rounded-lg leading-relaxed text-zinc-300 space-y-2 select-none">
                  <span className="text-amber-500 font-bold block text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    <span>⚠️ Demo Only Mode Active</span>
                  </span>
                  <p className="text-[11px]">The terminal connects to the AstraForge FastAPI backend. Exchange credentials remain backend-only. Execution stays disabled until the Render service is explicitly configured and verified.</p>
                  <ul className="list-disc pl-4 space-y-1 text-[10.5px] text-zinc-400">
                    <li>Public market data and scanner reads come from the backend.</li>
                    <li>Demo account data remains unavailable until backend credentials are configured.</li>
                    <li>Local plans are not exchange orders.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1">Public Market Data</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2 h-2 rounded-full ${marketStatus === "Connected" ? "bg-emerald-500 animate-pulse" : marketStatus === "Degraded" ? "bg-amber-500" : "bg-rose-500"}`} />
                      <span className={`font-bold ${marketStatus === "Connected" ? "text-emerald-400" : marketStatus === "Degraded" ? "text-amber-400" : "text-rose-500"}`}>{marketStatus === "Connected" ? "AVAILABLE" : marketStatus === "Degraded" ? "DEGRADED" : "UNAVAILABLE"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1">FastAPI Backend</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2 h-2 rounded-full ${backendStatus === "Connected" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      <span className={`font-bold ${backendStatus === "Connected" ? "text-emerald-400" : "text-rose-400"}`}>{backendStatus === "Connected" ? "CONNECTED" : "NOT CONNECTED"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-850 rounded p-4 space-y-3">
                  <div>
                    <span className="text-zinc-300 font-bold block">Operator login</span>
                    <span className="text-[10px] text-zinc-500">The token is sent once to the backend and converted into an HttpOnly session cookie. It is never saved to localStorage or included in the build.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="password" autoComplete="off" value={operatorTokenInput} onChange={(event) => setOperatorTokenInput(event.target.value)} placeholder="Paste the operator token to sign in" className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700" />
                    <button type="button" onClick={() => void saveOperatorTokenForSession()} disabled={!operatorTokenInput.trim() || operatorLoginBusy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-bold px-3 py-2 rounded">{operatorLoginBusy ? "SIGNING IN..." : "SIGN IN"}</button>
                    <button type="button" onClick={() => void clearOperatorTokenForSession()} disabled={operatorLoginBusy || operatorSessionState !== "authenticated"} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 font-bold px-3 py-2 rounded">SIGN OUT</button>
                  </div>
                  <div className={operatorSessionState === "authenticated" ? "text-emerald-400 text-[10px]" : operatorSessionState === "expired" ? "text-amber-400 text-[10px]" : "text-rose-400 text-[10px]"}>
                    {operatorSessionState === "authenticated" ? `Authenticated session restored. Expires ${operatorSession?.expiresAt ?? "soon"}.` : operatorSessionState === "expired" ? "Session expired. Sign in again to re-enable protected controls." : operatorSessionState === "unauthorized" ? "Operator access is unauthorized for this session." : operatorSessionMessage ?? protectedControlsReason}
                  </div>
                </div>

                <div className="bg-zinc-950 border border-orange-900/50 rounded p-4 space-y-3">
                  <div>
                    <span className="text-orange-400 font-bold block">Manual Binance Demo Test Trade</span>
                    <span className="text-[10px] text-zinc-500">
                      Opens BTCUSDT LONG on Binance Demo/Testnet using the smallest exchange-valid MARKET quantity. This bypasses scanner/signal selection only; it never targets a live Binance host.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openManualDemoTestTrade()}
                    disabled={!protectedControlsEnabled || backendStatus !== "Connected" || manualTestBusy}
                    title={!protectedControlsEnabled ? protectedControlsReason : "Open minimum Binance Demo test position"}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded transition-colors"
                  >
                    {manualTestBusy ? "OPENING DEMO TRADE..." : "OPEN MINIMUM DEMO TRADE"}
                  </button>
                  {manualTestError && (
                    <div className="rounded border border-rose-900/60 bg-rose-950/25 px-3 py-2 text-[10px] text-rose-300">
                      {manualTestError}
                    </div>
                  )}
                  {manualTestResult && (
                    <div className="rounded border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-[10px] text-emerald-300 space-y-1">
                      <div className="font-bold">DEMO ORDER {manualTestResult.status}</div>
                      <div>{manualTestResult.symbol} {manualTestResult.direction} · Qty {manualTestResult.executedQuantity} · Avg ${manualTestResult.averagePrice}</div>
                      <div className="text-zinc-400">Order ID: {manualTestResult.orderId} · Est. notional ${manualTestResult.estimatedNotionalUsdt}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "rules" && (
              <div className="space-y-4">
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850 leading-relaxed text-zinc-400">
                  <span className="text-amber-500 font-bold">Scalping Locked Timeframe Roles:</span>
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px] text-zinc-300">
                    <li><span className="font-bold text-white">15M (Trend):</span> Establishes the active directional context used by the scanner.</li>
                    <li><span className="font-bold text-white">5M (Setup):</span> Detects approved pullback, breakout, or reversal setup conditions.</li>
                    <li><span className="font-bold text-white">1M/3M (Entry):</span> Confirms the lower-timeframe entry trigger after a valid 5M setup.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-300">Allow Long Trades:</span>
                    <input type="checkbox" checked={editableSettings.rules.longEnabled} onChange={(e) => updateField("rules", "longEnabled", e.target.checked)} className="w-4 h-4 text-orange-600 bg-zinc-900 border-zinc-850 rounded focus:ring-0 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-300">Allow Short Trades:</span>
                    <input type="checkbox" checked={editableSettings.rules.shortEnabled} onChange={(e) => updateField("rules", "shortEnabled", e.target.checked)} className="w-4 h-4 text-orange-600 bg-zinc-900 border-zinc-850 rounded focus:ring-0 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-300">B+ setups Watch Only:</span>
                    <input type="checkbox" checked={editableSettings.rules.gradeBPlusWatchOnly} onChange={(e) => updateField("rules", "gradeBPlusWatchOnly", e.target.checked)} className="w-4 h-4 text-orange-600 bg-zinc-900 border-zinc-850 rounded focus:ring-0 cursor-pointer" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Min Confidence Score (%):</label>
                    <input type="number" value={editableSettings.rules.minimumConfidence} onChange={(e) => updateField("rules", "minimumConfidence", parseInt(e.target.value) || 75)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Min Risk:Reward Multiple:</label>
                    <input type="number" value={editableSettings.rules.minimumRiskReward} onChange={(e) => updateField("rules", "minimumRiskReward", parseFloat(e.target.value) || 2.0)} step="0.1" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Min 24H volume (USDT):</label>
                    <input type="number" value={editableSettings.rules.minimum24hVolume} onChange={(e) => updateField("rules", "minimum24hVolume", parseInt(e.target.value) || 15000000)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "risk" && (
              <div className="space-y-4">
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850 leading-relaxed text-zinc-400 text-[11px]"><span className="text-rose-500 font-bold">CRITICAL DEVIATION BLOCK:</span> The Risk Engine is a hardened system module and cannot be disabled. Standard risk ceilings protect perpetual accounts from liquidations during systemic market black swans.</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Risk Per Trade (%):</label><input type="number" value={editableSettings.risk.riskPerTradePercent} onChange={(e) => updateField("risk", "riskPerTradePercent", parseFloat(e.target.value) || 1.0)} step="0.1" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Daily Loss Limit (%):</label><input type="number" value={editableSettings.risk.dailyLossLimitPercent} onChange={(e) => updateField("risk", "risk.dailyLossLimitPercent", parseFloat(e.target.value) || 3.0)} step="0.5" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Daily Profit Lock (%):</label><input type="number" value={editableSettings.risk.dailyProfitLockPercent} onChange={(e) => updateField("risk", "dailyProfitLockPercent", parseFloat(e.target.value) || 5.0)} step="0.5" className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Max Concurrent Open Trades:</label><input type="number" value={editableSettings.risk.maxOpenTrades} onChange={(e) => updateField("risk", "maxOpenTrades", parseInt(e.target.value) || 4)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Max Leverage Limit:</label><input type="number" value={editableSettings.risk.maxLeverage} onChange={(e) => updateField("risk", "maxLeverage", parseInt(e.target.value) || 10)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                  <div><label className="block text-zinc-400 mb-1 uppercase font-bold text-[10px]">Per-Symbol Position Limit:</label><input type="number" value={editableSettings.risk.perSymbolTradeLimit} onChange={(e) => updateField("risk", "perSymbolTradeLimit", parseInt(e.target.value) || 1)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white" /></div>
                </div>
              </div>
            )}

            {activeTab === "automation" && (
              <div className="space-y-4">
                <div className={`${scannerRuntimeAvailable ? "bg-emerald-950/15 border-emerald-900/40" : "bg-amber-950/15 border-amber-900/40"} border p-3 rounded leading-relaxed text-zinc-300`}>
                  <span className={`${scannerRuntimeAvailable ? "text-emerald-400" : "text-amber-500"} font-bold flex items-center gap-1.5 mb-1`}>
                    {scannerRuntimeAvailable ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                    {scannerRuntimeAvailable ? "Backend Automation Runtime Available" : "Scanner Runtime Unavailable"}
                  </span>
                  {scannerRuntimeAvailable
                    ? `Scanner runtime is ${scannerRuntimeOn ? "ON" : "OFF"}. Signal generation remains candidate-driven. Demo execution stays disabled until execution is explicitly verified.`
                    : "Backend scanner runtime status could not be verified. Automation state is not fabricated locally."}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <div><span className="text-zinc-200 font-bold block">Scanner Runtime:</span><span className="text-[10px] text-zinc-500 font-mono">Backend authoritative scanner state</span></div>
                    <span className={`font-bold ${scannerRuntimeOn ? "text-emerald-400" : scannerRuntimeAvailable ? "text-amber-400" : "text-zinc-500"}`}>{scannerRuntimeOn ? "ON" : scannerRuntimeAvailable ? "OFF" : "UNAVAILABLE"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <div><span className="text-zinc-200 font-bold block">Signal Pipeline:</span><span className="text-[10px] text-zinc-500 font-mono">Consumes qualified scanner candidates</span></div>
                    <span className={`font-bold ${backendStatus === "Connected" ? "text-emerald-400" : "text-zinc-500"}`}>{backendStatus === "Connected" ? "AVAILABLE" : "UNAVAILABLE"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <div><span className="text-rose-400 font-bold block">Auto Execution:</span><span className="text-[10px] text-zinc-500 font-mono">Demo safety gate</span></div>
                    <span className="font-bold text-amber-400">DISABLED</span>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <div><span className="text-zinc-200 font-bold block">Move SL to Breakeven:</span><span className="text-[10px] text-zinc-500 font-mono">Requires active execution lifecycle</span></div>
                    <span className="font-bold text-zinc-500">UNAVAILABLE</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-4">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-850 leading-relaxed text-zinc-400">Receive instant telemetry messages on trade fills, stop hits, and risk limits warnings. Connect your personal Telegram channel.</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-300">Telegram Notification Alerts:</span>
                    <input type="checkbox" checked={editableSettings.notifications.telegramEnabled} onChange={(e) => updateField("notifications", "telegramEnabled", e.target.checked)} className="w-4 h-4 text-orange-600 bg-zinc-900 border-zinc-850 rounded focus:ring-0 cursor-pointer" />
                  </div>
                  {editableSettings.notifications.telegramEnabled && (
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-850 flex items-center justify-between">
                      <label className="text-zinc-500 font-bold uppercase text-[9px] shrink-0 mr-2">Telegram Chat ID:</label>
                      <input type="text" placeholder="e.g. -10045920310" value={editableSettings.notifications.telegramChatId} onChange={(e) => updateField("notifications", "telegramChatId", e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-white focus:outline-none" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {[
                    { field: "tradeOpened", label: "Trade Opened Notification" },
                    { field: "tpHit", label: "Take Profit Hit Alert" },
                    { field: "slHit", label: "Stop Loss Liquidation Alert" },
                    { field: "riskBlock", label: "Risk Engine Deviation Warning" }
                  ].map((notif) => (
                    <div key={notif.field} className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-850">
                      <span className="text-zinc-400 text-[11px]">{notif.label}</span>
                      <input type="checkbox" checked={Boolean((editableSettings.notifications as unknown as Record<string, unknown>)[notif.field])} onChange={(e) => updateField("notifications", notif.field, e.target.checked)} className="w-4 h-4 text-orange-600 bg-zinc-900 border-zinc-850 rounded focus:ring-0 cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "system" && (
              <div className="space-y-4">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-850 text-zinc-400 leading-relaxed">Diagnostics for the React/Vite client and its connection to the AstraForge FastAPI service.</div>
                <div className="bg-zinc-950/60 rounded border border-zinc-850 p-3 space-y-2 text-[11px]">
                  <div className="flex justify-between pb-1.5 border-b border-zinc-850"><span className="text-zinc-500">Framework version:</span><span className="text-zinc-200">React 19.0.1 (Vite & Tailwind v4)</span></div>
                  <div className="flex justify-between pb-1.5 border-b border-zinc-850"><span className="text-zinc-500">API service layer:</span><span className="text-emerald-400 font-bold">Centralized FastAPI client</span></div>
                  <div className="flex justify-between pb-1.5 border-b border-zinc-850"><span className="text-zinc-500">Backend Port Binding:</span><span className="text-zinc-400">VITE_API_BASE_URL (required at build time)</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Diagnostics log retention:</span><span className="text-zinc-200">{editableSettings.system.logRetentionDays} Days</span></div>
                </div>
              </div>
            )}
          </div>

          {!hasChanges && (
            <div className="pt-4 border-t border-zinc-800 text-zinc-500 text-[10px] text-right select-none">All settings synchronized. No unsaved changes.</div>
          )}
        </div>
      </div>

      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 font-mono text-xs select-none">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-sm w-full p-4 space-y-4">
            <div className="flex items-center gap-2 text-rose-500 font-bold uppercase"><RotateCcw size={16} /><span>Confirm System Restore</span></div>
            <p className="text-zinc-300 leading-relaxed text-[11px]">Are you sure you want to restore the bot to its factory configuration? This will clear all custom risk parameters, session times, Telegram integrations, and saved API permissions.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowRestoreModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded font-bold">Cancel</button>
              <button onClick={confirmRestoreDefaults} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded font-bold">Restore Factory config</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
