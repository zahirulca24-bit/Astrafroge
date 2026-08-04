import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ActiveTrade,
  AppSettings,
  JournalTrade,
  ScannerEngineHealth,
  ScannerResult,
  ScannerRuntimeStatus,
  ScannerRunSummary,
  SymbolInfo,
} from "../types";
import { BackendHealthSnapshot, IndicatorSnapshot, UniverseSummary } from "../types/market";
import { INITIAL_SETTINGS } from "../services/defaults";
import { marketDataService } from "../services/marketDataService";
import { apiService } from "../services/apiService";
import { scannerService } from "../services/scannerService";
import { tradingRecordsService } from "../services/tradingRecordsService";
import { authToken } from "../services/authToken";
import { buildCsv } from "../services/csv";
import { loadFavorites, loadSettings } from "../services/storage";
import { warnOnce } from "../services/runtimeLogger";

export type NavigationPage =
  | "Dashboard"
  | "Scanner"
  | "Signals"
  | "Chart & Watchlist"
  | "Active Trades"
  | "Journal"
  | "Settings";

type ActivityType = "scan" | "trade" | "system" | "risk";

interface BotActivity {
  id: string;
  time: string;
  type: ActivityType;
  message: string;
}

interface TradingContextProps {
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  settings: AppSettings;
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  saveSettings: (newSettings: AppSettings) => void;
  restoreDefaultSettings: () => void;
  activeTrades: ActiveTrade[];
  closeTrade: (id: string, reason?: string) => void;
  addActiveTrade: (trade: ActiveTrade) => void;
  journalTrades: JournalTrade[];
  clearJournal: () => void;
  scannerResults: ScannerResult[];
  scannerStatus: ScannerRuntimeStatus | null;
  scannerSummary: ScannerRunSummary | null;
  scannerHealth: ScannerEngineHealth;
  activities: BotActivity[];
  addActivity: (message: string, type?: ActivityType) => void;
  favorites: string[];
  toggleFavorite: (symbol: string) => void;
  triggerEmergencyStop: () => void;
  triggerScan: () => void;
  triggerStopScanner: () => void;
  isScanning: boolean;
  exportJournalCSV: () => void;
  symbols: SymbolInfo[];
  updateSymbolPrice: (symbol: string, newPrice: number) => void;
  marketStatus: "Connected" | "Degraded" | "Disconnected";
  backendHealth: BackendHealthSnapshot | null;
  universeSummary: UniverseSummary | null;
  selectedSymbolIndicators: IndicatorSnapshot | null;
  indicatorsLoading: boolean;
  tradingRecordsLoading: boolean;
  tradingRecordsError: string | null;
}

