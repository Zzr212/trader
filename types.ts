
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
  leverage: number;
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
  startTime?: number; // Added for uptime tracking
  balance: number;
  openPositions: TradePosition[];
  history: TradeRecord[];
  totalProfit: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  chartMode: ChartMode;
  timeframe: Timeframe;
  riskPerTrade: number; // Percentage
}

export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface ChartLine {
  price: number;
  title: string;
  color: string;
  type: 'RESISTANCE' | 'SUPPORT' | 'TREND' | 'BAND_UPPER' | 'BAND_LOWER';
}

export interface TradeSignal {
  symbol: string;
  action: TradeAction;
  confidence: number;
  reasoning: string;
  entry: number;
  tp: number;
  sl: number;
  patterns?: string[];
  chartLines?: ChartLine[]; 
  timestamp: number;
}
