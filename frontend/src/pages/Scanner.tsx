import React from "react";

import { ScannerTablePanel } from "../components/ScannerTablePanel";
import { useTrading } from "../store/TradingStore";

export const Scanner: React.FC = () => {
  const { mutationBanner } = useTrading();

  return (
    <div id="scanner-page" className="flex min-h-[calc(100vh-120px)] flex-col gap-3">
      {mutationBanner?.page === "Scanner" && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-2 font-mono text-xs text-rose-300">
          <div className="font-bold text-rose-200">{mutationBanner.title}</div>
          <div className="mt-1">{mutationBanner.message}</div>
          {(mutationBanner.code || mutationBanner.statusCode) && (
            <div className="mt-1 text-[10px] text-rose-400/90">
              {mutationBanner.code ?? "HTTP"}
              {mutationBanner.statusCode ? ` (${mutationBanner.statusCode})` : ""}
            </div>
          )}
        </div>
      )}
      <ScannerTablePanel />
    </div>
  );
};
