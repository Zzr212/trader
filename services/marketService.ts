
import { Candle, Timeframe } from '../types';

const BINANCE_REST = 'https://api.binance.com/api/v3/klines';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

export const WATCHLIST = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 
  'DOTUSDT', 'MATICUSDT'
];

export const fetchHistoricalData = async (symbol: string = 'BTCUSDT', interval: Timeframe = '1m', limit: number = 300, endTime?: number): Promise<Candle[]> => {
  try {
    let url = `${BINANCE_REST}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    if (endTime) {
      url += `&endTime=${endTime * 1000}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    
    if (!Array.isArray(data)) return [];

    return data.map((d: any) => ({
      time: Math.floor(d[0] / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.error(`Market fetch error [${symbol}]:`, error);
    return [];
  }
};

export const subscribeToTicker = (symbol: string, interval: Timeframe, onUpdate: (candle: Candle) => void) => {
  const ws = new WebSocket(`${BINANCE_WS}/${symbol.toLowerCase()}@kline_${interval}`);
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const k = msg.k;
      onUpdate({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      });
    } catch (e) {
      // Ignore parse errors on socket
    }
  };

  return () => ws.close();
};

export const calculateRSI = (candles: Candle[], period: number = 14): number => {
  if (candles.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
};
