export type TradingGrade = "A+" | "A" | "B+" | "Rejected" | "N/A";

export type TrendRegime = "Strong Bullish" | "Weak Bullish" | "Sideways" | "Weak Bearish" | "Strong Bearish";

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  closeTime?: string;
  fetchedAt?: string;
  stale?: boolean;
  cacheAgeSeconds?: number;
}

export interface ScannerResult {
  candidateId?: string;
  signalId?: string;
  riskAssessmentId?: string;
  executionPlanId?: string;
  universeRank?: number;
  symbol: string;
  side: "Long" | "Short" | "N/A";
  currentPrice: number;
  volume24h: number;
  trend1h: string;
  setup15m: string;
  entry5m: string;
  grade: TradingGrade;
  score: number;
  riskReward: number;
  status: "Ready Now" | "Near Setup" | "Rejected" | "Failed";
  entryZone: string;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confidence: number;
  setupReasons: string[];
  rejectionReasons?: string[];
  riskWarnings?: string[];
}

export type ScannerEngineState = "OFF" | "ON";
export type ScannerEngineHealth = "Unavailable" | "Off" | "Running";

export interface ScannerRunSummary {
  runId: string;
  status: "RUNNING" | "COMPLETED" | "DEGRADED" | "FAILED" | "SKIPPED";
  runType: "FULL_UNIVERSE_SCAN" | "ACTIVE_CANDIDATE_REFRESH";
  runStartedAt: string;
  completedAt?: string | null;
  universeSize: number;
  evaluatedSymbols: number;
  successfulSymbols: number;
  failedSymbols: number;
  discoveredCandidates: number;
  selectedCandidates: number;
  updatedCandidates: number;
  qualifiedCandidates: number;
  audits?: ScannerAuditRecord[];
}

export interface ScannerAuditRecord {
  code: string;
  detail: string;
  symbol?: string | null;
  universeRank?: number | null;
  direction?: "LONG" | "SHORT" | null;
  setup?: string | null;
  timeframe?: string | null;
}

export interface ScannerRuntimeStatus {
  state: ScannerEngineState;
  contractVersion: string;
  scannerRuntimeImplemented: boolean;
  runActive: boolean;
  schedulerRunning: boolean;
  nextFullScanAt?: string | null;
  nextRefreshAt?: string | null;
  lastRefreshBoundary?: string | null;
  activeCandidateCount: number;
  terminalCandidateCount: number;
  latestRun?: ScannerRunSummary | null;
}

export interface ScannerCandidatesSnapshot {
  candidates: ScannerResult[];
  summary: ScannerRunSummary | null;
  summaryState: ScannerEngineState | null;
}

export type SignalLifecycle = "ACTIVE" | "WATCH" | "EXPIRED" | "INVALIDATED" | "REJECTED" | "RISK_BLOCKED";
export type SignalEngineState = "READY" | "WAITING_FOR_SCANNER";

export interface SignalRecordView {
  signalId: string;
  candidateId: string;
  version: number;
  symbol: string;
  side: "Long" | "Short";
  setup: string;
  setupName: string;
  lifecycle: SignalLifecycle;
  scannerLifecycle: string;
  grade: TradingGrade;
  score: number;
  confidence: number;
  entryReady: boolean;
  entryTriggerPrice: number;
  stopLossPrice: number;
  evaluatedAt: string;
  updatedAt?: string | null;
  sourceRunId?: string | null;
  universeRank: number;
  quoteVolume: number;
  spreadBps: number;
  acceptedReasons: string[];
  auditCodes: string[];
}

export interface SignalSummaryView {
  activeSignals: number;
  aPlusSignals: number;
  aSignals: number;
  bPlusWatch: number;
  expired: number;
  riskBlocked: number;
}

export interface SignalStatusView {
  state: SignalEngineState;
  scannerState: string;
  activeSignalCount: number;
  watchSignalCount: number;
  terminalSignalCount: number;
  updatedAt?: string | null;
  latestScannerRunAt?: string | null;
  summary: SignalSummaryView;
}

export type TradeStatus =
  | "Pending"
  | "Submitted"
  | "Open"
  | "TP1 Hit"
  | "Breakeven Protected"
  | "TP2 Hit"
  | "TP3 Hit"
  | "Stop Loss Hit"
  | "Manually Closed"
  | "Risk Engine Closed"
  | "Closed";

export interface ActiveTrade {
  id: string;
  signalId?: string;
  executionPlanId?: string;
  backendAuthoritative?: boolean;
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
  source?: string;
  mode?: string;
  executionStatus?: string;
  signalStatus?: string;
  exchangeFees?: string;
  fundingFees?: string;
  executionId?: string;
  orderId?: string;
}

export interface JournalTrade {
  id: string;
  signalId?: string;
  tradeId?: string;
  backendAuthoritative?: boolean;
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
  source?: string;
  mode?: string;
  executionStatus?: string;
  signalStatus?: string;
  exchangeFees?: string;
  fundingFees?: string;
  executionId?: string;
  orderId?: string;
}

export interface BinanceConnectionSettings {
  connected: boolean;
  environment: "Demo Only";
  accountType: "Spot" | "Futures";
  apiKey: string;
  apiSecret: string;
  balance: number;
  lastSync: string;
  permissionStatus: string[];
}

export interface TradingRulesSettings {
  timeframe1h: string;
  timeframe15m: string;
  timeframe5m: string;
  longEnabled: boolean;
  shortEnabled: boolean;
  gradeAPlusEnabled: boolean;
  gradeAEnabled: boolean;
  gradeBPlusWatchOnly: boolean;
  minimumConfidence: number;
  minimumRiskReward: number;
  allowedStrategies: string[];
  minimum24hVolume: number;
  maximumSignalAgeMinutes: number;
  sessionStartTime: string;
  sessionEndTime: string;
}

export interface RiskEngineSettings {
  riskPerTradePercent: number;
  dailyLossLimitPercent: number;
  dailyProfitLockPercent: number;
  maxOpenTrades: number;
  maxTotalExposureUsd: number;
  maxLeverage: number;
  perSymbolTradeLimit: number;
  consecutiveLossPauseCount: number;
  emergencyStop: boolean;
  currentRiskStatus: "Safe" | "Warning" | "Blocked";
}

export interface AutomationSettings {
  autoScan: boolean;
  autoSignal: boolean;
  autoExecution: boolean;
  autoSlTp: boolean;
  autoMoveToBreakeven: boolean;
  partialTakeProfit: boolean;
  scanIntervalSeconds: number;
  botStatus: "Running" | "Paused";
  allowOutsideSession: boolean;
}

export interface NotificationSettings {
  tradeOpened: boolean;
  tpHit: boolean;
  slHit: boolean;
  riskBlock: boolean;
  connectionLost: boolean;
  dailyProfitAlert: boolean;
  dailyLossAlert: boolean;
  telegramEnabled: boolean;
  telegramChatId: string;
  browserEnabled: boolean;
}

export interface SystemSettings {
  version: string;
  frontendStatus: string;
  backendStatusPlaceholder: string;
  dataFeedHealthPlaceholder: string;
  lastEngineUpdatePlaceholder: string;
  logRetentionDays: number;
}

export interface AppSettings {
  binance: BinanceConnectionSettings;
  rules: TradingRulesSettings;
  risk: RiskEngineSettings;
  automation: AutomationSettings;
  notifications: NotificationSettings;
  system: SystemSettings;
}
