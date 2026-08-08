import React from "react";
import { ActiveTrades } from "./ActiveTrades";
import { Journal } from "./Journal";

export const TradesJournal: React.FC = () => {
  return (
    <div id="trades-journal-page" className="flex flex-col gap-6">
      <section aria-labelledby="active-trades-heading">
        <div className="mb-3">
          <h2 id="active-trades-heading" className="text-sm font-bold font-mono text-white uppercase tracking-wider">
            Active Trades
          </h2>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">
            Backend-authoritative open trade tracking.
          </p>
        </div>
        <ActiveTrades />
      </section>

      <section aria-labelledby="journal-heading" className="border-t border-zinc-900 pt-6">
        <div className="mb-3">
          <h2 id="journal-heading" className="text-sm font-bold font-mono text-white uppercase tracking-wider">
            Journal
          </h2>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">
            Backend-authoritative closed trade history and performance.
          </p>
        </div>
        <Journal />
      </section>
    </div>
  );
};
