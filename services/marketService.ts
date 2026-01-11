
import { Candle, Timeframe } from '../types';
import { apiService } from './apiService';

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

export const WATCHLIST = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 
  'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 
  'DOTUSDT', 'MATICUSDT', 'NEARUSDT', 'LINKUSDT'
];

export const fetchHistoricalData = async (symbol: string = 'BTCUSDT', interval: Timeframe = '1m', limit: number = 300, endTime?: number): Promise<Candle[]> => {
  // Use our server proxy to avoid CORS
  return await apiService.fetchCandlesProxy(symbol, interval, limit);
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
      // Ignore
    }
  };

  return () => ws.close();
};
