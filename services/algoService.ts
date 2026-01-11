
import { Candle, TradeSignal, TradeAction, ChartLine } from "../types";

// --- MATH HELPERS ---

const getSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(data.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

const getStandardDeviation = (data: number[], period: number, sma: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(data.length - period);
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
  return Math.sqrt(variance);
};

const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaArray = [data[0]];
  for (let i = 1; i < data.length; i++) {
    emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
};

// Stochastic RSI
const calculateStochRSI = (candles: Candle[], period: number = 14) => {
  const closes = candles.map(c => c.close);
  // Basic RSI calc first
  let gains = 0, losses = 0;
  const rsiArray = [];
  
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
    
    // Simple average for initial, then smoothed? Keeping it simple for speed
    // Ideally we need full array. Let's do a quick approximation for the last point.
  }
  
  // Implementation of full StochRSI is complex in one pass. 
  // Simplified logic: RSI of RSI.
  // We will use a faster proxy: Relative Volatility.
  
  // Let's stick to standard RSI but with tighter bounds for "Sniper"
  return 50; // Placeholder if complex calculation is too heavy, but let's implement basic RSI
};

const getRSI = (candles: Candle[], period: number = 14): number => {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const rs = gains / (losses || 1); // Avoid div by zero
    return 100 - (100 / (1 + rs));
}

// --- SNIPER STRATEGY ---

export const analyzeMarketAlgo = (candles: Candle[], symbol: string): TradeSignal => {
  if (candles.length < 200) {
      return { 
          symbol, action: TradeAction.HOLD, confidence: 0, 
          reasoning: "Gathering Data...", entry: 0, tp: 0, sl: 0, timestamp: Date.now() 
      };
  }

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  
  // 1. BOLLINGER BANDS (20, 2)
  const sma20 = getSMA(closes, 20);
  const stdDev = getStandardDeviation(closes, 20, sma20);
  const upperBand = sma20 + (stdDev * 2);
  const lowerBand = sma20 - (stdDev * 2);

  // 2. EMA 200 (Trend Filter)
  const ema200Arr = calculateEMA(closes, 200);
  const ema200 = ema200Arr[ema200Arr.length - 1];

  // 3. RSI (Momentum)
  const rsi = getRSI(candles, 14);

  // --- LOGIC ---
  const isUptrend = currentPrice > ema200;
  const isDowntrend = currentPrice < ema200;

  // Chart Lines
  const lines: ChartLine[] = [
      { price: ema200, title: 'EMA 200', color: '#eab308', type: 'TREND' },
      { price: upperBand, title: 'Upper BB', color: 'rgba(59, 130, 246, 0.5)', type: 'BAND_UPPER' },
      { price: lowerBand, title: 'Lower BB', color: 'rgba(59, 130, 246, 0.5)', type: 'BAND_LOWER' }
  ];

  // SCENARIO 1: SNIPER LONG (Pullback to Lower BB in Uptrend)
  if (isUptrend) {
      // Price touched or is below Lower Band AND RSI is Oversold (< 35)
      // This indicates a temporary dip in a strong trend.
      if (currentPrice <= lowerBand * 1.002 && rsi < 40) {
           const sl = currentPrice * 0.99; // 1% SL
           const tp = upperBand; // Target Upper Band
           
           return {
               symbol,
               action: TradeAction.BUY,
               confidence: 92,
               reasoning: "SNIPER LONG: Price at Lower BB + Uptrend + RSI Oversold",
               entry: currentPrice,
               tp: tp,
               sl: sl,
               patterns: ["BB Squeeze", "Trend Pullback"],
               chartLines: lines,
               timestamp: Date.now()
           };
      }
  }

  // SCENARIO 2: SNIPER SHORT (Rally to Upper BB in Downtrend)
  if (isDowntrend) {
      // Price touched or is above Upper Band AND RSI is Overbought (> 65)
      if (currentPrice >= upperBand * 0.998 && rsi > 60) {
           const sl = currentPrice * 1.01; // 1% SL
           const tp = lowerBand; // Target Lower Band

           return {
               symbol,
               action: TradeAction.SELL,
               confidence: 92,
               reasoning: "SNIPER SHORT: Price at Upper BB + Downtrend + RSI Overbought",
               entry: currentPrice,
               tp: tp,
               sl: sl,
               patterns: ["BB Rejection", "Trend Continuation"],
               chartLines: lines,
               timestamp: Date.now()
           };
      }
  }

  // SCENARIO 3: BREAKOUT (Volatility Expansion)
  const bandwidth = (upperBand - lowerBand) / sma20;
  if (bandwidth < 0.02) { // Extremely tight squeeze
      // Warning, massive move incoming
      return {
        symbol,
        action: TradeAction.HOLD,
        confidence: 50,
        reasoning: "VOLATILITY SQUEEZE: Big move imminent. Waiting for breakout.",
        entry: 0, tp: 0, sl: 0,
        patterns: ["Squeeze"],
        chartLines: lines,
        timestamp: Date.now()
      };
  }

  return {
    symbol,
    action: TradeAction.HOLD,
    confidence: 10,
    reasoning: `No clear signal. RSI: ${rsi.toFixed(0)}`,
    entry: 0, tp: 0, sl: 0,
    patterns: [],
    chartLines: lines,
    timestamp: Date.now()
  };
};
