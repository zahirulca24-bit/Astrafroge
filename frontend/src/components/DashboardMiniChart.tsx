import React, { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, CandlestickData } from "lightweight-charts";
import { marketDataService, CandleData } from "../services/marketDataService";
import { warnOnce } from "../services/runtimeLogger";

export const DashboardMiniChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;

    const loadData = async () => {
      if (inFlight) return;
      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;
      try {
        if (active) setLoading(true);
        const data = await marketDataService.fetchCandles("BTCUSDT", "1h", 80, requestController.signal);
        if (active) {
          setCandles(data);
          setError(null);
        }
      } catch (fetchError) {
        if (!requestController.signal.aborted) {
          warnOnce("dashboard-mini-chart", "Dashboard candle data is unavailable.", fetchError);
        }
        if (active) {
          setCandles([]);
          setError("Market data unavailable");
        }
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    void loadData();
    const interval = window.setInterval(() => void loadData(), 30_000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;
    chartContainerRef.current.innerHTML = "";

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 120,
      layout: { background: { color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { color: "#1f1f22" }, horzLines: { color: "#1f1f22" } },
      rightPriceScale: { borderColor: "#27272a", visible: true },
      timeScale: { borderColor: "#27272a", timeVisible: true, secondsVisible: false },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candlestickSeries.setData(candles as unknown as CandlestickData[]);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.resize(chartContainerRef.current.clientWidth, 120);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles]);

  return (
    <div className="w-full bg-zinc-950/60 p-2 border border-zinc-850 rounded-lg relative overflow-hidden">
      <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-mono">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${error ? "bg-rose-500" : candles.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
          BTC/USDT Backend Candle Preview
        </span>
        <span className="text-zinc-400 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">1H Interval</span>
      </div>
      <div className="relative h-[120px] w-full">
        {loading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-[10px] text-zinc-500 font-mono">Loading market candles…</div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-[10px] text-rose-500 font-mono">{error}</div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
