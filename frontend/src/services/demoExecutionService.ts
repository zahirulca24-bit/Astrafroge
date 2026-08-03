import { DemoExecutionAccountSnapshot, DemoExecutionStatusSnapshot } from "../types/trading";
import { apiClient, isRecord } from "./apiClient";

function readNumber(record: Record<string, unknown>, key: string): number {
  const parsed = typeof record[key] === "number" ? record[key] : Number(record[key]);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric field: ${key}`);
  return parsed;
}

function readString(record: Record<string, unknown>, key: string, required = false): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new Error(`Invalid string field: ${key}`);
  return null;
}

function readIsoDate(record: Record<string, unknown>, key: string, required = false): string | null {
  const value = readString(record, key, required);
  if (value === null) return null;
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid date field: ${key}`);
  return value;
}

export const demoExecutionService = {
  async getStatus(signal?: AbortSignal): Promise<DemoExecutionStatusSnapshot> {
    const data = await apiClient.get<unknown>("/api/v1/execution/demo/status", { signal });
    if (!isRecord(data) || !isRecord(data.summary)) throw new Error("Invalid demo execution status response");
    const summary = data.summary;
    return {
      state: readString(data, "state", true)!,
      demoExecutionImplemented: data.demo_execution_implemented === true,
      executionEnabled: data.execution_enabled === true,
      demoCredentialsConfigured: data.demo_credentials_configured === true,
      privateApiAvailable: data.private_api_available === true,
      riskEngineState: readString(data, "risk_engine_state", true)!,
      takeProfitRMultiple: readNumber(data, "take_profit_r_multiple"),
      maxOpenTradesLimit: readNumber(data, "max_open_trades_limit"),
      trackedTradeCount: readNumber(data, "tracked_trade_count"),
      availableTrackingSlots: readNumber(data, "available_tracking_slots"),
      combinedUnrealizedPnlUsdt: readNumber(data, "combined_unrealized_pnl_usdt"),
      totalTrackedMarginUsdt: readNumber(data, "total_tracked_margin_usdt"),
      updatedAt: readIsoDate(data, "updated_at"),
      summary: {
        executablePlans: readNumber(summary, "executable_plans"),
        blockedPlans: readNumber(summary, "blocked_plans"),
        watchPlans: readNumber(summary, "watch_plans"),
        openTrades: readNumber(summary, "open_trades"),
        longDemo: readNumber(summary, "long_demo"),
        shortDemo: readNumber(summary, "short_demo"),
      },
    };
  },

  async getAccount(signal?: AbortSignal): Promise<DemoExecutionAccountSnapshot> {
    const data = await apiClient.get<unknown>("/api/v1/execution/demo/account", { signal });
    if (!isRecord(data)) throw new Error("Invalid demo account response");
    return {
      demoPrivateExecutionReady: data.demo_private_execution_ready === true,
      canTrade: data.can_trade === true,
      updatedAt: readIsoDate(data, "updated_at", true)!,
      totalWalletBalanceUsdt: readNumber(data, "total_wallet_balance_usdt"),
      availableBalanceUsdt: readNumber(data, "available_balance_usdt"),
      totalUnrealizedPnlUsdt: readNumber(data, "total_unrealized_pnl_usdt"),
      balances: Array.isArray(data.balances) ? data.balances : [],
      openPositions: Array.isArray(data.open_positions) ? data.open_positions : [],
    };
  },
};
