
import { Candle, TradeSignal, TradeAction, ChartLine } from "../types";
import { calculateRSI } from "./marketService";

const detectPatterns = (candles: Candle[]): { patterns: string[], lines: ChartLine[] } => {
  const lines: ChartLine[] = [];
  const patterns: string[] = [];
  const len = candles.length;
  if (len < 50) return { patterns, lines };

  // 1. Support & Resistance (Simple Pivot)
  const recentHighs = candles.slice(-30).map(c => c.high);
  const recentLows = candles.slice(-30).map(c => c.low);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  const current = candles[len - 1].close;

  lines.push({ price: resistance, title: 'RES', color: 'rgba(239, 68, 68, 0.5)', type: 'RESISTANCE' });
  lines.push({ price: support, title: 'SUP', color: 'rgba(16, 185, 129, 0.5)', type: 'SUPPORT' });

  // 2. Double Top / Bottom Detection (Simplified)
  // Check if we are near resistance and have rejected it twice recently
  if (current >= resistance * 0.995 && current <= resistance * 1.005) {
     patterns.push("Testing Resistance");
  } else if (current <= support * 1.005 && current >= support * 0.995) {
     patterns.push("Testing Support");
  }

  // 3. Breakout
  if (current > resistance) patterns.push("Bullish Breakout");
  if (current < support) patterns.push("Bearish Breakdown");

  return { patterns, lines };
};

export const analyzeMarketAlgo = (candles: Candle[], symbol: string): TradeSignal => {
  if (candles.length < 50) return { symbol, action: TradeAction.HOLD, confidence: 0, reasoning: "Loading...", entry: 0, tp: 0, sl: 0, timestamp: Date.now() };

  const current = candles[candles.length - 1];
  const rsi = calculateRSI(candles);
  const price = current.close;
  
  const { patterns, lines } = detectPatterns(candles);
  const resistance = lines.find(l => l.type === 'RESISTANCE')?.price || price * 1.05;
  const support = lines.find(l => l.type === 'SUPPORT')?.price || price * 0.95;

  // Strategy A: Oversold Bounce
  if (rsi < 30) {
    return {
      symbol,
      action: TradeAction.BUY,
      confidence: 82,
      reasoning: `RSI Oversold (${rsi.toFixed(0)}) + Support Proximity`,
      entry: price,
      tp: resistance,
      sl: support * 0.99, // Tight stop below support
      patterns: [...patterns, "RSI Oversold"],
      chartLines: lines,
      timestamp: Date.now()
    };
  }

  // Strategy B: Overbought Rejection
  if (rsi > 70) {
    return {
      symbol,
      action: TradeAction.SELL,
      confidence: 80,
      reasoning: `RSI Overbought (${rsi.toFixed(0)}) + Resistance Proximity`,
      entry: price,
      tp: support,
      sl: resistance * 1.01,
      patterns: [...patterns, "RSI Overbought"],
      chartLines: lines,
      timestamp: Date.now()
    };
  }

  // Strategy C: Trend Following (SMA Proxy)
  // Simple check: is price above open of 10 candles ago?
  const isTrendUp = price > candles[candles.length - 10].close;
  
  if (isTrendUp && rsi > 50 && rsi < 65) {
     // Weak Buy Signal
     return {
        symbol,
        action: TradeAction.BUY,
        confidence: 45, // Low confidence
        reasoning: "Momentum Up, Neutral RSI",
        entry: price,
        tp: price * 1.02,
        sl: price * 0.98,
        patterns: [...patterns, "Uptrend"],
        chartLines: lines,
        timestamp: Date.now()
     };
  }

  return {
    symbol,
    action: TradeAction.HOLD,
    confidence: 0,
    reasoning: `Consolidating (RSI: ${rsi.toFixed(0)})`,
    entry: 0, tp: 0, sl: 0,
    patterns: patterns,
    chartLines: lines,
    timestamp: Date.now()
  };
};
