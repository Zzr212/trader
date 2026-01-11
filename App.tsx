
import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Wallet, RefreshCw, Activity, 
  TrendingUp, TrendingDown, Cpu, 
  History, Copy, Check, Power, Zap, ArrowUpRight, ArrowDownRight, Server, Globe,
  AlertTriangle, Trash2, Key
} from 'lucide-react';
import { TradingChart } from './components/TradingChart';
import { fetchHistoricalData, subscribeToTicker } from './services/marketService';
import { analyzeMarketAlgo } from './services/algoService';
import { analyzeWithAi } from './services/geminiService';
import { apiService } from './services/apiService';
import { BotState, AppSettings, Candle, TradeSignal, TradeAction, TradePosition } from './types';

// --- DYNAMIC ISLAND COMPONENT ---
const DynamicIsland = ({ error, message }: { error: string | null, message: string | null }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error || message) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, message]);

  return (
    <div className={`fixed top-2 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-spring ${visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-20 scale-90 opacity-0'}`}>
      <div className={`flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl backdrop-blur-2xl border border-white/10 ${error ? 'bg-rose-950/90' : 'bg-slate-900/90'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${error ? 'bg-rose-500' : 'bg-indigo-500'}`}>
          {error ? <AlertTriangle className="w-4 h-4 text-white" /> : <Activity className="w-4 h-4 text-white" />}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{error ? 'System Error' : 'System Notice'}</span>
          <span className="text-xs font-bold text-white whitespace-nowrap">{error || message}</span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [botState, setBotState] = useState<BotState>({ isActive: false, balance: 1000, openPositions: [], history: [] });
  const [history, setHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? JSON.parse(saved) : { theme: 'dark', chartMode: 'CANDLES', timeframe: '1m', useAiAssistant: false };
  });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastSignal, setLastSignal] = useState<TradeSignal | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
  // New States
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);

  // --- INITIALIZATION & SERVER SYNC ---
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      try {
        const serverState = await apiService.getState();
        const serverHistory = await apiService.getHistory();
        const keyStatus = await apiService.checkKeyStatus();
        
        if (mounted) {
          setBotState(serverState);
          setHistory(serverHistory);
          setHasApiKey(keyStatus);
        }
      } catch (e) {
        // Suppress repetitive sync errors in UI, log to console
        console.warn("Sync failed:", e);
      }
    };
    sync();
    const interval = setInterval(sync, 5000); 
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  // --- ENGINE UPTIME ---
  useEffect(() => {
    if (botState.isActive) {
      const t = setInterval(() => setUptime(p => p + 1), 1000);
      return () => clearInterval(t);
    } else {
      setUptime(0);
    }
  }, [botState.isActive]);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // --- DATA FETCHING ---
  const loadData = async (endTime?: number) => {
    const newData = await fetchHistoricalData('BTCUSDT', settings.timeframe, 300, endTime);
    return newData;
  };

  useEffect(() => {
    setCandles([]); 
    loadData().then(setCandles);

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
        return [...prev, newCandle];
      });
    });
    return () => cleanup();
  }, [settings.timeframe]);

  const handleLoadMore = async () => {
    if (candles.length === 0) return;
    const oldestTime = candles[0].time;
    const olderCandles = await loadData(oldestTime);
    if (olderCandles.length > 0) {
      const uniqueOlder = olderCandles.filter(c => c.time < oldestTime);
      setCandles(prev => [...uniqueOlder, ...prev]);
    }
  };

  // --- TRADING ENGINE LOGIC ---
  useEffect(() => {
    if (!botState.isActive || candles.length < 50) return;

    const runEngine = async () => {
      try {
        let signal = analyzeMarketAlgo(candles);
        
        if (signal.action !== TradeAction.HOLD && settings.useAiAssistant) {
          if (!hasApiKey) {
            setErrorMsg("AI Enabled but no Key found on server!");
            return;
          }
          const aiSignal = await analyzeWithAi(candles, signal);
          
          if (aiSignal.action !== signal.action) {
            setInfoMsg(`AI Rejected: ${aiSignal.reasoning}`);
            signal = { ...signal, action: TradeAction.HOLD };
          } else {
            signal = aiSignal;
          }
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
          
          const newState = { ...botState, openPositions: [newPos] };
          await apiService.saveState(newState);
          setBotState(newState);
          setInfoMsg(`${newPos.type} Opened @ ${newPos.entryPrice}`);
        }
      } catch (err) {
        setErrorMsg("Engine Failure: " + (err as Error).message);
      }
    };

    const timer = setTimeout(runEngine, 2000); 
    return () => clearTimeout(timer);
  }, [candles.length, botState.isActive]); 

  // --- POSITION MANAGEMENT & STOP LOGIC ---
  const toggleEngine = async () => {
    const newActive = !botState.isActive;
    let newState = { ...botState, isActive: newActive };
    
    if (!newActive && botState.openPositions.length > 0) {
      const pos = botState.openPositions[0];
      const currentPrice = candles[candles.length - 1]?.close || pos.entryPrice;
      const pnl = pos.type === 'BUY' ? (currentPrice - pos.entryPrice) * pos.amount : (pos.entryPrice - currentPrice) * pos.amount;
      
      const record = { ...pos, exitPrice: currentPrice, exitTime: Date.now(), status: 'CLOSED', pnl } as any;
      await apiService.addToHistory(record);
      
      newState.openPositions = [];
      newState.balance += pnl;
      setInfoMsg("Engine Stopped. Position Closed.");
    }

    await apiService.saveState(newState);
    setBotState(newState);
  };

  // Monitor Active Position
  useEffect(() => {
    if (botState.openPositions.length === 0) return;
    const currentPrice = candles[candles.length - 1]?.close;
    if (!currentPrice) return;

    const pos = botState.openPositions[0];
    const isBuy = pos.type === 'BUY';
    const hitTp = isBuy ? currentPrice >= pos.tp : currentPrice <= pos.tp;
    const hitSl = isBuy ? currentPrice <= pos.sl : currentPrice >= pos.sl;

    if (hitTp || hitSl) {
      const pnl = isBuy ? (currentPrice - pos.entryPrice) * pos.amount : (pos.entryPrice - currentPrice) * pos.amount;
      const record = { ...pos, exitPrice: currentPrice, exitTime: Date.now(), status: pnl > 0 ? 'WIN' : 'LOSS', pnl } as any;
      
      const processClose = async () => {
        await apiService.addToHistory(record);
        const newState = { 
          ...botState, 
          balance: botState.balance + pnl,
          openPositions: []
        };
        await apiService.saveState(newState);
        setBotState(newState);
        // Refresh history
        setHistory(await apiService.getHistory());
      };
      processClose();
    }
  }, [candles, botState.openPositions]);


  // --- API KEY HELPERS ---
  const saveKey = async () => {
    if (!apiKeyInput) return;
    try {
      await apiService.saveKey(apiKeyInput);
      setHasApiKey(true);
      setApiKeyInput('');
      setInfoMsg("API Key Saved Securely");
    } catch (e) { setErrorMsg("Failed to save key"); }
  };

  const deleteKey = async () => {
    await apiService.deleteKey();
    setHasApiKey(false);
    setInfoMsg("API Key Deleted");
  };

  const copyToClipboard = (val: number | string) => {
    navigator.clipboard.writeText(val.toString());
    setCopied(val.toString());
    setTimeout(() => setCopied(null), 2000);
  };

  const currentPrice = candles[candles.length - 1]?.close || 0;
  const isUp = candles.length > 1 && currentPrice >= candles[candles.length - 2].close;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${settings.theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      <DynamicIsland error={errorMsg} message={infoMsg} />

      {/* HEADER */}
      <header className="h-16 px-4 md:px-6 border-b border-white/5 glass fixed top-0 w-full z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Cpu className="text-white w-4 h-4" />
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${botState.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              NEURO | {settings.timeframe}
            </div>
            <div className={`text-lg font-mono font-black tracking-tighter ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
                <button 
                onClick={toggleEngine}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 border ${
                    botState.isActive ? 'bg-rose-500 border-rose-400 shadow-rose-500/30' : 'bg-slate-800 border-white/10'
                }`}
                >
                <Power className={`w-5 h-5 ${botState.isActive ? 'text-white' : 'text-slate-500'}`} />
                </button>
                {botState.isActive && (
                    <span className="text-[9px] font-mono font-black text-emerald-500 mt-1">{formatUptime(uptime)}</span>
                )}
            </div>

            <button onClick={() => setIsMenuOpen(true)} className="bg-slate-900/50 hover:bg-slate-800 p-2.5 rounded-xl border border-white/5 transition-all">
            <Menu className="w-5 h-5 text-indigo-400" />
            </button>
        </div>
      </header>

      <main className="pt-20 pb-20 max-w-7xl mx-auto space-y-4">
        {/* CHART SECTION */}
        <section className="bg-slate-950 overflow-hidden relative border-y md:border md:rounded-3xl border-white/5 shadow-2xl">
          <div className="flex p-2 gap-2 overflow-x-auto no-scrollbar bg-slate-900/20 border-b border-white/5">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <button 
                key={tf}
                onClick={() => setSettings(s => ({ ...s, timeframe: tf as any }))}
                className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest transition-all ${settings.timeframe === tf ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-950/50 text-slate-600 hover:text-slate-300'}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="h-[400px] md:h-[500px]">
            <TradingChart 
                data={candles} 
                mode={settings.chartMode} 
                positions={botState.openPositions} 
                lastSignal={lastSignal} 
                onLoadMore={handleLoadMore}
            />
          </div>
        </section>

        <section className="px-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* MAIN STATUS PANEL */}
          <div className="lg:col-span-8 space-y-4">
            {botState.openPositions.length > 0 ? (
              <div className="bg-gradient-to-br from-slate-900 to-black rounded-3xl p-6 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${botState.openPositions[0].type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} border border-white/5`}>
                      {botState.openPositions[0].type} OPEN
                    </span>
                    <h2 className="text-3xl font-black text-white mt-2 flex items-center gap-2">
                      BTCUSDT 
                      {botState.openPositions[0].type === 'BUY' ? <ArrowUpRight className="text-emerald-400 w-6 h-6" /> : <ArrowDownRight className="text-rose-400 w-6 h-6" />}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">PNL (USD)</div>
                    <div className={`text-3xl font-mono font-black ${((currentPrice - botState.openPositions[0].entryPrice) * (botState.openPositions[0].type === 'BUY' ? 1 : -1)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${((currentPrice - botState.openPositions[0].entryPrice) * (botState.openPositions[0].type === 'BUY' ? 1 : -1) * botState.openPositions[0].amount).toFixed(2)}
                    </div>
                  </div>
                </div>
                {/* AI VALIDATOR COMMENT */}
                {settings.useAiAssistant && (
                    <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3 h-3 text-indigo-400" />
                            <span className="text-[9px] font-black uppercase text-indigo-400">AI Logic</span>
                        </div>
                        <p className="text-xs text-indigo-200/80 italic line-clamp-2">
                            {lastSignal?.reasoning.replace("AI: ", "")}
                        </p>
                    </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Entry', val: botState.openPositions[0].entryPrice, color: 'text-white' },
                    { label: 'TP', val: botState.openPositions[0].tp, color: 'text-emerald-400' },
                    { label: 'SL', val: botState.openPositions[0].sl, color: 'text-rose-400' }
                  ].map(item => (
                    <div key={item.label} className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
                      <div className="text-[8px] uppercase font-black text-slate-500">{item.label}</div>
                      <div className={`text-sm font-mono font-black ${item.color}`}>${item.val.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : lastSignal && lastSignal.action !== TradeAction.HOLD ? (
              <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 relative">
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${lastSignal.action === TradeAction.BUY ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {lastSignal.action === TradeAction.BUY ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-500 uppercase">SIGNAL</div>
                            <h3 className={`text-lg font-black uppercase tracking-tight ${lastSignal.action === TradeAction.BUY ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {lastSignal.action}
                            </h3>
                        </div>
                    </div>
                    <div className="px-3 py-1 bg-indigo-600/10 text-indigo-400 rounded-lg text-[9px] font-black">{lastSignal.confidence}% CONF</div>
                 </div>
                 <div className="p-3 bg-black/20 rounded-xl mb-4 border border-white/5">
                    <p className="text-slate-400 italic text-xs leading-relaxed">"{lastSignal.reasoning}"</p>
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => copyToClipboard(lastSignal.entry)} className="p-3 bg-slate-950 rounded-xl border border-white/5 text-left active:scale-95 transition-transform">
                        <div className="text-[8px] uppercase text-slate-500 font-bold mb-1">Entry</div>
                        <div className="text-white font-mono font-bold text-xs">${lastSignal.entry.toFixed(2)}</div>
                    </button>
                    <button onClick={() => copyToClipboard(lastSignal.tp)} className="p-3 bg-slate-950 rounded-xl border border-white/5 text-left active:scale-95 transition-transform">
                        <div className="text-[8px] uppercase text-slate-500 font-bold mb-1">Target</div>
                        <div className="text-emerald-400 font-mono font-bold text-xs">${lastSignal.tp.toFixed(2)}</div>
                    </button>
                    <button onClick={() => copyToClipboard(lastSignal.sl)} className="p-3 bg-slate-950 rounded-xl border border-white/5 text-left active:scale-95 transition-transform">
                        <div className="text-[8px] uppercase text-slate-500 font-bold mb-1">Stop</div>
                        <div className="text-rose-400 font-mono font-bold text-xs">${lastSignal.sl.toFixed(2)}</div>
                    </button>
                 </div>
              </div>
            ) : (
                <div className="bg-slate-900/10 border-2 border-dashed border-white/5 rounded-3xl p-12 text-center grayscale opacity-40">
                    <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
                    <h3 className="text-slate-500 font-black uppercase tracking-widest text-[9px]">Analyzing Market Data...</h3>
                </div>
            )}
          </div>

          {/* HISTORY PANEL */}
          <div className="lg:col-span-4">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <History className="w-3 h-3 text-indigo-400" /> Recent Trades
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
              {history.length === 0 ? (
                <div className="py-10 text-center text-slate-700 font-black uppercase text-[9px] border border-white/5 rounded-2xl">No History</div>
              ) : (
                history.map((record, i) => (
                  <div key={i} className="bg-slate-900/30 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${record.status === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {record.type === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-300 uppercase">{record.type}</div>
                        <div className="text-[8px] text-slate-600 font-bold">{new Date(record.exitTime).toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className={`text-xs font-mono font-black ${record.pnl && record.pnl > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {record.pnl && record.pnl > 0 ? '+' : ''}${record.pnl?.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* SIDE MENU - MOBILE OPTIMIZED */}
      <div className={`fixed inset-0 z-50 transition-transform duration-500 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsMenuOpen(false)} />
        <div className="absolute right-0 top-0 bottom-0 w-[320px] max-w-[85vw] bg-[#050814] border-l border-white/10 p-6 flex flex-col shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black italic tracking-tighter text-white">SYSTEM <span className="text-indigo-500">V1</span></h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar pb-10">
            
            <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-indigo-400" />
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Balance</span>
              </div>
              <div className="text-3xl font-mono font-black text-white tracking-tighter mb-4">${botState.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <button 
                onClick={async () => {
                   const reset = { isActive: false, balance: 1000, openPositions: [], history: [] };
                   await apiService.saveState(reset);
                   setBotState(reset);
                }} 
                className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3 h-3" /> Reset Demo
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intelligence</label>
              </div>
              
              {/* TOGGLE */}
              <div className="flex items-center justify-between bg-black/40 p-5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-300 uppercase">Use AI Validator</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.useAiAssistant} onChange={e => setSettings(s => ({ ...s, useAiAssistant: e.target.checked }))} />
                  <div className="w-10 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* API KEY INPUT */}
              {settings.useAiAssistant && (
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-3">
                    {hasApiKey ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase">Key Active</span>
                            </div>
                            <button onClick={deleteKey} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                <Key className="w-4 h-4 text-slate-500" />
                                <input 
                                    type="password" 
                                    placeholder="Paste Gemini API Key"
                                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-slate-600"
                                    value={apiKeyInput}
                                    onChange={e => setApiKeyInput(e.target.value)}
                                />
                             </div>
                             <button onClick={saveKey} className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg">
                                Save Key
                             </button>
                        </div>
                    )}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-white/5 flex items-center justify-between text-slate-600">
               <span className="text-[9px] font-black tracking-widest uppercase flex items-center gap-2"><Server className="w-3 h-3" /> SYNCED</span>
               <div className="flex items-center gap-2">
                <span className="text-[9px] font-black">ONLINE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
