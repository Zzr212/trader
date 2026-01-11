
// SERVER SIDE ALGO - Pure JS
// This runs inside Node.js on the server

const getSMA = (data, period) => {
  if (data.length < period) return 0;
  const slice = data.slice(data.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

const getStandardDeviation = (data, period, sma) => {
  if (data.length < period) return 0;
  const slice = data.slice(data.length - period);
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
  return Math.sqrt(variance);
};

const calculateEMA = (data, period) => {
  const k = 2 / (period + 1);
  const emaArray = [data[0]];
  for (let i = 1; i < data.length; i++) {
    emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
};

const getRSI = (candles, period = 14) => {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
}

export const analyzeMarket = (candles, symbol) => {
  // Need decent history
  if (!candles || candles.length < 50) {
      return { action: 'HOLD', reasoning: "Insufficient Data", tp: 0, sl: 0 };
  }

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  
  // 1. BOLLINGER BANDS (20, 2)
  const sma20 = getSMA(closes, 20);
  const stdDev = getStandardDeviation(closes, 20, sma20);
  const upperBand = sma20 + (stdDev * 2);
  const lowerBand = sma20 - (stdDev * 2);

  // 2. EMA 200 (Trend Filter) - using shorter if not enough data
  const emaPeriod = closes.length > 200 ? 200 : 50;
  const emaArr = calculateEMA(closes, emaPeriod);
  const trendLine = emaArr[emaArr.length - 1];

  // 3. RSI
  const rsi = getRSI(candles, 14);

  const isUptrend = currentPrice > trendLine;
  const isDowntrend = currentPrice < trendLine;

  // LOGIC: SNIPER LONG
  if (isUptrend) {
      // Lower Band touch + Oversold
      if (currentPrice <= lowerBand * 1.002 && rsi < 45) {
           return {
               action: 'BUY',
               confidence: 90,
               reasoning: `Sniper Buy: Price at Lower BB (${lowerBand.toFixed(2)}) + RSI ${rsi.toFixed(0)}`,
               entry: currentPrice,
               tp: upperBand,
               sl: currentPrice * 0.99 // 1% SL
           };
      }
  }

  // LOGIC: SNIPER SHORT
  if (isDowntrend) {
      // Upper Band touch + Overbought
      if (currentPrice >= upperBand * 0.998 && rsi > 55) {
           return {
               action: 'SELL',
               confidence: 90,
               reasoning: `Sniper Sell: Price at Upper BB (${upperBand.toFixed(2)}) + RSI ${rsi.toFixed(0)}`,
               entry: currentPrice,
               tp: lowerBand,
               sl: currentPrice * 1.01 // 1% SL
           };
      }
  }

  return {
    action: 'HOLD',
    confidence: 0,
    reasoning: `Consolidating. RSI: ${rsi.toFixed(0)}`,
    entry: 0, tp: 0, sl: 0
  };
};
