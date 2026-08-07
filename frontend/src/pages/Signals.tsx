import React from "react";

import { SignalCardsPanel } from "../components/SignalCardsPanel";

export const Signals: React.FC = () => (
  <div id="signals-page" className="flex flex-col gap-4">
    <SignalCardsPanel />
  </div>
);
