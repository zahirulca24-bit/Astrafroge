import React, { useEffect, useRef, useState } from "react";
import { useTrading } from "../store/TradingStore";
import { createChart, CandlestickSeries, LineSeries, CandlestickData, LineData, IChartApi } from "lightweight-charts";
import { ActiveTrade } from "../types";
import { GradeBadge } from "../components/SharedComponents";
import { marketDataService, CandleData } from "../services/marketDataService";
import { Star, Brain, FileSliders as Sliders, Zap, Info } from "lucide-react";

export const ChartPage: React.FC = () => {
  const {
    selectedSymbol,
    setSelectedSymbol,
    scannerResults,
    favorites,
    toggleFavorite,
    symbols,
    activeTrades,
    addActiveTrade,
    settings,
    selectedSymbolIndicators,
    indicatorsLoading,
  } = useTrading();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Timeframe states: "5M" | "15M" | "1H"
  const [timeframe, setTimeframe] = useState<"5M" | "15M" | "1H">("15M");

  // Load the symbol info
  const symbolInfo = symbols.find((s) => s.symbol === selectedSymbol) || symbols[0];
  const setupPlan = scannerResults.find((r) => r.symbol === selectedSymbol);

  const [positionSize, setPositionSize] = useState<number>(0.1);

  // Custom trade formulation states
  const [side, setSide] = useState<"Long" | "Short">("Long");
  const [customSL, setCustomSL] = useState<string>("");
  const [customTP1, setCustomTP1] = useState<string>("");
  const [customTP2, setCustomTP2] = useState<string>("");
  const [customTP3, setCustomTP3] = useState<string>("");

  const [customLeverage, setCustomLeverage] = useState<string>("");

  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize custom targets whenever symbol, side, or current price updates
  useEffect(() => {
    if (symbolInfo) {
      const price = symbolInfo.price;
      const dec = price > 100 ? 2 : 4;
      if (side === "Long") {
        setCustomSL((price * 0.985).toFixed(dec));
        setCustomTP1((price * 1.01).toFixed(dec));
        setCustomTP2((price * 1.022).toFixed(dec));
        setCustomTP3((price * 1.035).toFixed(dec));
      } else {
        setCustomSL((price * 1.015).toFixed(dec));
        setCustomTP1((price * 0.99).toFixed(dec));
        setCustomTP2((price * 0.978).toFixed(dec));
        setCustomTP3((price * 0.965).toFixed(dec));
      }
    }
  }, [selectedSymbol, side, symbolInfo?.price]);

  // Load actual candle sticks from AstraForge Backend
  useEffect(() => {
    let active = true;
    const fetchCandleData = async () => {
      setLoading(true);
      setError(null);
      try {
        const tfMap = { "5M": "5m", "15M": "15m", "1H": "1h" };
        const data = await marketDataService.fetchCandles(selectedSymbol, tfMap[timeframe] || "15m", 250);
        if (!active) return;
        setCandles(data);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch klines from AstraForge Backend:", err);
        if (active) {
          setCandles([]);
          setError("Market data unavailable");
          setLoading(false);
        }
      }
    };

    fetchCandleData();
    return () => {
      active = false;
    };
  }, [selectedSymbol, timeframe]);

  // Re-render chart when candles update
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Clear any previous chart contents
    chartContainerRef.current.innerHTML = "";

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { color: "#18181b" }, // bg-zinc-900
        textColor: "#a1a1aa" // text-zinc-400
      },
      grid: {
        vertLines: { color: "#222225" },
        horzLines: { color: "#222225" }
      },
      rightPriceScale: {
        borderColor: "#27272a"
      },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false
      }
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", // emerald-500
      downColor: "#ef4444", // rose-500
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444"
    });

    candlestickSeries.setData(candles as unknown as CandlestickData[]);

    // EMA calculations helper
    const calculateEMA = (data: CandleData[], period: number): LineData[] => {
      const ema: LineData[] = [];
      if (data.length < period) return ema;

      const k = 2 / (period + 1);
      const slice = data.slice(0, period);
      let prevEma = slice.reduce((acc, c) => acc + c.close, 0) / period;
      const first = data[period - 1];
      if (!first) return ema;
      ema.push({ time: first.time as LineData["time"], value: prevEma });

      for (let i = period; i < data.length; i++) {
        const current = data[i];
        if (!current) continue;
        const value = current.close * k + prevEma * (1 - k);
        ema.push({ time: current.time as LineData["time"], value });
        prevEma = value;
      }
      return ema;
    };

    // Add EMA lines
    const ema20Data = calculateEMA(candles, 20);
    if (ema20Data.length > 0) {
      const ema20Series = chart.addSeries(LineSeries, { color: "#f43f5e", lineWidth: 1 }); // rose-500
      ema20Series.setData(ema20Data);
    }

    const ema50Data = calculateEMA(candles, 50);
    if (ema50Data.length > 0) {
      const ema50Series = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 }); // amber-500
      ema50Series.setData(ema50Data);
    }

    const ema200Data = calculateEMA(candles, 200);
    if (ema200Data.length > 0) {
      const ema200Series = chart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 1 }); // purple-500
      ema200Series.setData(ema200Data);
    }

    // VWAP calculations helper
    const calculateVWAP = (data: CandleData[]): LineData[] => {
      const vwap: LineData[] = [];
      let cumulativePV = 0;
      let cumulativeVolume = 0;

      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        if (!c) continue;
        const high = c.high;
        const low = c.low;
        const close = c.close;
        const volume = c.volume;

        if (volume === undefined || isNaN(volume) || volume <= 0 || isNaN(high) || isNaN(low) || isNaN(close)) {
          continue;
        }

        const typicalPrice = (high + low + close) / 3;
        cumulativePV += typicalPrice * volume;
        cumulativeVolume += volume;

        if (cumulativeVolume > 0) {
          vwap.push({
            time: c.time as LineData["time"],
            value: cumulativePV / cumulativeVolume
          });
        }
      }
      return vwap;
    };

    const vwapData = calculateVWAP(candles);
    if (vwapData.length > 0) {
      const vwapSeries = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1 }); // blue-500
      vwapSeries.setData(vwapData);
    }

    // Draw Price Lines for Targets (Entry, SL, TP1, TP2, TP3)
    const drawPriceLine = (price: number, title: string, color: string, style: number) => {
      try {
        candlestickSeries.createPriceLine({
          price: price,
          color: color,
          lineWidth: 1,
          lineStyle: style, // 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed
          axisLabelVisible: true,
          title: title
        });
      } catch (e) {
        console.error("Error creating price line", e);
      }
    };

    if (setupPlan && setupPlan.grade !== "Rejected") {
      const avgEntryPrice = parseFloat((setupPlan.entryZone.split("-")[0] ?? setupPlan.entryZone).replace(/,/g, "")) || setupPlan.currentPrice;
      drawPriceLine(avgEntryPrice, "ENTRY ZONE", "#3b82f6", 2); // Blue Dashed
      drawPriceLine(setupPlan.stopLoss, "STOP LOSS", "#ef4444", 0); // Red Solid
      drawPriceLine(setupPlan.tp1, "TAKE PROFIT 1 (50%)", "#10b981", 1); // Emerald Dotted
      drawPriceLine(setupPlan.tp2, "TAKE PROFIT 2 (25%)", "#10b981", 1);
      drawPriceLine(setupPlan.tp3, "TAKE PROFIT 3 (25%)", "#047857", 1);
    } else {
      // Draw Price lines based on our custom formulation inputs
      const slVal = parseFloat(customSL);
      const tp1Val = parseFloat(customTP1);
      const tp3Val = parseFloat(customTP3);
      if (!isNaN(slVal)) drawPriceLine(slVal, "FORMULATED SL", "#ef4444", 0);
      if (!isNaN(tp1Val)) drawPriceLine(tp1Val, "FORMULATED TP1", "#10b981", 1);
      if (!isNaN(tp3Val)) drawPriceLine(tp3Val, "FORMULATED TP3", "#047857", 1);
    }

    // Handle resizing using ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartContainerRef.current) return;
      const firstEntry = entries[0];
      if (!firstEntry) return;
      const { width } = firstEntry.contentRect;
      chart.applyOptions({ width });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, setupPlan, customSL, customTP1, customTP3]);


  const handleDeployCustomTrade = () => {
    if (settings.risk.emergencyStop) {
      alert("Trade execution blocked: Emergency Stop is active.");
      return;
    }
    if (activeTrades.length >= settings.risk.maxOpenTrades) {
      alert(`Trade execution blocked: Max open trades limit (${settings.risk.maxOpenTrades}) reached.`);
      return;
    }

    if (!customLeverage) {
      alert("Trade execution blocked: Please explicitly select your desired leverage before submitting.");
      return;
    }

    const slVal = parseFloat(customSL);
    const tp1Val = parseFloat(customTP1);
    const tp2Val = parseFloat(customTP2);
    const tp3Val = parseFloat(customTP3);

    if (isNaN(slVal) || isNaN(tp1Val) || isNaN(tp2Val) || isNaN(tp3Val)) {
      alert("Please enter valid positive numbers for Stop Loss and Take Profits.");
      return;
    }

    if (side === "Long") {
      if (slVal >= (symbolInfo?.price ?? 0)) {
        alert("For Long trades, Stop Loss must be BELOW current price.");
        return;
      }
      if (tp1Val <= (symbolInfo?.price ?? 0)) {
        alert("For Long trades, Take Profit 1 must be ABOVE current price.");
        return;
      }
    } else {
      if (slVal <= (symbolInfo?.price ?? 0)) {
        alert("For Short trades, Stop Loss must be ABOVE current price.");
        return;
      }
      if (tp1Val >= (symbolInfo?.price ?? 0)) {
        alert("For Short trades, Take Profit 1 must be BELOW current price.");
        return;
      }
    }

    const leverageVal = parseInt(customLeverage);
    const currentPrice = symbolInfo?.price ?? 0;
    const margin = Number(((positionSize * currentPrice) / leverageVal).toFixed(2));
    const id = `trade-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString();

    const newActiveTrade: ActiveTrade = {
      id,
      symbol: selectedSymbol,
      side: side,
      grade: "N/A",
      score: 0,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      positionSize: positionSize,
      leverage: leverageVal,
      marginUsed: margin > 0 ? margin : 100.0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      stopLoss: slVal,
      tp1: tp1Val,
      tp2: tp2Val,
      tp3: tp3Val,
      currentRMultiple: 0,
      duration: "00h 01m",
      setupName: "Manual Custom Strategy",
      status: "Open",
      openedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      timeline: [
        { time: timestamp, event: `Manual position opened via Custom Formulation at ${currentPrice} USDT`, type: "system" },
        { time: timestamp, event: `SL target set: ${slVal}, TP1: ${tp1Val}, TP2: ${tp2Val}, TP3: ${tp3Val}`, type: "risk" },
        { time: timestamp, event: `Leverage selected: ${leverageVal}x`, type: "risk" }
      ],
      history: `Formulated manually from the primary trading chart for ${selectedSymbol}. Source: Manual, Mode: Demo, Execution Status: Not Executed, Signal Status: Not Generated by Scanner.`,
      source: "Manual",
      mode: "Demo",
      executionStatus: "Not Executed",
      signalStatus: "Not Generated by Scanner",
      exchangeFees: "Unavailable (Manual Demo)",
      fundingFees: "Unavailable (Manual Demo)",
      executionId: "Unavailable (Manual Demo)",
      orderId: "Unavailable (Manual Demo)"
    };

    addActiveTrade(newActiveTrade);
    alert(`Position of ${positionSize} ${symbolInfo?.baseAsset ?? ""} opened!`);
  };

  const currentGrade = setupPlan ? setupPlan.grade : "N/A";
  const indicatorBias = selectedSymbolIndicators?.bias ?? selectedSymbolIndicators?.trend ?? "Unavailable";
  const indicatorTimestamp = selectedSymbolIndicators?.evaluatedAt ?? "Unavailable";

  return (
    <div id="charts-page" className="flex flex-col gap-4">
      {/* Chart and Watchlist split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Main Chart Section on Left (9 cols) */}
        <div className="lg:col-span-9 flex flex-col gap-3">
          
          {/* Chart Header Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 select-none">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleFavorite(selectedSymbol)}
                className="text-zinc-500 hover:text-amber-400 transition-colors"
                title="Toggle favorite status"
              >
                <Star size={18} fill={favorites.includes(selectedSymbol) ? "#fbbf24" : "none"} className={favorites.includes(selectedSymbol) ? "text-amber-400" : "text-zinc-500"} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">{selectedSymbol}</span>
                  <GradeBadge grade={currentGrade} className="text-[9px]" />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">AstraForge Backend Price Feed</span>
              </div>

              <div className="text-right pl-4 border-l border-zinc-800">
                <span className="text-sm font-bold font-mono text-white">${(symbolInfo?.price ?? 0).toLocaleString()}</span>
                <div className={`text-[10px] font-mono font-medium flex items-center justify-end gap-0.5 ${(symbolInfo?.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                  {(symbolInfo?.change24h ?? 0) >= 0 ? "+" : ""}{symbolInfo?.change24h ?? 0}%
                </div>
              </div>
            </div>

            {/* Timeframe selector controls */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 border border-zinc-800 rounded-md">
              {(["5M", "15M", "1H"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                    timeframe === tf
                      ? "bg-orange-600 text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tf}
                  <span className="text-[8px] opacity-60 ml-0.5 block text-center uppercase">
                    {tf === "1H" ? "Trend" : tf === "15M" ? "Setup" : "Entry"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Actual Chart Container */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 overflow-hidden relative">
            {/* Top Indicator overlays */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 font-mono text-[9px] pointer-events-none select-none">
              <span className="bg-zinc-950/80 px-2 py-0.5 text-rose-500 rounded border border-zinc-800/50 font-medium">EMA 20</span>
              <span className="bg-zinc-950/80 px-2 py-0.5 text-amber-500 rounded border border-zinc-800/50 font-medium">EMA 50</span>
              <span className={`bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800/50 font-medium ${candles.length >= 200 ? "text-purple-500" : "text-zinc-500 line-through"}`}>
                EMA 200 {candles.length < 200 && "(Insufficient History)"}
              </span>
              <span className={`bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800/50 font-medium ${candles.length > 0 && candles.some(c => c.volume && c.volume > 0) ? "text-blue-500" : "text-zinc-500 line-through"}`}>
                VWAP {!(candles.length > 0 && candles.some(c => c.volume && c.volume > 0)) && "(Unavailable)"}
              </span>
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 text-sm text-zinc-400 font-mono z-20">
                Loading Live Candlestick Feed...
              </div>
            )}

            {!loading && (error || candles.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 gap-2 z-20">
                <span className="text-sm font-bold text-rose-500 font-mono">Market data unavailable</span>
                <span className="text-[10px] text-zinc-500 font-mono">Backend is not connected or symbol data fetch failed</span>
              </div>
            )}

            {/* Target Container */}
            <div ref={chartContainerRef} className="w-full h-[420px]" />
          </div>

        </div>

        {/* Watchlist Panel on Right (3 cols) */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 flex flex-col justify-between font-mono text-xs select-none">
          <div>
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 pb-2 border-b border-zinc-800 flex items-center justify-between">
              <span>Market Watchlist</span>
              <span className="text-[10px] text-zinc-500">Pairs count: {symbols.length}</span>
            </h3>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
              {symbols.map((sym) => {
                const isSelected = sym.symbol === selectedSymbol;
                const isFavorite = favorites.includes(sym.symbol);
                const results = scannerResults.find((r) => r.symbol === sym.symbol);
                const grade = results ? results.grade : "N/A";

                return (
                  <div
                    key={sym.symbol}
                    onClick={() => setSelectedSymbol(sym.symbol)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                      isSelected
                        ? "bg-orange-600/10 border-orange-500 text-orange-500"
                        : "bg-zinc-950 border-zinc-900 text-zinc-300 hover:bg-zinc-850/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(sym.symbol);
                        }}
                        className="text-zinc-600 hover:text-amber-400"
                      >
                        <Star size={12} fill={isFavorite ? "#fbbf24" : "none"} className={isFavorite ? "text-amber-400" : "text-zinc-600"} />
                      </button>
                      <span className="font-bold text-[11px]">{sym.symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-bold text-[11px]">${sym.price.toLocaleString()}</div>
                        <div className={`text-[9px] font-medium ${sym.change24h >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                          {sym.change24h >= 0 ? "+" : ""}{sym.change24h}%
                        </div>
                      </div>
                      <GradeBadge grade={grade} className="text-[8px] px-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-950 p-2 border border-zinc-850 rounded mt-4">
            <span className="text-zinc-500 text-[10px] block mb-1">AUTOMATION RADAR:</span>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Bot is executing scans every {settings.automation.scanIntervalSeconds} seconds. Standard setup triggers can be deployed directly into active trades.
            </p>
          </div>
        </div>

      </div>

      {/* Analysis and Trade Plan panels below (Two columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Backend Indicator Analysis Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3.5 pb-2 border-b border-zinc-800 flex items-center gap-1.5">
            <Brain size={14} className="text-purple-400" />
            Backend Indicator Snapshot
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-500">Backend Bias:</span>
              <span className={`font-bold ${indicatorBias.toLowerCase().includes("bull") || indicatorBias.toLowerCase().includes("long") ? "text-emerald-400" : indicatorBias.toLowerCase().includes("bear") || indicatorBias.toLowerCase().includes("short") ? "text-rose-500" : "text-zinc-300"}`}>
                {indicatorsLoading ? "LOADING..." : indicatorBias.toUpperCase()}
              </span>
            </div>

            {selectedSymbolIndicators ? (
              <>
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850 text-[11px] leading-relaxed text-zinc-300 space-y-2">
                  <div className="font-bold text-white uppercase text-[9px] tracking-wider">Indicator Endpoint Readout:</div>
                  <p>
                    Trend: {selectedSymbolIndicators.trend || "Unavailable"}.
                    RSI 14: {selectedSymbolIndicators.rsi14?.toFixed(2) ?? "Unavailable"}.
                    ATR 14: {selectedSymbolIndicators.atr14?.toFixed(4) ?? "Unavailable"}.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-zinc-950/50 p-2 rounded border border-zinc-850">
                    <div className="text-zinc-500 text-[9px] uppercase">EMA Stack</div>
                    <div className="mt-1 text-zinc-300">
                      20: {selectedSymbolIndicators.ema20?.toFixed(4) ?? "N/A"}
                    </div>
                    <div className="text-zinc-300">
                      50: {selectedSymbolIndicators.ema50?.toFixed(4) ?? "N/A"}
                    </div>
                    <div className="text-zinc-300">
                      200: {selectedSymbolIndicators.ema200?.toFixed(4) ?? "N/A"}
                    </div>
                  </div>
                  <div className="bg-zinc-950/50 p-2 rounded border border-zinc-850">
                    <div className="text-zinc-500 text-[9px] uppercase">Reference Values</div>
                    <div className="mt-1 text-zinc-300">
                      VWAP: {selectedSymbolIndicators.vwap?.toFixed(4) ?? "N/A"}
                    </div>
                    <div className="text-zinc-300">
                      MACD Hist: {selectedSymbolIndicators.macdHistogram?.toFixed(4) ?? "N/A"}
                    </div>
                    <div className="text-zinc-300 break-words">
                      Updated: {indicatorTimestamp}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-zinc-500 italic">No backend indicator payload is available for this pair yet.</p>
            )}

            <div className="bg-amber-950/20 border border-amber-950 p-2.5 rounded flex items-start gap-2">
              <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-300 leading-relaxed">
                <span className="font-bold">Disclaimer:</span> This panel reflects backend-supplied indicator data when available. It does not place orders or replace the unavailable scanner and execution engines.
              </div>
            </div>
          </div>
        </div>

        {/* Trade Execution Plan Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3.5 pb-2 border-b border-zinc-800 flex items-center gap-1.5">
              <Sliders size={14} className="text-blue-400" />
              Immediate Order Execution Plan
            </h3>

            {setupPlan && setupPlan.grade !== "Rejected" ? (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 rounded border border-zinc-850">
                  <div>
                    <span className="text-zinc-500 text-[9px] uppercase">R:R Multiple</span>
                    <span className="block font-bold mt-0.5 text-sm text-orange-400">1 : {setupPlan.riskReward}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[9px] uppercase">Grade Quality</span>
                    <span className="block font-bold mt-0.5 text-sm"><GradeBadge grade={setupPlan.grade} className="text-[10px]" /></span>
                  </div>
                </div>

                {/* SL, TP targets summary */}
                <div className="space-y-1 text-[11px] bg-zinc-950/50 p-2.5 rounded border border-zinc-850">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Suggested Entry:</span>
                    <span className="text-blue-400 font-bold">${setupPlan.entryZone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Stop Loss (Risk Limit):</span>
                    <span className="text-rose-400 font-bold">${setupPlan.stopLoss.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 1 (50%):</span>
                    <span className="text-zinc-300 font-bold">${setupPlan.tp1.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 2 (25%):</span>
                    <span className="text-zinc-300 font-bold">${setupPlan.tp2.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Take Profit 3 (25%):</span>
                    <span className="text-zinc-300 font-bold">${setupPlan.tp3.toLocaleString()}</span>
                  </div>
                </div>

                {/* Estimate form sizing */}
                <div className="flex items-center gap-3 bg-zinc-950 p-2.5 border border-zinc-850 rounded">
                  <span className="text-zinc-500 shrink-0">Intraday Position Size:</span>
                  <input
                    type="number"
                    value={positionSize}
                    onChange={(e) => setPositionSize(parseFloat(e.target.value) || 0.1)}
                    step="0.05"
                    min="0.01"
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-white text-xs font-mono font-bold w-24 text-center focus:outline-none focus:border-zinc-700"
                  />
                  <span className="text-zinc-400 font-bold">{symbolInfo?.baseAsset}</span>
                  <span className="text-zinc-600 text-[10px]">(~ ${(positionSize * (symbolInfo?.price ?? 0)).toFixed(2)} USD)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-850 mb-1 leading-normal">
                  <span className="text-orange-400 font-bold">MANUAL OVERRIDE:</span> No active automated scanner results for this pair. Formulate a custom target setup using real-time price feeds.
                </div>

                {/* Position Sizing and Side Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSide("Long")}
                    className={`py-1.5 rounded font-bold text-xs transition-colors border ${
                      side === "Long"
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                    }`}
                  >
                    LONG TARGET
                  </button>
                  <button
                    onClick={() => setSide("Short")}
                    className={`py-1.5 rounded font-bold text-xs transition-colors border ${
                      side === "Short"
                        ? "bg-rose-600 border-rose-500 text-white"
                        : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                    }`}
                  >
                    SHORT TARGET
                  </button>
                </div>

                {/* Form targets */}
                <div className="space-y-2 bg-zinc-950 p-2.5 rounded border border-zinc-850 text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-zinc-500 text-[9px] block">STOP LOSS</span>
                      <input
                        type="text"
                        value={customSL}
                        onChange={(e) => setCustomSL(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-rose-400 font-bold focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] block">TAKE PROFIT 1</span>
                      <input
                        type="text"
                        value={customTP1}
                        onChange={(e) => setCustomTP1(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-zinc-500 text-[9px] block">TAKE PROFIT 2</span>
                      <input
                        type="text"
                        value={customTP2}
                        onChange={(e) => setCustomTP2(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 font-semibold focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] block">TAKE PROFIT 3</span>
                      <input
                        type="text"
                        value={customTP3}
                        onChange={(e) => setCustomTP3(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 font-semibold focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Sizing Input */}
                <div className="flex items-center gap-3 bg-zinc-950 p-2 border border-zinc-850 rounded">
                  <span className="text-zinc-500 shrink-0 text-[10px]">Position Size:</span>
                  <input
                    type="number"
                    value={positionSize}
                    onChange={(e) => setPositionSize(parseFloat(e.target.value) || 0.1)}
                    step="0.05"
                    min="0.01"
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-white text-xs font-mono font-bold w-20 text-center focus:outline-none focus:border-zinc-750"
                  />
                  <span className="text-zinc-400 font-bold">{symbolInfo?.baseAsset}</span>
                  <span className="text-zinc-600 text-[9px]">(~ ${(positionSize * (symbolInfo?.price || 0)).toFixed(1)} USD)</span>
                </div>

                {/* Leverage Input */}
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-850 text-[11px]">
                  <span className="text-zinc-500 text-[9px] block uppercase font-bold mb-1">Leverage (Required)</span>
                  <select
                    value={customLeverage}
                    onChange={(e) => setCustomLeverage(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-orange-400 font-bold focus:outline-none focus:border-orange-500 cursor-pointer text-xs"
                  >
                    <option value="">Select leverage...</option>
                    <option value="1">1x (Spot equivalent)</option>
                    <option value="2">2x</option>
                    <option value="5">5x</option>
                    <option value="10">10x</option>
                    <option value="15">15x</option>
                    <option value="20">20x</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {setupPlan && setupPlan.grade !== "Rejected" ? (
            <button
              disabled={true}
              className="mt-4 bg-zinc-800 text-zinc-500 cursor-not-allowed font-bold py-2.5 rounded transition-all text-center flex items-center justify-center gap-2"
            >
              <Zap size={14} />
              <span>Backend Signal Engine is not available yet.</span>
            </button>
          ) : (
            <button
              onClick={handleDeployCustomTrade}
              className="mt-4 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold py-2.5 rounded transition-all text-center flex items-center justify-center gap-2"
            >
              <Zap size={14} />
              <span>Deploy Formulated Intraday Trade</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
