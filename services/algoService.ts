import { Candle, TradeSignal, TradeAction } from "../types";
import { calculateRSI } from "./marketService";

export const analyzeMarketAlgo = (candles: Candle[]): TradeSignal => {
  if (candles.length < 50) return { action: TradeAction.HOLD, confidence: 0, reasoning: "Insuff. Data", entry: 0, tp: 0, sl: 0, timestamp: Date.now() };

  const current = candles[candles.length - 1];
  const rsi = calculateRSI(candles);
  const price = current.close;

  // Simple S/R detection
  const recentHighs = candles.slice(-30).map(c => c.high);
  const recentLows = candles.slice(-30).map(c => c.low);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  // Bullish: RSI < 35 (oversold) + touching support
  if (rsi < 35 && price <= support * 1.002) {
    return {
      action: TradeAction.BUY,
      confidence: 75,
      reasoning: "RSI Oversold + Support Bounce",
      entry: price,
      tp: price * 1.015,
      sl: price * 0.992,
      patterns: ["Double Bottom Attempt", "RSI Oversold"],
      timestamp: Date.now()
    };
  }

  // Bearish: RSI > 65 (overbought) + touching resistance
  if (rsi > 65 && price >= resistance * 0.998) {
    return {
      action: TradeAction.SELL,
      confidence: 75,
      reasoning: "RSI Overbought + Resistance Rejection",
      entry: price,
      tp: price * 0.985,
      sl: price * 1.008,
      patterns: ["Rejection at Resistance", "Bearish Momentum"],
      timestamp: Date.now()
    };
  }

  return {
    action: TradeAction.HOLD,
    confidence: 0,
    reasoning: `Wait... RSI: ${rsi.toFixed(1)}`,
    entry: 0, tp: 0, sl: 0,
    timestamp: Date.now()
  };
};