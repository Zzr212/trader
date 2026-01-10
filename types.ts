export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type ChartMode = 'CANDLES' | 'AREA' | 'LINE';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradePosition {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  amount: number;
  tp: number;
  sl: number;
  timestamp: number;
  pnl?: number;
}

export interface TradeRecord extends TradePosition {
  exitPrice: number;
  exitTime: number;
  status: 'WIN' | 'LOSS' | 'CLOSED';
}

export interface BotState {
  isActive: boolean;
  balance: number;
  openPositions: TradePosition[];
  history: TradeRecord[];
}

export interface AppSettings {
  apiKey: string;
  theme: 'dark' | 'light';
  chartMode: ChartMode;
  timeframe: Timeframe;
  useAiAssistant: boolean;
}

export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface TradeSignal {
  action: TradeAction;
  confidence: number;
  reasoning: string;
  entry: number;
  tp: number;
  sl: number;
  patterns?: string[];
  timestamp: number;
}