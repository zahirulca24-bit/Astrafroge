import { Suspense, lazy } from "react";
import { TradingProvider, useTrading } from "./store/TradingStore";
import { AppSidebar, AppHeader } from "./components/SharedComponents";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ScannerSignals = lazy(() => import("./pages/ScannerSignals").then((m) => ({ default: m.ScannerSignals })));
const ChartPage = lazy(() => import("./pages/ChartPage").then((m) => ({ default: m.ChartPage })));
const TradesJournal = lazy(() => import("./pages/TradesJournal").then((m) => ({ default: m.TradesJournal })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-zinc-500 font-mono text-xs">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
        <span>Loading terminal module…</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentPage, tradingRecordsLoading, tradingRecordsError } = useTrading();
  const isScannerSignals = currentPage === "Scanner" || currentPage === "Signals";
  const isTradesJournal = currentPage === "Active Trades" || currentPage === "Journal";

  const renderPage = () => {
    switch (currentPage) {
      case "Dashboard":
        return <Dashboard />;
      case "Scanner":
      case "Signals":
        return <ScannerSignals />;
      case "Chart & Watchlist":
        return <ChartPage />;
      case "Active Trades":
      case "Journal":
        return <TradesJournal />;
      case "Settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const displayPage = isScannerSignals ? "Scanner & Signals" : isTradesJournal ? "Trades & Journal" : currentPage;

  return (
    <div className={`phase5-navigation flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-black text-zinc-100 font-sans ${isScannerSignals ? "scanner-signals-active" : ""} ${isTradesJournal ? "trades-journal-active" : ""}`}>
      <style>{`
        .phase5-navigation nav > button:nth-child(3) { display: none; }
        .phase5-navigation nav > button:nth-child(2) > span { font-size: 0; }
        .phase5-navigation nav > button:nth-child(2) > span::after { content: "Scanner & Signals"; font-size: 0.75rem; }
        .phase5-navigation nav > button:nth-child(6) { display: none; }
        .phase5-navigation nav > button:nth-child(5) > span { font-size: 0; }
        .phase5-navigation nav > button:nth-child(5) > span::after { content: "Trades & Journal"; font-size: 0.75rem; }
        .scanner-signals-active header h1,
        .trades-journal-active header h1 { font-size: 0; }
        .scanner-signals-active header h1::after { content: "Scanner & Signals"; font-size: 0.875rem; }
        .trades-journal-active header h1::after { content: "Trades & Journal"; font-size: 0.875rem; }
      `}</style>
      <AppSidebar />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <div className="sr-only" aria-live="polite">{displayPage}</div>
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 bg-zinc-950">
          <div className="w-full pb-8">
            {tradingRecordsError && (
              <div className="mb-4 rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 font-mono text-[11px] text-rose-300">
                Backend trading records failed: {tradingRecordsError}
              </div>
            )}
            {tradingRecordsLoading && isTradesJournal && (
              <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-400">
                Loading backend-authoritative trading records…
              </div>
            )}
            <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TradingProvider>
      <AppContent />
    </TradingProvider>
  );
}
