import React, { createContext, useContext, useEffect, useState } from "react";
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
import { authToken } from "../services/authToken";
import { buildCsv } from "../services/csv";
import { loadActiveTrades, loadFavorites, loadJournalTrades, loadSettings } from "../services/storage";
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
}

const TradingContext = createContext<TradingContextProps | undefined>(undefined);

const PREFERRED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "DOGEUSDT",
  "NEARUSDT",
  "AVAXUSDT",
];

const SETTINGS_STORAGE_KEY = "astraforge_settings_v2";
const LOCAL_PLANS_STORAGE_KEY = "astraforge_local_demo_plans_v1";
const LOCAL_JOURNAL_STORAGE_KEY = "astraforge_local_journal_v1";
const FAVORITES_STORAGE_KEY = "astraforge_favorites";

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>("Dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [marketStatus, setMarketStatus] = useState<"Connected" | "Degraded" | "Disconnected">(
    "Disconnected",
  );
  const [backendHealth, setBackendHealth] = useState<BackendHealthSnapshot | null>(null);
  const [universeSummary, setUniverseSummary] = useState<UniverseSummary | null>(null);
  const [selectedSymbolIndicators, setSelectedSymbolIndicators] = useState<IndicatorSnapshot | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadSettings(SETTINGS_STORAGE_KEY, INITIAL_SETTINGS),
  );
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>(() =>
    loadActiveTrades(LOCAL_PLANS_STORAGE_KEY),
  );
  const [journalTrades, setJournalTrades] = useState<JournalTrade[]>(() =>
    loadJournalTrades(LOCAL_JOURNAL_STORAGE_KEY),
  );
  const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
  const [scannerStatus, setScannerStatus] = useState<ScannerRuntimeStatus | null>(null);
  const [scannerSummary, setScannerSummary] = useState<ScannerRunSummary | null>(null);
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadFavorites(FAVORITES_STORAGE_KEY, ["BTCUSDT", "ETHUSDT", "SOLUSDT"]),
  );

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scannerHealth: ScannerEngineHealth =
    !scannerStatus || !scannerStatus.scannerRuntimeImplemented
      ? "Unavailable"
      : scannerStatus.state === "OFF"
      ? "Off"
      : "Running";

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LOCAL_PLANS_STORAGE_KEY, JSON.stringify(activeTrades));
  }, [activeTrades]);

  useEffect(() => {
    localStorage.setItem(LOCAL_JOURNAL_STORAGE_KEY, JSON.stringify(journalTrades));
  }, [journalTrades]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;

    const fetchBackendOverview = async () => {
      if (inFlight) return;
      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const [health, universe] = await Promise.all([
          apiService.getHealth(requestController.signal),
          apiService.getUniverseSummary(requestController.signal),
        ]);
        if (!active) return;
        setBackendHealth(health);
        setUniverseSummary(universe);
      } catch (error) {
        if (!requestController.signal.aborted) {
          warnOnce("backend-overview", "AstraForge backend overview is unavailable.", error);
        }
        if (active) {
          setBackendHealth(null);
          setUniverseSummary(null);
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchBackendOverview();
    const pollInterval = window.setInterval(() => void fetchBackendOverview(), 60_000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;

    const refreshScanner = async () => {
      if (inFlight) return;
      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const [status, candidatesSnapshot] = await Promise.all([
          scannerService.getStatus(requestController.signal),
          scannerService.getCandidates(requestController.signal),
        ]);
        if (!active) return;
        setScannerStatus(status);
        setScannerResults(candidatesSnapshot.candidates);
        setScannerSummary(candidatesSnapshot.summary ?? status.latestRun ?? null);
      } catch (error) {
        if (!requestController.signal.aborted) {
          warnOnce("scanner-refresh", "AstraForge scanner data is unavailable.", error);
        }
        if (active) {
          setScannerStatus(null);
          setScannerResults([]);
          setScannerSummary(null);
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshScanner();
    const pollInterval = window.setInterval(() => void refreshScanner(), 30_000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let resolvedSymbols: string[] | null = null;
    let controller: AbortController | null = null;

    const fetchTickers = async () => {
      if (inFlight) return;
      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;
      try {
        if (!resolvedSymbols) {
          const metadata = await apiService.getMarketSymbols(requestController.signal);
          const tradingSymbols = metadata
            .filter((item) =>
              item.quoteAsset === "USDT" &&
              item.contractType === "PERPETUAL" &&
              item.status === "TRADING",
            )
            .map((item) => item.symbol);
          const available = new Set(tradingSymbols);
          const preferred = PREFERRED_SYMBOLS.filter((symbol) => available.has(symbol));
          resolvedSymbols = preferred.length > 0 ? preferred : tradingSymbols.slice(0, 10);
          if (resolvedSymbols.length === 0) {
            throw new Error("Backend returned no eligible USD-M Futures symbols");
          }
        }

        const requestedSymbols = resolvedSymbols;
        const [fetched, backendMarketStatus] = await Promise.all([
          marketDataService.fetchTickers(requestedSymbols, requestController.signal),
          apiService.getMarketStatus(requestController.signal),
        ]);
        if (!active) return;

        setSymbols(fetched);
        setMarketStatus(
          backendMarketStatus === "Connected" && fetched.length < requestedSymbols.length
            ? "Degraded"
            : backendMarketStatus,
        );
        setSelectedSymbol((previous) =>
          fetched.some((item) => item.symbol === previous) ? previous : fetched[0]?.symbol ?? previous,
        );
      } catch (error) {
        if (!requestController.signal.aborted) {
          warnOnce("market-refresh", "AstraForge market data is unavailable.", error);
        }
        if (active) {
          setSymbols([]);
          setMarketStatus("Disconnected");
          resolvedSymbols = null;
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchTickers();
    const pollInterval = window.setInterval(() => void fetchTickers(), 30_000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    if (!selectedSymbol) {
      setSelectedSymbolIndicators(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchIndicators = async () => {
      setIndicatorsLoading(true);
      try {
        const indicatorSnapshot = await apiService.getIndicators(selectedSymbol, controller.signal);
        if (active) setSelectedSymbolIndicators(indicatorSnapshot);
      } catch (error) {
        if (!controller.signal.aborted) {
          warnOnce(`indicators-${selectedSymbol}`, `Indicators are unavailable for ${selectedSymbol}.`, error);
        }
        if (active) setSelectedSymbolIndicators(null);
      } finally {
        if (active) setIndicatorsLoading(false);
      }
    };

    void fetchIndicators();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedSymbol]);

  useEffect(() => {
    if (symbols.length === 0) return;
    setActiveTrades((previousTrades) =>
      previousTrades.map((trade) => {
        const symbol = symbols.find((item) => item.symbol === trade.symbol);
        if (!symbol || symbol.price <= 0) {
          // Preserve the last validated local snapshot. The Active Trades page
          // labels these values as last known whenever market data is unavailable.
          return trade;
        }

        const unrealizedPnL =
          trade.side === "Long"
            ? (symbol.price - trade.entryPrice) * trade.positionSize
            : (trade.entryPrice - symbol.price) * trade.positionSize;
        const pnlPercent =
          trade.marginUsed > 0 ? (unrealizedPnL / trade.marginUsed) * 100 : Number.NaN;
        const riskValue = Math.abs(trade.entryPrice - trade.stopLoss);
        const currentRMultiple =
          riskValue > 0
            ? (symbol.price - trade.entryPrice) /
              (trade.side === "Long" ? riskValue : -riskValue)
            : Number.NaN;

        return {
          ...trade,
          currentPrice: symbol.price,
          unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
          unrealizedPnLPercent: Number.isFinite(pnlPercent)
            ? Number(pnlPercent.toFixed(2))
            : Number.NaN,
          currentRMultiple: Number.isFinite(currentRMultiple)
            ? Number(currentRMultiple.toFixed(2))
            : Number.NaN,
        };
      }),
    );
  }, [symbols]);

  const addActivity = (message: string, type: ActivityType = "system") => {
    const timestamp = new Date().toLocaleTimeString();
    setActivities((previous) => [
      { id: `act-${Date.now()}`, time: timestamp, type, message },
      ...previous.slice(0, 24),
    ]);
  };

  const updateSymbolPrice = (symbol: string, newPrice: number) => {
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    setSymbols((previous) =>
      previous.map((item) => (item.symbol === symbol ? { ...item, price: newPrice } : item)),
    );
  };

  const updateSettings = (updater: (prev: AppSettings) => AppSettings) => {
    setSettings((previous) => updater(previous));
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    addActivity("Frontend preferences saved. Backend engine rules were not changed.", "system");
  };

  const restoreDefaultSettings = () => {
    setSettings(INITIAL_SETTINGS);
    addActivity("Frontend preferences restored to honest inactive defaults.", "system");
  };

  const toggleFavorite = (symbol: string) => {
    setFavorites((previous) =>
      previous.includes(symbol)
        ? previous.filter((item) => item !== symbol)
        : [...previous, symbol],
    );
  };

  const triggerEmergencyStop = () => {
    updateSettings((previous) => ({
      ...previous,
      automation: {
        ...previous.automation,
        botStatus: "Paused",
        autoExecution: false,
      },
      risk: {
        ...previous.risk,
        emergencyStop: true,
        currentRiskStatus: "Blocked",
      },
    }));
    addActivity(
      "Emergency Stop recorded as a local frontend preference only. Risk and execution engines are not implemented; no exchange action occurred.",
      "risk",
    );
  };

  const closeTrade = (id: string, reason = "Local plan closed") => {
    const trade = activeTrades.find((item) => item.id === id);
    if (!trade) return;

    const hasMarketPrice = Number.isFinite(trade.currentPrice) && trade.currentPrice > 0;
    const indicativePnl = hasMarketPrice && Number.isFinite(trade.unrealizedPnL)
      ? trade.unrealizedPnL
      : 0;
    const riskValue = Math.abs(trade.entryPrice - trade.stopLoss);
    const indicativeR =
      riskValue > 0 && trade.positionSize > 0 && Number.isFinite(indicativePnl)
        ? Number((indicativePnl / (trade.positionSize * riskValue)).toFixed(2))
        : 0;

    const closedItem: JournalTrade = {
      id: `local-${Date.now()}-${trade.id}`,
      date: new Date().toISOString().replace("T", " ").substring(0, 19),
      symbol: trade.symbol,
      side: trade.side,
      grade: trade.grade,
      strategy: trade.setupName,
      entry: trade.entryPrice,
      exit: hasMarketPrice ? trade.currentPrice : trade.entryPrice,
      pnl: indicativePnl,
      r: indicativeR,
      duration: trade.duration,
      exitReason: reason,
      details:
        "Locally tracked Demo plan closed in the frontend. This was not an exchange position or executed order; PnL is indicative only when backend market data was available.",
      source: "Locally Tracked Demo Plan",
      mode: "Demo",
      executionStatus: "Not Submitted / Not Executed",
      signalStatus: "Not Generated by Scanner",
      exchangeFees: "Not Applicable — No Exchange Execution",
      fundingFees: "Not Applicable — No Exchange Execution",
      executionId: "No Exchange Execution ID",
      orderId: "No Exchange Order ID",
    };

    setJournalTrades((previous) => [closedItem, ...previous]);
    setActiveTrades((previous) => previous.filter((item) => item.id !== id));
    addActivity(`Local Demo plan removed for ${trade.symbol}. No exchange action occurred.`, "trade");
  };

  const addActiveTrade = (trade: ActiveTrade) => {
    const localPlan: ActiveTrade = {
      ...trade,
      status: "Pending",
      source: "Locally Tracked Demo Plan",
      mode: "Demo",
      executionStatus: "Not Submitted / Not Executed",
      signalStatus: "Not Generated by Scanner",
      exchangeFees: "Not Applicable — No Exchange Execution",
      fundingFees: "Not Applicable — No Exchange Execution",
      executionId: "No Exchange Execution ID",
      orderId: "No Exchange Order ID",
    };
    setActiveTrades((previous) => [localPlan, ...previous.filter((item) => item.id !== localPlan.id)]);
    addActivity(
      `Locally tracked ${localPlan.side} Demo plan added for ${localPlan.symbol}. It was not submitted or executed.`,
      "trade",
    );
  };

  const triggerScan = () => {
    void (async () => {
      if (!authToken.isAvailable()) {
        addActivity(
          "Scanner action blocked: no authenticated session is available. Protected scanner mutations are disabled until a secure operator token is configured at runtime.",
          "scan",
        );
        return;
      }

      setIsScanning(true);
      try {
        const currentStatus = await scannerService.getStatus();
        setScannerStatus(currentStatus);

        if (!currentStatus.scannerRuntimeImplemented) {
          addActivity("Scanner runtime is unavailable in the connected backend.", "scan");
          return;
        }

        if (currentStatus.state === "OFF") {
          const startedStatus = await scannerService.start();
          setScannerStatus(startedStatus);
          addActivity(
            "Scanner runtime started from the frontend. The backend performs an immediate full-universe scan on start.",
            "scan",
          );
        } else {
          const runSummary = await scannerService.runNow();
          addActivity(
            `Scanner run finished with status ${runSummary.status}. Selected ${runSummary.selectedCandidates} candidates from ${runSummary.evaluatedSymbols} evaluated symbols.`,
            "scan",
          );
        }

        const [latestStatus, latestCandidates] = await Promise.all([
          scannerService.getStatus(),
          scannerService.getCandidates(),
        ]);
        setScannerStatus(latestStatus);
        setScannerResults(latestCandidates.candidates);
        setScannerSummary(latestCandidates.summary ?? latestStatus.latestRun ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scanner request failed.";
        warnOnce("scanner-action", "Scanner action failed.", error, 5_000);
        addActivity(message, "scan");
      } finally {
        setIsScanning(false);
      }
    })();
  };

  const triggerStopScanner = () => {
    void (async () => {
      if (!authToken.isAvailable()) {
        addActivity("Scanner stop blocked: configure the operator token in Settings for this browser session.", "scan");
        return;
      }
      setIsScanning(true);
      try {
        const stoppedStatus = await scannerService.stop();
        setScannerStatus(stoppedStatus);
        addActivity("Scanner runtime stopped by the backend.", "scan");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scanner stop failed.";
        warnOnce("scanner-stop", "Scanner stop failed.", error, 5_000);
        addActivity(message, "scan");
      } finally {
        setIsScanning(false);
      }
    })();
  };

  const clearJournal = () => {
    setJournalTrades([]);
    localStorage.removeItem(LOCAL_JOURNAL_STORAGE_KEY);
    addActivity("Local frontend journal cleared.", "system");
  };

  const exportJournalCSV = () => {
    const rows: readonly (readonly unknown[])[] = [
      [
        "ID", "Date", "Symbol", "Side", "Grade", "Strategy", "Entry Price", "Exit Price",
        "Indicative PnL (USD)", "Indicative R Multiple", "Duration", "Exit Reason", "Execution Status",
      ],
      ...journalTrades.map((trade) => [
        trade.id, trade.date, trade.symbol, trade.side, trade.grade, trade.strategy, trade.entry,
        trade.exit, trade.pnl, trade.r, trade.duration, trade.exitReason,
        trade.executionStatus ?? "Not Submitted / Not Executed",
      ]),
    ];
    const blob = new Blob(["\uFEFF", buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AstraForge_Local_Journal_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addActivity("Local frontend journal exported as CSV.", "system");
  };

  return (
    <TradingContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        selectedSymbol,
        setSelectedSymbol,
        settings,
        updateSettings,
        saveSettings,
        restoreDefaultSettings,
        activeTrades,
        closeTrade,
        addActiveTrade,
        journalTrades,
        clearJournal,
        scannerResults,
        scannerStatus,
        scannerSummary,
        scannerHealth,
        activities,
        addActivity,
        favorites,
        toggleFavorite,
        triggerEmergencyStop,
        triggerScan,
        triggerStopScanner,
        isScanning,
        exportJournalCSV,
        symbols,
        updateSymbolPrice,
        marketStatus,
        backendHealth,
        universeSummary,
        selectedSymbolIndicators,
        indicatorsLoading,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error("useTrading must be used within a TradingProvider");
  }
  return context;
};
