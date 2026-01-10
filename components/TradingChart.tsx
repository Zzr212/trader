import React, { useEffect, useRef } from 'react';
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
}

export const TradingChart: React.FC<TradingChartProps> = ({ data, mode, positions, lastSignal }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#94a3b8',
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
      height: 450,
    });

    chartRef.current = chart;

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

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Initialize series if it doesn't exist or if we are recreating it (though usually we just update data)
    // Note: To support mode switching properly without complex cleanup, we usually assume the chart is recreated or we remove series.
    // For this simple implementation, if mode changes, we might want to clear the series. 
    // However, the dependencies include `mode`. If series exists, we should probably remove it to switch types.
    
    if (seriesRef.current && seriesRef.current.seriesType() !== (mode === 'CANDLES' ? 'Candlestick' : mode === 'AREA' ? 'Area' : 'Line')) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
      lastTimeRef.current = 0;
    }

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

    if (data.length > 0) {
      const lastCandle = data[data.length - 1];
      
      // If data was cleared externally or it's a fresh load
      if (lastTimeRef.current === 0 || data.length < 5) {
        seriesRef.current.setData(data as any);
        lastTimeRef.current = lastCandle.time;
      } else {
        // Only update if time is new
        if (lastCandle.time >= lastTimeRef.current) {
          seriesRef.current.update(lastCandle as any);
          lastTimeRef.current = lastCandle.time;
        } else {
          // If historical data is re-fetched/changed completely
          seriesRef.current.setData(data as any);
          lastTimeRef.current = lastCandle.time;
        }
      }
    } else {
      // Data cleared
      seriesRef.current.setData([]);
      lastTimeRef.current = 0;
    }
  }, [data, mode]);

  useEffect(() => {
    if (!seriesRef.current) return;

    linesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
    linesRef.current = [];

    const activePos = positions[0];
    const signal = lastSignal && lastSignal.action !== TradeAction.HOLD ? lastSignal : null;
    const target = activePos || signal;

    if (target) {
      const isSignal = !activePos;
      const opacity = isSignal ? 0.4 : 0.8;
      const lineStyle = isSignal ? 2 : 0; // 2 = Dashed, 0 = Solid

      const entryPrice = activePos ? activePos.entryPrice : signal?.entry;
      if (entryPrice) {
        const entryLine = seriesRef.current.createPriceLine({
          price: entryPrice,
          color: `rgba(255, 255, 255, ${opacity})`,
          lineWidth: 2,
          lineStyle: lineStyle,
          axisLabelVisible: true,
          title: activePos ? `${activePos.type} ENTRY` : `SIGNAL ENTRY`,
        });
        linesRef.current.push(entryLine);
      }

      if (target.tp) {
        const tpLine = seriesRef.current.createPriceLine({
          price: target.tp,
          color: `rgba(16, 185, 129, ${opacity})`,
          lineWidth: 2,
          lineStyle: lineStyle,
          axisLabelVisible: true,
          title: 'TARGET TP',
        });
        linesRef.current.push(tpLine);
      }

      if (target.sl) {
        const slLine = seriesRef.current.createPriceLine({
          price: target.sl,
          color: `rgba(239, 68, 68, ${opacity})`,
          lineWidth: 2,
          lineStyle: lineStyle,
          axisLabelVisible: true,
          title: 'SAFETY SL',
        });
        linesRef.current.push(slLine);
      }
    }
  }, [positions, lastSignal]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full border-y border-white/5" />
      {lastSignal && lastSignal.patterns && lastSignal.patterns.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none">
          {lastSignal.patterns.map((p, i) => (
            <span key={i} className="px-3 py-1 bg-black/60 border border-white/10 text-[9px] text-indigo-400 font-black rounded-lg uppercase tracking-widest backdrop-blur-md">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};