const TradingContext = createContext<TradingContextProps | undefined>(undefined);
const SETTINGS_STORAGE_KEY = "astraforge_settings_v2";
const FAVORITES_STORAGE_KEY = "astraforge_favorites";
const PREFERRED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT", "DOGEUSDT", "NEARUSDT", "AVAXUSDT"];

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>("Dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(SETTINGS_STORAGE_KEY, INITIAL_SETTINGS));
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites(FAVORITES_STORAGE_KEY, ["BTCUSDT", "ETHUSDT", "SOLUSDT"]));
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [marketStatus, setMarketStatus] = useState<"Connected" | "Degraded" | "Disconnected">("Disconnected");
  const [backendHealth, setBackendHealth] = useState<BackendHealthSnapshot | null>(null);
  const [universeSummary, setUniverseSummary] = useState<UniverseSummary | null>(null);
  const [selectedSymbolIndicators, setSelectedSymbolIndicators] = useState<IndicatorSnapshot | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
  const [scannerStatus, setScannerStatus] = useState<ScannerRuntimeStatus | null>(null);
  const [scannerSummary, setScannerSummary] = useState<ScannerRunSummary | null>(null);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [journalTrades, setJournalTrades] = useState<JournalTrade[]>([]);
  const [tradingRecordsLoading, setTradingRecordsLoading] = useState(true);
  const [tradingRecordsError, setTradingRecordsError] = useState<string | null>(null);
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const scannerHealth: ScannerEngineHealth = useMemo(() => {
    if (!scannerStatus || !scannerStatus.scannerRuntimeImplemented) return "Unavailable";
    return scannerStatus.state === "OFF" ? "Off" : "Running";
  }, [scannerStatus]);

  const addActivity = (message: string, type: ActivityType = "system") => {
    setActivities((previous) => [
      { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), type, message },
      ...previous.slice(0, 24),
    ]);
  };

  useEffect(() => localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites)), [favorites]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [health, universe] = await Promise.all([apiService.getHealth(), apiService.getUniverseSummary()]);
        if (active) {
          setBackendHealth(health);
          setUniverseSummary(universe);
        }
      } catch (error) {
        if (active) {
          setBackendHealth(null);
          setUniverseSummary(null);
        }
        warnOnce("backend-overview", "AstraForge backend overview is unavailable.", error);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [status, snapshot] = await Promise.all([scannerService.getStatus(), scannerService.getCandidates()]);
        if (active) {
          setScannerStatus(status);
          setScannerResults(snapshot.candidates);
          setScannerSummary(snapshot.summary ?? status.latestRun ?? null);
        }
      } catch (error) {
        if (active) {
          setScannerStatus(null);
          setScannerResults([]);
          setScannerSummary(null);
        }
        warnOnce("scanner-refresh", "AstraForge scanner data is unavailable.", error);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (active) setTradingRecordsLoading(true);
      try {
        const [trades, journal] = await Promise.all([
          tradingRecordsService.getActiveTrades(),
          tradingRecordsService.getJournal(),
        ]);
        if (active) {
          setActiveTrades(trades);
          setJournalTrades(journal);
          setTradingRecordsError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Backend trading records are unavailable.";
        if (active) setTradingRecordsError(message);
        warnOnce("trading-records", "Backend trading records are unavailable.", error);
      } finally {
        if (active) setTradingRecordsLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    let resolvedSymbols: string[] | null = null;
    const refresh = async () => {
      try {
        if (!resolvedSymbols) {
          const metadata = await apiService.getMarketSymbols();
          const available = metadata
            .filter((item) => item.quoteAsset === "USDT" && item.contractType === "PERPETUAL" && item.status === "TRADING")
            .map((item) => item.symbol);
          const availableSet = new Set(available);
          const preferred = PREFERRED_SYMBOLS.filter((symbol) => availableSet.has(symbol));
          resolvedSymbols = preferred.length ? preferred : available.slice(0, 10);
          if (!resolvedSymbols.length) throw new Error("Backend returned no eligible USD-M Futures symbols");
        }
        const requested = resolvedSymbols;
        const [tickers, status] = await Promise.all([
          marketDataService.fetchTickers(requested),
          apiService.getMarketStatus(),
        ]);
        if (active) {
          setSymbols(tickers);
          setMarketStatus(status === "Connected" && tickers.length < requested.length ? "Degraded" : status);
          setSelectedSymbol((previous) => tickers.some((item) => item.symbol === previous) ? previous : tickers[0]?.symbol ?? previous);
        }
      } catch (error) {
        if (active) {
          setSymbols([]);
          setMarketStatus("Disconnected");
          resolvedSymbols = null;
        }
        warnOnce("market-refresh", "AstraForge market data is unavailable.", error);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    let active = true;
    setIndicatorsLoading(true);
    void apiService.getIndicators(selectedSymbol)
      .then((value) => { if (active) setSelectedSymbolIndicators(value); })
      .catch((error) => {
        if (active) setSelectedSymbolIndicators(null);
        warnOnce(`indicators-${selectedSymbol}`, `Indicators are unavailable for ${selectedSymbol}.`, error);
      })
      .finally(() => { if (active) setIndicatorsLoading(false); });
    return () => { active = false; };
  }, [selectedSymbol]);

  useEffect(() => {
    if (!symbols.length) return;
    setActiveTrades((previous) => previous.map((trade) => {
      const ticker = symbols.find((item) => item.symbol === trade.symbol);
      if (!ticker || ticker.price <= 0) return trade;
      const pnl = trade.side === "Long"
        ? (ticker.price - trade.entryPrice) * trade.positionSize
        : (trade.entryPrice - ticker.price) * trade.positionSize;
      const risk = Math.abs(trade.entryPrice - trade.stopLoss);
      return {
        ...trade,
        currentPrice: ticker.price,
        unrealizedPnL: Number(pnl.toFixed(2)),
        unrealizedPnLPercent: trade.marginUsed > 0 ? Number(((pnl / trade.marginUsed) * 100).toFixed(2)) : 0,
        currentRMultiple: risk > 0 ? Number((((ticker.price - trade.entryPrice) / (trade.side === "Long" ? risk : -risk))).toFixed(2)) : 0,
      };
    }));
  }, [symbols]);

  const updateSettings = (updater: (prev: AppSettings) => AppSettings) => setSettings((previous) => updater(previous));
  const saveSettings = (value: AppSettings) => { setSettings(value); addActivity("Frontend preferences saved. Backend engine rules were not changed."); };
  const restoreDefaultSettings = () => { setSettings(INITIAL_SETTINGS); addActivity("Frontend preferences restored to defaults."); };
  const toggleFavorite = (symbol: string) => setFavorites((previous) => previous.includes(symbol) ? previous.filter((item) => item !== symbol) : [...previous, symbol]);
  const updateSymbolPrice = (symbol: string, price: number) => {
    if (Number.isFinite(price) && price > 0) setSymbols((previous) => previous.map((item) => item.symbol === symbol ? { ...item, price } : item));
  };

  const triggerEmergencyStop = () => {
    setSettings((previous) => ({
      ...previous,
      automation: { ...previous.automation, botStatus: "Paused", autoExecution: false },
      risk: { ...previous.risk, emergencyStop: true, currentRiskStatus: "Blocked" },
    }));
    addActivity("Emergency stop recorded as a local frontend preference. Backend execution was not changed.", "risk");
  };

  const addActiveTrade = (trade: ActiveTrade) => {
    const localDraft: ActiveTrade = {
      ...trade,
      backendAuthoritative: false,
      status: "Pending",
      source: "Local draft",
      mode: "Demo",
      executionStatus: "Not submitted / Not executed",
      signalStatus: "Local draft",
      exchangeFees: "Not applicable",
      fundingFees: "Not applicable",
      executionId: "Local draft",
      orderId: "Local draft",
    };
    setActiveTrades((previous) => [localDraft, ...previous.filter((item) => item.id !== localDraft.id)]);
    addActivity(`Local draft created for ${localDraft.symbol}; no exchange action occurred.`, "trade");
  };

  const closeTrade = (id: string, reason = "MANUAL_CLOSE") => {
    void (async () => {
      const trade = activeTrades.find((item) => item.id === id);
      if (!trade) return;
      if (!trade.backendAuthoritative) {
        setActiveTrades((previous) => previous.filter((item) => item.id !== id));
        addActivity(`Local draft removed for ${trade.symbol}; no exchange action occurred.`, "trade");
        return;
      }
      try {
        await tradingRecordsService.closeTrade(id, reason);
        const [trades, journal] = await Promise.all([tradingRecordsService.getActiveTrades(), tradingRecordsService.getJournal()]);
        setActiveTrades(trades);
        setJournalTrades(journal);
        setTradingRecordsError(null);
        addActivity(`Backend Demo trade ${id} closed and reconciled.`, "trade");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Trade close failed.";
        setTradingRecordsError(message);
        addActivity(message, "risk");
      }
    })();
  };

  const triggerScan = () => {
    void (async () => {
      if (!authToken.isAvailable()) {
        addActivity("Scanner action blocked: configure the operator token in Settings.", "scan");
        return;
      }
      setIsScanning(true);
      try {
        const current = await scannerService.getStatus();
        if (current.state === "OFF") await scannerService.start();
        else await scannerService.runNow();
        const [status, snapshot] = await Promise.all([scannerService.getStatus(), scannerService.getCandidates()]);
        setScannerStatus(status);
        setScannerResults(snapshot.candidates);
        setScannerSummary(snapshot.summary ?? status.latestRun ?? null);
        addActivity("Backend scanner action completed.", "scan");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scanner request failed.";
        addActivity(message, "scan");
        warnOnce("scanner-action", "Scanner action failed.", error, 5_000);
      } finally {
        setIsScanning(false);
      }
    })();
  };

  const triggerStopScanner = () => {
    void (async () => {
      if (!authToken.isAvailable()) {
        addActivity("Scanner stop blocked: configure the operator token in Settings.", "scan");
        return;
      }
      setIsScanning(true);
      try {
        setScannerStatus(await scannerService.stop());
        addActivity("Backend scanner stopped.", "scan");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scanner stop failed.";
        addActivity(message, "scan");
      } finally {
        setIsScanning(false);
      }
    })();
  };

  const clearJournal = () => addActivity("Backend journal is authoritative and cannot be cleared from the frontend.");
  const exportJournalCSV = () => {
    const rows: readonly (readonly unknown[])[] = [
      ["Trade ID", "Signal ID", "Date", "Symbol", "Side", "Grade", "Strategy", "Entry", "Exit", "Realized PnL", "R", "Duration", "Exit Reason", "Source"],
      ...journalTrades.map((trade) => [trade.tradeId ?? trade.id, trade.signalId ?? "", trade.date, trade.symbol, trade.side, trade.grade, trade.strategy, trade.entry, trade.exit, trade.pnl, trade.r, trade.duration, trade.exitReason, trade.source ?? "Backend"]),
    ];
    const blob = new Blob(["\uFEFF", buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AstraForge_Backend_Journal_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addActivity("Backend-authoritative journal exported as CSV.");
  };

  return (
    <TradingContext.Provider value={{
      currentPage, setCurrentPage, selectedSymbol, setSelectedSymbol, settings, updateSettings,
      saveSettings, restoreDefaultSettings, activeTrades, closeTrade, addActiveTrade, journalTrades,
      clearJournal, scannerResults, scannerStatus, scannerSummary, scannerHealth, activities, addActivity,
      favorites, toggleFavorite, triggerEmergencyStop, triggerScan, triggerStopScanner, isScanning,
      exportJournalCSV, symbols, updateSymbolPrice, marketStatus, backendHealth, universeSummary,
      selectedSymbolIndicators, indicatorsLoading, tradingRecordsLoading, tradingRecordsError,
    }}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) throw new Error("useTrading must be used within a TradingProvider");
  return context;
};
