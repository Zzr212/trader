
import React, { useState, useEffect } from 'react';
import { 
  Menu, X, Wallet, RefreshCw, Activity, 
  TrendingUp, TrendingDown, Cpu, 
  History, Copy, Check, Play, Square, Zap, ArrowUpRight, ArrowDownRight, Server, Globe
} from 'lucide-react';
import { TradingChart } from './components/TradingChart';
import { fetchHistoricalData, subscribeToTicker } from './services/marketService';
import { analyzeMarketAlgo } from './services/algoService';
import { analyzeWithAi } from './services/geminiService';
import { BotState, AppSettings, Candle, TradeSignal, TradeAction, TradePosition } from './types';

export default function App() {
  const [botState, setBotState] = useState<BotState>(() => {
    const saved = localStorage.getItem('botState');
    return saved ? JSON.parse(saved) : { isActive: false, balance: 1000, openPositions: [], history: [] };
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const { apiKey, ...clean } = parsed;
      return clean;
    }
    return { theme: 'dark', chartMode: 'CANDLES', timeframe: '1m', useAiAssistant: false };
  });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastSignal, setLastSignal] = useState<TradeSignal | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('botState', JSON.stringify(botState));
  }, [botState]);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setCandles([]); 
    const init = async () => {
      const hist = await fetchHistoricalData('BTCUSDT', settings.timeframe);
      setCandles(hist);
    };
    init();

    const cleanup = subscribeToTicker('BTCUSDT', settings.timeframe, (newCandle) => {
      setCandles(prev => {
        if (prev.length === 0) return [newCandle];
        const last = prev[prev.length - 1];
        if (newCandle.time < last.time) return prev;
        if (last.time === newCandle.time) {
          const updated = [...prev];
          updated[updated.length - 1] = newCandle;
          return updated;
        }
        return [...prev, newCandle].slice(-1000);
      });
    });
    return () => cleanup();
  }, [settings.timeframe]);

  useEffect(() => {
    if (!botState.isActive || candles.length < 50) return;
    const runEngine = async () => {
      let signal = analyzeMarketAlgo(candles);
      if (signal.action !== TradeAction.HOLD && settings.useAiAssistant) {
        signal = await analyzeWithAi(process.env.API_KEY || '', candles, signal);
      }
      setLastSignal(signal);
      if (signal.action !== TradeAction.HOLD && botState.openPositions.length === 0) {
        const currentPrice = candles[candles.length - 1].close;
        const newPos: TradePosition = {
          id: Math.random().toString(36).substr(2, 9),
          symbol: 'BTCUSDT',
          type: signal.action === TradeAction.BUY ? 'BUY' : 'SELL',
          entryPrice: currentPrice,
          amount: 0.1,
          tp: signal.tp,
          sl: signal.sl,
          timestamp: Date.now()
        };
        setBotState(prev => ({ ...prev, openPositions: [...prev.openPositions, newPos] }));
      }
    };
    const timer = setTimeout(runEngine, 2000);
    return () => clearTimeout(timer);
  }, [candles[candles.length - 1]?.close, botState.isActive, settings.useAiAssistant]);

  useEffect(() => {
    if (botState.openPositions.length === 0) return;
    const currentPrice = candles[candles.length - 1]?.close;
    if (!currentPrice) return;

    const updatedPositions = botState.openPositions.filter(pos => {
      const isBuy = pos.type === 'BUY';
      const hitTp = isBuy ? currentPrice >= pos.tp : currentPrice <= pos.tp;
      const hitSl = isBuy ? currentPrice <= pos.sl : currentPrice >= pos.sl;

      if (hitTp || hitSl) {
        const pnl = isBuy ? (currentPrice - pos.entryPrice) * pos.amount : (pos.entryPrice - currentPrice) * pos.amount;
        const record = { ...pos, exitPrice: currentPrice, exitTime: Date.now(), status: pnl > 0 ? 'WIN' : 'LOSS', pnl } as any;
        setBotState(prev => ({ 
          ...prev, 
          balance: prev.balance + pnl,
          history: [record, ...prev.history].slice(0, 50)
        }));
        return false;
      }
      return true;
    });

    if (updatedPositions.length !== botState.openPositions.length) {
      setBotState(prev => ({ ...prev, openPositions: updatedPositions }));
    }
  }, [candles[candles.length - 1]?.close]);

  const copyToClipboard = (val: number | string) => {
    const str = val.toString();
    navigator.clipboard.writeText(str);
    setCopied(str);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentPrice = candles[candles.length - 1]?.close || 0;
  const isUp = candles.length > 1 && currentPrice >= candles[candles.length - 2].close;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${settings.theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* NOTIFICATION */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${copied ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-12 opacity-0 scale-95 pointer-events-none'}`}>
        <div className="bg-slate-900/95 border border-white/10 backdrop-blur-2xl px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3">
          <div className="bg-emerald-500 rounded-full p-1"><Check className="w-3 h-3 text-black" /></div>
          <span className="text-[11px] font-black uppercase tracking-widest text-white">Copied: {copied}</span>
        </div>
      </div>

      <header className="h-20 px-6 border-b border-white/5 glass fixed top-0 w-full z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-500/20">
            <Cpu className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-0.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${botState.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              PROD ENGINE | {settings.timeframe}
            </div>
            <div className={`text-2xl font-mono font-black tracking-tighter ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <Globe className="w-3 h-3 text-emerald-500" />
           <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Render Deployment Active</span>
        </div>
        <button onClick={() => setIsMenuOpen(true)} className="bg-slate-900/50 hover:bg-slate-800 p-3 rounded-2xl border border-white/5 transition-all shadow-lg">
          <Menu className="w-6 h-6 text-indigo-400" />
        </button>
      </header>

      <main className="pt-20 pb-10 max-w-7xl mx-auto">
        <section className="bg-slate-950 overflow-hidden relative border-b border-white/5 shadow-2xl">
          <div className="flex p-3 gap-2 overflow-x-auto no-scrollbar bg-slate-900/20">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <button 
                key={tf}
                onClick={() => setSettings(s => ({ ...s, timeframe: tf as any }))}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${settings.timeframe === tf ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-950/50 text-slate-600 hover:text-slate-300'}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <TradingChart data={candles} mode={settings.chartMode} positions={botState.openPositions} lastSignal={lastSignal} />
        </section>

        <section className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {botState.openPositions.length > 0 ? (
              <div className="bg-gradient-to-br from-slate-900 to-black rounded-[32px] p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Activity className="w-32 h-32 text-indigo-500" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${botState.openPositions[0].type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} border border-white/5`}>
                        Active {botState.openPositions[0].type} Trade
                      </span>
                      <h2 className="text-4xl font-black text-white mt-4 flex items-center gap-3">
                        BTC / USDT 
                        {botState.openPositions[0].type === 'BUY' ? <ArrowUpRight className="text-emerald-400" /> : <ArrowDownRight className="text-rose-400" />}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Profit/Loss (USD)</div>
                      <div className={`text-4xl font-mono font-black ${((currentPrice - botState.openPositions[0].entryPrice) * (botState.openPositions[0].type === 'BUY' ? 1 : -1)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${((currentPrice - botState.openPositions[0].entryPrice) * (botState.openPositions[0].type === 'BUY' ? 1 : -1) * botState.openPositions[0].amount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Entry', val: botState.openPositions[0].entryPrice, color: 'text-white' },
                      { label: 'Take Profit', val: botState.openPositions[0].tp, color: 'text-emerald-400' },
                      { label: 'Stop Loss', val: botState.openPositions[0].sl, color: 'text-rose-400' }
                    ].map(item => (
                      <div key={item.label} className="bg-slate-950/50 p-5 rounded-2xl border border-white/5">
                        <div className="text-[9px] uppercase font-black text-slate-500 mb-1">{item.label}</div>
                        <div className={`text-lg font-mono font-black ${item.color}`}>${item.val.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : lastSignal && lastSignal.action !== TradeAction.HOLD ? (
              <div className="bg-slate-900/40 border border-white/10 rounded-[32px] p-8 group overflow-hidden relative">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${lastSignal.action === TradeAction.BUY ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {lastSignal.action === TradeAction.BUY ? <TrendingUp /> : <TrendingDown />}
                    </div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${lastSignal.action === TradeAction.BUY ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {lastSignal.action} DETECTED
                    </h3>
                  </div>
                  <div className="px-4 py-2 bg-indigo-600/10 text-indigo-400 rounded-full text-[10px] font-black">{lastSignal.confidence}% CONFIDENCE</div>
                </div>
                <p className="text-slate-400 italic mb-10 text-sm leading-relaxed">"{lastSignal.reasoning}"</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Target Entry', val: lastSignal.entry, color: 'text-white' },
                    { label: 'TP Target', val: lastSignal.tp, color: 'text-emerald-400' },
                    { label: 'SL Safety', val: lastSignal.sl, color: 'text-rose-400' }
                  ].map(item => (
                    <button key={item.label} onClick={() => copyToClipboard(item.val)} className="bg-slate-950 p-5 rounded-2xl border border-white/5 text-left hover:border-indigo-500/50 transition-all group/btn">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-[9px] uppercase font-black text-slate-500">{item.label}</div>
                        <Copy className="w-3 h-3 text-slate-800 group-hover/btn:text-indigo-400" />
                      </div>
                      <div className={`text-lg font-mono font-black ${item.color}`}>${item.val.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/10 border-2 border-dashed border-white/5 rounded-[32px] p-24 text-center grayscale opacity-40">
                <Activity className="w-16 h-16 text-slate-600 mx-auto mb-6 animate-pulse" />
                <h3 className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Neural Market Analysis in Progress...</h3>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" /> Recent History
            </h3>
            <div className="space-y-3">
              {botState.history.length === 0 ? (
                <div className="py-20 text-center text-slate-700 font-black uppercase text-[10px] border border-white/5 rounded-[32px]">No Data</div>
              ) : (
                botState.history.map(record => (
                  <div key={record.id} className="bg-slate-900/30 p-5 rounded-3xl border border-white/5 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${record.status === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {record.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-300 uppercase">{record.type} @ ${record.entryPrice.toLocaleString()}</div>
                        <div className="text-[9px] text-slate-600 font-bold uppercase">{new Date(record.exitTime).toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-mono font-black ${record.pnl && record.pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {record.pnl && record.pnl > 0 ? '+' : ''}${record.pnl?.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* SIDE MENU */}
      <div className={`fixed inset-0 z-50 transition-transform duration-500 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMenuOpen(false)} />
        <div className="absolute right-0 top-0 bottom-0 w-[400px] max-w-full bg-[#050814] border-l border-white/10 p-10 flex flex-col shadow-2xl">
          <div className="flex justify-between items-center mb-16">
            <h2 className="text-3xl font-black italic tracking-tighter text-white">SYSTEM <span className="text-indigo-500">PROD</span></h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>

          <div className="space-y-12 flex-1 overflow-y-auto no-scrollbar pb-24">
            <button 
              onClick={() => setBotState(p => ({ ...p, isActive: !p.isActive }))}
              className={`w-full py-6 rounded-[28px] font-black text-sm tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
                botState.isActive ? 'bg-rose-600 text-white shadow-rose-900/40 border border-white/10' : 'bg-indigo-600 text-white shadow-indigo-900/40 border border-indigo-400/50'
              }`}
            >
              {botState.isActive ? <><Square className="w-5 h-5 fill-current" /> STOP ENGINE</> : <><Play className="w-5 h-5 fill-current" /> START ENGINE</>}
            </button>

            <div className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-5 h-5 text-indigo-400" />
                <span className="text-[11px] text-slate-500 font-black uppercase tracking-[0.2em]">Live Balance (Virtual)</span>
              </div>
              <div className="text-5xl font-mono font-black text-white tracking-tighter mb-8">${botState.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <button onClick={() => setBotState(p => ({...p, balance: 1000, history: [], openPositions: []}))} className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                <RefreshCw className="w-4 h-4 mx-auto" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">AI Neural Intelligence</label>
              </div>
              <div className="flex items-center justify-between bg-black/40 p-6 rounded-2xl border border-white/5">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Enable AI Validator</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.useAiAssistant} onChange={e => setSettings(s => ({ ...s, useAiAssistant: e.target.checked }))} />
                  <div className="w-14 h-8 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <p className="text-[9px] text-slate-600 leading-relaxed italic">AI uses the environment's configured API key for advanced market sentiment analysis.</p>
            </div>

            <div className="pt-10 border-t border-white/5 flex items-center justify-between text-slate-600">
               <span className="text-[10px] font-black tracking-widest uppercase flex items-center gap-2"><Server className="w-4 h-4" /> NODE_ENV: PRODUCTION</span>
               <div className="flex items-center gap-2">
                <span className="text-[10px] font-black">STABLE SYNC</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
