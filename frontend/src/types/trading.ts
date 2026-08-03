import { TradingGrade, TradeStatus } from "../types";

export interface ActiveTrade {
  id: string;
  symbol: string;
  side: "Long" | "Short";
  grade: TradingGrade;
  score: number;
  entryPrice: number;
  currentPrice: number;
  positionSize: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  currentRMultiple: number;
  duration: string;
  setupName: string;
  status: TradeStatus;
  openedAt: string;
  timeline: {
    time: string;
    event: string;
    type: "system" | "action" | "risk";
  }[];
  history: string;
}

export interface JournalTrade {
  id: string;
  date: string;
  symbol: string;
  side: "Long" | "Short";
  grade: TradingGrade;
  strategy: string;
  entry: number;
  exit: number;
  pnl: number;
  r: number;
  duration: string;
  exitReason: string;
  details: string;
}

export interface DemoExecutionStatusSnapshot {
  state: string;
  demoExecutionImplemented: boolean;
  executionEnabled: boolean;
  demoCredentialsConfigured: boolean;
  privateApiAvailable: boolean;
  riskEngineState: string;
  takeProfitRMultiple: number;
  maxOpenTradesLimit: number;
  trackedTradeCount: number;
  availableTrackingSlots: number;
  combinedUnrealizedPnlUsdt: number;
  totalTrackedMarginUsdt: number;
  updatedAt: string | null;
  summary: {
    executablePlans: number;
    blockedPlans: number;
    watchPlans: number;
    openTrades: number;
    longDemo: number;
    shortDemo: number;
  };
}

export interface DemoExecutionAccountSnapshot {
  demoPrivateExecutionReady: boolean;
  canTrade: boolean;
  updatedAt: string;
  totalWalletBalanceUsdt: number;
  availableBalanceUsdt: number;
  totalUnrealizedPnlUsdt: number;
  balances: unknown[];
  openPositions: unknown[];
}

export type AstraForgeBackendStatus = "Connected" | "Not connected" | "Error";
export type BinanceAccountConnectionStatus = "Not configured" | "Connected" | "Blocked" | "Error" | "Unavailable";
