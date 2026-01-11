
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Menu, X, Wallet, RefreshCw, Activity, 
  TrendingUp, TrendingDown, Cpu, 
  History, Copy, Power, Zap, ArrowUpRight, ArrowDownRight, Server,
  AlertTriangle, Trash2, Key, BarChart3, LayoutDashboard, ChevronRight, Eye
} from 'lucide-react';
import { TradingChart } from './components/TradingChart';
import { fetchHistoricalData, subscribeToTicker, WATCHLIST } from './services/marketService';
import { analyzeMarketAlgo } from './services/algoService';
import { analyzeWithAi } from './services/geminiService';
import { apiService } from './services/apiService';
import { BotState, AppSettings, Candle, TradeSignal, TradeAction, TradePosition } from './types';

// --- COMPONENTS ---

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

const AnalyticsModal = ({ history, onClose }: { history: any[], onClose: () => void }) => {
  const stats = useMemo(() => {
    const total = history.length;
    const wins = history.filter(h => h.pnl > 0).length;
    const rate = total > 0 ? (wins / total) * 100 : 0;
    const pnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
    
    // Group by Symbol
    const bySymbol: Record<string, { wins: number, total: number, pnl: number }> = {};
    history.forEach(h => {
        if (!bySymbol[h.symbol]) bySymbol[h.symbol] = { wins: 0, total: 0, pnl: 0 };
        bySymbol[h.symbol].total++;
        bySymbol[h.symbol].pnl += h.pnl || 0;
        if (h.pnl > 0) bySymbol[h.symbol].wins++;
    });

    return { total, wins, rate, pnl, bySymbol };
  }, [history]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl p-4 flex items-center justify-center">
        <div className="w-full max-w-4xl h-[90vh] bg-[#020617] border border-white/10 rounded-3xl flex flex-col relative overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
                    <BarChart3 className="text-indigo-500" /> TRADING ANALYTICS
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* HEADLINES */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase">Total Trades</div>
                        <div className="text-3xl font-mono text-white">{stats.total}</div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase">Win Rate</div>
                        <div className={`text-3xl font-mono ${stats.rate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{stats.rate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 col-span-2 md:col-span-2">
                        <div className="text-[10px] font-black text-slate-500 uppercase">Net Profit</div>
                        <div className={`text-3xl font-mono ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* PER PAIR BREAKDOWN */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Performance</h3>
                    {Object.keys(stats.bySymbol).length === 0 ? (
                        <div className="text-center py-10 text-slate-700">No Data Available</div>
                    ) : (
                        Object.entries(stats.bySymbol).map(([sym, data]) => (
                            <div key={sym} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">{sym.substring(0,1)}</div>
                                    <div>
                                        <div className="font-bold text-white text-sm">{sym}</div>
                                        <div className="text-[10px] text-slate-500">{data.wins}/{data.total} Wins</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{(data.wins/data.total*100).toFixed(0)}% WR</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  // Global State
  const [botState, setBotState] = useState<BotState>({ isActive: false, balance: 1000, openPositions: [], history: [] });
  const [history, setHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? JSON.parse(saved) : { theme: 'dark', chartMode: 'CANDLES', timeframe: '1m', useAiAssistant: false };
  });

  // UI State
  const [activeSymbol, setActiveSymbol] = useState('BTCUSDT');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [lastSignal, setLastSignal] = useState<TradeSignal | null>(null);
  const [marketOverview, setMarketOverview] = useState<Record<string, { signal: TradeAction, conf: number }>>({});
  
  // System State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);

  // --- INITIALIZATION ---
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

  // --- PERSISTENT UPTIME ---
  useEffect(() => {
    if (botState.isActive && botState.startTime) {
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.floor((now - botState.startTime!) / 1000);
        setUptime(diff > 0 ? diff : 0);
      };
      updateTimer();
      const t = setInterval(updateTimer, 1000);
      return () => clearInterval(t);
    } else {
      setUptime(0);
    }
  }, [botState.isActive, botState.startTime]);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // --- CHART DATA LOADING ---
  const loadData = async (symbol: string, endTime?: number) => {
    return await fetchHistoricalData(symbol, settings.timeframe, 300, endTime);
  };

  // Load Active Chart
  useEffect(() => {
    setCandles([]); 
    setLastSignal(null);
    
    loadData(activeSymbol).then(data => {
        setCandles(data);
        // Run immediate analysis on load for visual feedback
        const sig = analyzeMarketAlgo(data, activeSymbol);
        setLastSignal(sig);
    });

    const cleanup = subscribeToTicker(activeSymbol, settings.timeframe, (newCandle) => {
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
  }, [activeSymbol, settings.timeframe]);

  const handleLoadMore = async () => {
    if (candles.length === 0) return;
    const oldestTime = candles[0].time;
    const olderCandles = await loadData(activeSymbol, oldestTime);
    if (olderCandles.length > 0) {
      const uniqueOlder = olderCandles.filter(c => c.time < oldestTime);
      setCandles(prev => [...uniqueOlder, ...prev]);
    }
  };

  // --- BACKGROUND SCANNER (The "Eyes" of the Bot) ---
  useEffect(() => {
    // Cycles through watchlist to update "Market Overview" signals
    const scan = async () => {
        const newOverview: Record<string, { signal: TradeAction, conf: number }> = {};
        
        // Process in chunks to avoid rate limits
        for (const sym of WATCHLIST) {
            // Just get 60 candles for quick analysis
            const data = await fetchHistoricalData(sym, settings.timeframe, 60);
            if (data.length > 50) {
                const sig = analyzeMarketAlgo(data, sym);
                newOverview[sym] = { signal: sig.action, conf: sig.confidence };
                
                // If it's the currently viewed symbol, update the main signal
                if (sym === activeSymbol) {
                    setLastSignal(sig);
                }
            }
        }
        setMarketOverview(prev => ({...prev, ...newOverview}));
    };

    scan(); // Initial scan
    const interval = setInterval(scan, 15000); // Scan every 15s
    return () => clearInterval(interval);
  }, [settings.timeframe, activeSymbol]);


  // --- TRADING ENGINE (The "Hands" of the Bot) ---
  useEffect(() => {
    if (!botState.isActive) return;

    const runEngine = async () => {
      // Loop through all watchlist pairs
      // Note: Real production bots use websockets for all. Here we iterate.
      for (const sym of WATCHLIST) {
          try {
            // Do we already have a position for this symbol?
            const existingPos = botState.openPositions.find(p => p.symbol === sym);
            if (existingPos) {
                 // Check close logic
                 const data = await fetchHistoricalData(sym, '1m', 2); // Get current price
                 if (data.length > 0) {
                    const currentPrice = data[data.length - 1].close;
                    const isBuy = existingPos.type === 'BUY';
                    const hitTp = isBuy ? currentPrice >= existingPos.tp : currentPrice <= existingPos.tp;
                    const hitSl = isBuy ? currentPrice <= existingPos.sl : currentPrice >= existingPos.sl;
                    
                    if (hitTp || hitSl) {
                        const pnl = isBuy ? (currentPrice - existingPos.entryPrice) * existingPos.amount : (existingPos.entryPrice - currentPrice) * existingPos.amount;
                        const record = { ...existingPos, exitPrice: currentPrice, exitTime: Date.now(), status: pnl > 0 ? 'WIN' : 'LOSS', pnl } as any;
                        
                        await apiService.addToHistory(record);
                        
                        // Optimistic update
                        const newState = { 
                           ...botState, 
                           balance: botState.balance + pnl,
                           openPositions: botState.openPositions.filter(p => p.id !== existingPos.id)
                        };
                        setBotState(newState); // Local update first
                        await apiService.saveState(newState);
                        setInfoMsg(`Closed ${sym}: $${pnl.toFixed(2)}`);
                    }
                 }
                 continue; 
            }

            // No position? Look for entry.
            // We reuse the scan logic indirectly or fetch fresh
            const data = await fetchHistoricalData(sym, settings.timeframe, 60);
            let signal = analyzeMarketAlgo(data, sym);

            if (signal.action !== TradeAction.HOLD) {
                 if (settings.useAiAssistant && hasApiKey) {
                     signal = await analyzeWithAi(data, signal);
                 }

                 if (signal.action !== TradeAction.HOLD) {
                     const newPos: TradePosition = {
                        id: Math.random().toString(36).substr(2, 9),
                        symbol: sym,
                        type: signal.action === TradeAction.BUY ? 'BUY' : 'SELL',
                        entryPrice: signal.entry,
                        amount: (botState.balance * 0.1) / signal.entry, // Use 10% of balance logic roughly
                        tp: signal.tp,
                        sl: signal.sl,
                        timestamp: Date.now()
                     };
                     
                     const newState = { ...botState, openPositions: [...botState.openPositions, newPos] };
                     setBotState(newState);
                     await apiService.saveState(newState);
                     setInfoMsg(`${signal.action} ${sym}`);
                 }
            }

          } catch (e) {
              console.error("Engine loop error", e);
          }
      }
    };

    const timer = setInterval(runEngine, 5000); // Check all pairs every 5 seconds
    return () => clearInterval(timer);
  }, [botState.isActive, settings.useAiAssistant, hasApiKey, botState.openPositions]);


  // --- ACTIONS ---
  const toggleEngine = async () => {
    const newActive = !botState.isActive;
    let newState = { 
        ...botState, 
        isActive: newActive,
        startTime: newActive ? Date.now() : undefined 
    };
    
    // Close all positions on stop? (Optional, user usually prefers manual or let them run. 
    // Current logic: keeps positions open unless manually implemented close, but for safety lets keep them).
    
    await apiService.saveState(newState);
    setBotState(newState);
  };

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

  const currentPrice = candles[candles.length - 1]?.close || 0;
  const isUp = candles.length > 1 && currentPrice >= candles[candles.length - 2].close;

  // --- RENDER ---
  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${settings.theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      <DynamicIsland error={errorMsg} message={infoMsg} />
      {showAnalytics && <AnalyticsModal history={history} onClose={() => setShowAnalytics(false)} />}

      {/* DESKTOP SIDEBAR (WATCHLIST) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#050814] h-screen fixed left-0 top-0 z-20">
         <div className="h-16 flex items-center px-6 border-b border-white/5">
             <div className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase flex items-center gap-1.5">
               <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${botState.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
               NEURO | V2
             </div>
         </div>
         <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-1">
             <div className="px-4 pb-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">Market Watch</div>
             {WATCHLIST.sort((a,b) => {
                 // Sort by signal strength (simple logic: buy/sell on top)
                 const valA = marketOverview[a]?.signal !== 'HOLD' ? 1 : 0;
                 const valB = marketOverview[b]?.signal !== 'HOLD' ? 1 : 0;
                 return valB - valA;
             }).map(sym => {
                 const overview = marketOverview[sym];
                 const isActive = activeSymbol === sym;
                 const hasSignal = overview && overview.signal !== 'HOLD';
                 
                 return (
                     <button 
                        key={sym} 
                        onClick={() => setActiveSymbol(sym)}
                        className={`w-full px-6 py-3 flex items-center justify-between transition-all ${isActive ? 'bg-indigo-500/10 border-r-2 border-indigo-500' : 'hover:bg-white/5 border-r-2 border-transparent'}`}
                     >
                        <div className="flex flex-col items-start">
                            <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>{sym}</span>
                            <span className="text-[9px] text-slate-600">PERP</span>
                        </div>
                        {hasSignal && (
                             <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${overview.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                 {overview.signal}
                             </div>
                        )}
                     </button>
                 )
             })}
         </div>
         <div className="p-4 border-t border-white/5">
             <button onClick={() => setShowAnalytics(true)} className="w-full py-3 rounded-xl bg-slate-900 border border-white/5 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2 group">
                 <BarChart3 className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                 <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white">Analytics</span>
             </button>
         </div>
      </aside>

      {/* MOBILE HEADER (Visible only on mobile) */}
      <header className="md:hidden h-16 px-4 border-b border-white/5 glass fixed top-0 w-full z-40 flex items-center justify-between bg-[#020617]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Cpu className="text-white w-4 h-4" />
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">
                {activeSymbol}
            </div>
            <div className={`text-sm font-mono font-black tracking-tighter ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${currentPrice.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
             <button onClick={() => setShowAnalytics(true)} className="p-2 bg-slate-800 rounded-lg"><BarChart3 className="w-4 h-4 text-indigo-400"/></button>
             <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-slate-800 rounded-lg"><Menu className="w-4 h-4 text-white"/></button>
        </div>
      </header>
      
      {/* MOBILE SYMBOL SCROLLER */}
      <div className="md:hidden fixed top-16 left-0 right-0 h-10 bg-[#050814] border-b border-white/5 flex items-center overflow-x-auto no-scrollbar z-30 px-2 gap-2">
          {WATCHLIST.map(sym => (
              <button 
                key={sym} 
                onClick={() => setActiveSymbol(sym)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-[9px] font-bold border ${activeSymbol === sym ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-500 border-white/5'}`}
              >
                  {sym} {marketOverview[sym]?.signal !== 'HOLD' && '•'}
              </button>
          ))}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-64 pt-28 md:pt-4 px-2 md:px-6 pb-20 max-w-[1600px]">
        
        {/* DESKTOP HEADER */}
        <div className="hidden md:flex justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    {activeSymbol} 
                    <span className={`text-xl font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>${currentPrice.toLocaleString()}</span>
                </h1>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">AI Algorithmic Terminal</div>
            </div>
            <div className="flex items-center gap-4">
                 {/* Uptime Badge */}
                 {botState.isActive && (
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-mono font-bold text-emerald-400">{formatUptime(uptime)}</span>
                    </div>
                 )}
                 <button 
                    onClick={toggleEngine}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${botState.isActive ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                 >
                    <Power className="w-4 h-4" /> {botState.isActive ? 'Stop Engine' : 'Start Engine'}
                 </button>
            </div>
        </div>

        {/* CHART CONTAINER */}
        <section className="bg-slate-950 rounded-2xl border border-white/5 shadow-2xl overflow-hidden mb-4">
             <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-[#020617]">
                 <div className="flex gap-1">
                    {['1m', '5m', '15m', '1h'].map(tf => (
                        <button key={tf} onClick={() => setSettings(s => ({...s, timeframe: tf as any}))} className={`px-3 py-1 text-[9px] font-bold rounded ${settings.timeframe === tf ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                            {tf}
                        </button>
                    ))}
                 </div>
                 <div className="text-[9px] font-black text-slate-600 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> PATTERN RECOGNITION ACTIVE
                 </div>
             </div>
             <div className="h-[350px] md:h-[500px] w-full relative">
                 <TradingChart 
                    symbol={activeSymbol}
                    data={candles} 
                    mode={settings.chartMode} 
                    positions={botState.openPositions} 
                    lastSignal={lastSignal} 
                    onLoadMore={handleLoadMore}
                 />
             </div>
        </section>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. SIGNAL CARD */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Analysis</h3>
                    {lastSignal && lastSignal.symbol === activeSymbol && (
                        <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${lastSignal.confidence > 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {lastSignal.confidence}% CONF
                        </div>
                    )}
                </div>
                {lastSignal && lastSignal.symbol === activeSymbol && lastSignal.action !== TradeAction.HOLD ? (
                     <div>
                         <div className="flex items-center gap-3 mb-4">
                             <div className={`p-3 rounded-xl ${lastSignal.action === TradeAction.BUY ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>
                                 {lastSignal.action === TradeAction.BUY ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                             </div>
                             <div>
                                 <div className="text-2xl font-black text-white">{lastSignal.action}</div>
                                 <div className="text-[10px] text-slate-400">Entry: <span className="text-white font-mono">${lastSignal.entry}</span></div>
                             </div>
                         </div>
                         <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                             <p className="text-[10px] text-slate-300 leading-relaxed italic">"{lastSignal.reasoning}"</p>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                             <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/10">
                                 <div className="text-[8px] text-emerald-500 font-bold uppercase">Target</div>
                                 <div className="font-mono text-emerald-400 text-xs">${lastSignal.tp.toFixed(2)}</div>
                             </div>
                             <div className="bg-rose-500/10 p-2 rounded-lg border border-rose-500/10">
                                 <div className="text-[8px] text-rose-500 font-bold uppercase">Stop</div>
                                 <div className="font-mono text-rose-400 text-xs">${lastSignal.sl.toFixed(2)}</div>
                             </div>
                         </div>
                     </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 opacity-50">
                        <Eye className="w-8 h-8 mb-2 text-slate-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Scanning {activeSymbol}...</span>
                    </div>
                )}
            </div>

            {/* 2. OPEN POSITIONS CARD */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Positions</h3>
                    <span className="text-xs font-mono text-white">{botState.openPositions.length} Open</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                    {botState.openPositions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-700 font-bold">NO ACTIVE TRADES</div>
                    ) : (
                        botState.openPositions.map(pos => {
                             // Calc live PnL roughly based on last known candles
                             // In real app, we need live price for all.
                             // Here we only know live price if activeSymbol == pos.symbol or we fetch snapshot
                             const isCurrent = pos.symbol === activeSymbol;
                             const price = isCurrent ? currentPrice : pos.entryPrice; // Fallback to entry if not viewing
                             const pnl = pos.type === 'BUY' ? (price - pos.entryPrice) * pos.amount : (pos.entryPrice - price) * pos.amount;
                             
                             return (
                                <div key={pos.id} onClick={() => setActiveSymbol(pos.symbol)} className="cursor-pointer bg-black/40 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1 h-8 rounded-full ${pos.type === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <div>
                                                <div className="text-xs font-black text-white">{pos.symbol}</div>
                                                <div className={`text-[9px] font-bold ${pos.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>{pos.type} @ {pos.entryPrice.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className={`font-mono font-bold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {isCurrent ? `$${pnl.toFixed(2)}` : '...'}
                                        </div>
                                    </div>
                                </div>
                             )
                        })
                    )}
                </div>
            </div>

            {/* 3. SETTINGS & KEY CARD */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configuration</h3>
                </div>
                
                <div className="space-y-4">
                    {/* Toggle AI */}
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <Zap className="w-4 h-4 text-purple-400" />
                             <span className="text-xs font-bold text-slate-300">AI Validation</span>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={settings.useAiAssistant} onChange={e => setSettings(s => ({ ...s, useAiAssistant: e.target.checked }))} />
                            <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                    </div>

                    {/* API Key */}
                    {settings.useAiAssistant && (
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                            {hasApiKey ? (
                                <div className="flex items-center justify-between">
                                    <div className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><Key className="w-3 h-3"/> API KEY SECURE</div>
                                    <button onClick={deleteKey}><Trash2 className="w-3 h-3 text-slate-600 hover:text-rose-500" /></button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input 
                                        type="password" 
                                        className="flex-1 bg-transparent border-none text-[10px] text-white focus:outline-none"
                                        placeholder="Paste Gemini Key"
                                        value={apiKeyInput}
                                        onChange={e => setApiKeyInput(e.target.value)}
                                    />
                                    <button onClick={saveKey} className="text-[9px] font-bold bg-indigo-600 px-2 py-1 rounded text-white">SAVE</button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-2 border-t border-white/5">
                         <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                             <span>BALANCE</span>
                             <span className="text-white font-mono">${botState.balance.toFixed(2)}</span>
                         </div>
                    </div>
                    {/* Mobile Engine Toggle Duplicate */}
                    <button 
                        onClick={toggleEngine}
                        className="md:hidden w-full py-3 mt-2 rounded-xl bg-white/5 text-[10px] font-black uppercase text-slate-300 border border-white/5"
                     >
                        {botState.isActive ? 'Stop System' : 'Start System'}
                     </button>
                </div>
            </div>

        </div>

      </main>

      {/* MOBILE MENU DRAWER */}
      <div className={`fixed inset-0 z-50 transition-transform duration-500 md:hidden ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsMenuOpen(false)} />
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-[#050814] border-l border-white/10 p-6 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-8">
                <span className="text-xs font-black text-white">MENU</span>
                <button onClick={() => setIsMenuOpen(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <button 
                onClick={async () => {
                   const reset = { isActive: false, balance: 1000, openPositions: [], history: [] };
                   await apiService.saveState(reset);
                   setBotState(reset);
                   setIsMenuOpen(false);
                }} 
                className="w-full py-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20 mb-4"
            >
                Reset Account
            </button>

            <button 
                onClick={() => { setShowAnalytics(true); setIsMenuOpen(false); }}
                className="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-bold mb-4"
            >
                View Analytics
            </button>
        </div>
      </div>

    </div>
  );
}
