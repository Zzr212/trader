
import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  IChartApi, 
  ISeriesApi, 
  IPriceLine,
  CandlestickSeries,
  AreaSeries,
  LineSeries
} from 'lightweight-charts';
import { Candle, ChartMode, TradePosition, TradeSignal, TradeAction } from '../types';

interface TradingChartProps {
  data: Candle[];
  mode: ChartMode;
  positions: TradePosition[];
  lastSignal: TradeSignal | null;
  onLoadMore: () => Promise<void>;
  symbol: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ data, mode, positions, lastSignal, onLoadMore, symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#0f172a' },
        horzLines: { color: '#0f172a' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { 
        borderColor: '#1e293b',
        autoScale: true,
      },
      timeScale: { 
        borderColor: '#1e293b', 
        timeVisible: true, 
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
      if (range && range.from < 0 && !isLoadingMore) {
        setIsLoadingMore(true);
        await onLoadMore();
        setIsLoadingMore(false);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update Data & Mode
  useEffect(() => {
    if (!chartRef.current) return;
    
    // Reset series if type changes
    if (seriesRef.current && seriesRef.current.seriesType() !== (mode === 'CANDLES' ? 'Candlestick' : mode === 'AREA' ? 'Area' : 'Line')) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Create series if not exists
    if (!seriesRef.current) {
      const commonOptions = {
        priceFormat: { type: 'price' as const, precision: 2, minMove: 0.01 },
      };

      if (mode === 'CANDLES') {
        seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
          ...commonOptions,
          upColor: '#10b981', downColor: '#ef4444',
          borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
        });
      } else if (mode === 'AREA') {
        seriesRef.current = chartRef.current.addSeries(AreaSeries, {
          ...commonOptions,
          lineColor: '#6366f1', topColor: 'rgba(99, 102, 241, 0.4)', bottomColor: 'rgba(99, 102, 241, 0)',
        });
      } else {
        seriesRef.current = chartRef.current.addSeries(LineSeries, { 
          ...commonOptions,
          color: '#818cf8', lineWidth: 2 
        });
      }
    }

    // Set Data
    if (data.length > 0) {
      const sortedData = [...data].sort((a, b) => a.time - b.time);
      seriesRef.current.setData(sortedData as any);
    }
  }, [data, mode, symbol]); // Re-run when symbol changes to refresh data display

  // Update Lines (Positions + Algo Patterns)
  useEffect(() => {
    if (!seriesRef.current) return;

    // 1. Clean existing lines
    linesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
    linesRef.current = [];

    // 2. Draw Active Position or Signal
    const activePos = positions.find(p => p.symbol === symbol);
    const signal = lastSignal && lastSignal.symbol === symbol && lastSignal.action !== TradeAction.HOLD ? lastSignal : null;
    const target = activePos || signal;

    if (target) {
      const isSignal = !activePos;
      const opacity = isSignal ? 0.4 : 0.8;
      const lineStyle = isSignal ? 2 : 0;
      const entryPrice = activePos ? activePos.entryPrice : signal?.entry;

      if (entryPrice) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: entryPrice,
          color: activePos ? '#3b82f6' : `rgba(255, 255, 255, ${opacity})`,
          lineWidth: 2,
          lineStyle,
          axisLabelVisible: true,
          title: activePos ? `${activePos.type} ENTRY` : `SIGNAL`,
        }));
      }

      if (target.tp) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: target.tp,
          color: `rgba(16, 185, 129, ${opacity})`,
          lineWidth: 1,
          lineStyle,
          axisLabelVisible: true,
          title: 'TP',
        }));
      }

      if (target.sl) {
        linesRef.current.push(seriesRef.current.createPriceLine({
          price: target.sl,
          color: `rgba(239, 68, 68, ${opacity})`,
          lineWidth: 1,
          lineStyle,
          axisLabelVisible: true,
          title: 'SL',
        }));
      }
    }

    // 3. Draw Algo Detected Lines (Support/Resistance)
    if (lastSignal && lastSignal.symbol === symbol && lastSignal.chartLines) {
      lastSignal.chartLines.forEach(line => {
         linesRef.current.push(seriesRef.current!.createPriceLine({
           price: line.price,
           color: line.color,
           lineWidth: 1,
           lineStyle: 3, // Dotted
           axisLabelVisible: false,
           title: line.title
         }));
      });
    }

  }, [positions, lastSignal, symbol]);

  return (
    <div className="relative group">
      <div ref={chartContainerRef} className="w-full border-y border-white/5 h-[400px] transition-opacity" />
      {/* Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-black text-6xl pointer-events-none z-0">
        {symbol}
      </div>
      {/* Pattern Tags */}
      {lastSignal && lastSignal.symbol === symbol && lastSignal.patterns && lastSignal.patterns.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none z-10">
          {lastSignal.patterns.map((p, i) => (
            <span key={i} className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-[9px] text-indigo-300 font-black rounded-lg uppercase tracking-widest backdrop-blur-md shadow-lg">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
