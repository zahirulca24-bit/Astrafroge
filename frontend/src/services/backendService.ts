import {
  AstraForgeBackendStatus,
  BinanceAccountConnectionStatus,
  DemoExecutionAccountSnapshot,
  DemoExecutionStatusSnapshot,
} from "../types/trading";
import { apiService } from "./apiService";
import { demoExecutionService } from "./demoExecutionService";
import { warnOnce } from "./runtimeLogger";

export const backendService = {
  async getBackendStatus(signal?: AbortSignal): Promise<AstraForgeBackendStatus> {
    try {
      const isLive = await apiService.checkLiveHealth(signal);
      if (!isLive) return "Not connected";
      return await apiService.getSystemStatus(signal);
    } catch {
      return "Not connected";
    }
  },

  async getDemoExecutionStatus(signal?: AbortSignal): Promise<DemoExecutionStatusSnapshot | null> {
    try {
      return await demoExecutionService.getStatus(signal);
    } catch (error) {
      if (!signal?.aborted) warnOnce("demo-execution-status", "Demo execution status is unavailable.", error);
      return null;
    }
  },

  async getDemoAccountSnapshot(signal?: AbortSignal): Promise<DemoExecutionAccountSnapshot | null> {
    try {
      return await demoExecutionService.getAccount(signal);
    } catch (error) {
      if (!signal?.aborted) warnOnce("demo-account", "Demo account data is unavailable.", error);
      return null;
    }
  },

  resolveAccountExecutionStatus(
    executionStatus: DemoExecutionStatusSnapshot | null,
    accountSnapshot: DemoExecutionAccountSnapshot | null,
  ): BinanceAccountConnectionStatus {
    if (accountSnapshot?.demoPrivateExecutionReady) return "Connected";
    if (!executionStatus) return "Unavailable";
    if (!executionStatus.demoCredentialsConfigured) return "Not configured";
    if (!executionStatus.privateApiAvailable) return "Blocked";
    return "Error";
  },

  async getAccountExecutionStatus(signal?: AbortSignal): Promise<BinanceAccountConnectionStatus> {
    const executionStatus = await this.getDemoExecutionStatus(signal);
    const accountSnapshot = await this.getDemoAccountSnapshot(signal);
    return this.resolveAccountExecutionStatus(executionStatus, accountSnapshot);
  },

  async getTradeDiagnostic(_tradeId: string): Promise<null> {
    return null;
  },
};
