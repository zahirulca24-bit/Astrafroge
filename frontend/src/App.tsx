import { Suspense, lazy } from "react";
import { TradingProvider, useTrading } from "./store/TradingStore";
import { AppSidebar, AppHeader } from "./components/SharedComponents";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Scanner = lazy(() => import("./pages/Scanner").then((m) => ({ default: m.Scanner })));
const Signals = lazy(() => import("./pages/Signals").then((m) => ({ default: m.Signals })));
const ChartPage = lazy(() => import("./pages/ChartPage").then((m) => ({ default: m.ChartPage })));
const ActiveTrades = lazy(() => import("./pages/ActiveTrades").then((m) => ({ default: m.ActiveTrades })));
const Journal = lazy(() => import("./pages/Journal").then((m) => ({ default: m.Journal })));
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
  const { currentPage } = useTrading();

  const renderPage = () => {
    switch (currentPage) {
      case "Dashboard":
        return <Dashboard />;
      case "Scanner":
        return <Scanner />;
      case "Signals":
        return <Signals />;
      case "Chart & Watchlist":
        return <ChartPage />;
      case "Active Trades":
        return <ActiveTrades />;
      case "Journal":
        return <Journal />;
      case "Settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-black text-zinc-100 font-sans">
      <AppSidebar />
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 bg-zinc-950">
          <div className="w-full pb-8">
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
