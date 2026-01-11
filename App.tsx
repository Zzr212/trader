
import React, { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, TrendingDown, 
  Power, Crosshair, RefreshCw
} from 'lucide-react';
import { TradingChart } from './components/TradingChart';
import { fetchHistoricalData, subscribeToTicker, WATCHLIST } from './services/marketService';
import { analyzeMarketAlgo } from './services/algoService'; // Still used for UI signals only
import { apiService } from './services/apiService';
import { BotState, Candle, TradeSignal } from './types';

// --- COMPONENTS ---

const StatCard = ({ label, value, sub, color = "indigo" }: any) => (
  <div className="bg-[#0b1121] border border-white/5 p-4 rounded-xl relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-500`}>
      <Activity />
    </div>
    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">{label}</div>
    <div className={`text-2xl font-mono font-bold text-white`}>{value}</div>
    {sub && <div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{sub}</div>}
  </div>
);

// --- MAIN APP ---

export default function App() {
  // --- STATE ---
  const [state, setState] = useState<BotState>({
    isActive: false,
    startTime: 0,
    balance: 1000,
    openPositions: [],
    history: [],
    totalProfit: 0
  });
  
  const [activeSymbol, setActiveSymbol] = useState('BTCUSDT');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastSignal, setLastSignal] = useState<TradeSignal | null>(null);
  const [uptime, setUptime] = useState<string>("00:00:00");
  const [timeframe, setTimeframe] = useState<'1m'|'5m'>('1m');

  // --- SERVER POLLING (MONITORING) ---
  useEffect(() => {
    // Initial fetch
    apiService.getState().then(setState);

    // Poll server every 2 seconds for updates
    const interval = setInterval(async () => {
        const serverState = await apiService.getState();
        setState(serverState);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // --- UPTIME TIMER ---
  useEffect(() => {
    if (!state.isActive || !state.startTime) {
        setUptime("00:00:00");
        return;
    }

    const timer = setInterval(() => {
        const diff = Math.floor((Date.now() - (state.startTime || Date.now())) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setUptime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [state.isActive, state.startTime]);

  // --- CHART DATA & UI ALGO (Visual only) ---
  useEffect(() => {
    setCandles([]);
    fetchHistoricalData(activeSymbol, timeframe, 250).then(data => {
      setCandles(data);
      // Run visual analysis for the chart (Client side only for display)
      const sig = analyzeMarketAlgo(data, activeSymbol);
      setLastSignal(sig);
    });

    const unsub = subscribeToTicker(activeSymbol, timeframe, (c) => {
      setCandles(prev => {
        if (prev.length === 0) return [c];
        const last = prev[prev.length - 1];
        if (c.time === last.time) {
           const updated = [...prev];
           updated[updated.length - 1] = c;
           return updated;
        }
        return [...prev, c];
      });
    });
    return () => unsub();
  }, [activeSymbol, timeframe]);

  // --- ACTIONS ---
  const toggleSystem = async () => {
      const newState = await apiService.toggleBot();
      setState(newState);
  };

  const resetAccount = async () => {
    const fresh = await apiService.resetState();
    setState(fresh);
  };

  const currentPrice = candles[candles.length - 1]?.close || 0;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-indigo-500/30">
      
      {/* HEADER */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#020617]/80 backdrop-blur fixed top-0 w-full z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
            <Crosshair className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="text-white font-black tracking-tighter text-lg leading-none">NEURO<span className="text-indigo-500">SNIPER</span></div>
            <div className="text-[9px] font-bold text-slate-500 tracking-[0.3em]">SERVER-SIDE EXECUTION</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Net Equity</span>
              <span className={`font-mono font-bold text-lg ${state.balance >= 1000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${state.balance.toFixed(2)}
              </span>
           </div>
           
           <div className="flex flex-col items-end">
              <button 
                onClick={toggleSystem}
                className={`flex items-center gap-2 px-4 py-2 rounded font-bold uppercase text-xs transition-all ${state.isActive ? 'bg-rose-500/10 text-rose-500 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/50'}`}
              >
                <Power className="w-4 h-4" /> {state.isActive ? 'STOP SERVER' : 'START SERVER'}
              </button>
              {state.isActive && (
                 <span className="text-[9px] font-mono text-emerald-500 mt-1">UPTIME: {uptime}</span>
              )}
           </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="pt-20 px-4 md:px-6 pb-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-w-[1800px] mx-auto">
        
        {/* LEFT: WATCHLIST */}
        <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-4 h-[calc(100vh-100px)]">
           <div className="bg-[#0b1121] border border-white/5 rounded-xl flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-white/5 bg-white/2 font-bold text-xs flex justify-between">
                <span>MARKET</span>
                <RefreshCw className="w-3 h-3 text-slate-500" />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {WATCHLIST.map(sym => (
                     <button 
                       key={sym}
                       onClick={() => setActiveSymbol(sym)}
                       className={`w-full flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors ${activeSymbol === sym ? 'bg-indigo-500/20 border border-indigo-500/30' : ''}`}
                     >
                       <span className="text-xs font-bold">{sym.replace('USDT','')}</span>
                       <span className="text-[9px] text-slate-500">PERP</span>
                     </button>
                 ))}
              </div>
           </div>
        </div>

        {/* CENTER: CHART & STATS */}
        <div className="md:col-span-9 lg:col-span-7 flex flex-col gap-4">
           {/* KPI ROW */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Profit" value={`$${state.totalProfit.toFixed(2)}`} sub={state.totalProfit > 0 ? "+ROI" : "Drawdown"} color={state.totalProfit >= 0 ? 'emerald' : 'rose'} />
              <StatCard label="Win Rate" value={`${state.history.length > 0 ? ((state.history.filter(h=>h.status==='WIN').length / state.history.length)*100).toFixed(0) : 0}%`} color="indigo" />
              <StatCard label="Open Trades" value={state.openPositions.length} sub="Exposure" color="amber" />
              <StatCard label="Algorithm" value="SNIPER" sub="SERVER MODE" color="purple" />
           </div>

           {/* CHART */}
           <div className="flex-1 bg-[#0b1121] border border-white/5 rounded-xl overflow-hidden relative min-h-[500px]">
              <div className="absolute top-4 left-4 z-10 flex gap-2">
                 <div className="text-2xl font-black text-white">{activeSymbol}</div>
                 <div className="text-xl font-mono text-indigo-400">${currentPrice.toLocaleString()}</div>
              </div>
              
              <div className="absolute bottom-4 left-4 z-10 flex gap-1">
                 {['1m', '5m'].map(tf => (
                   <button key={tf} onClick={() => setTimeframe(tf as any)} className={`px-2 py-1 rounded text-xs font-bold ${timeframe === tf ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                     {tf}
                   </button>
                 ))}
              </div>

              <TradingChart 
                symbol={activeSymbol}
                data={candles} 
                mode="CANDLES" 
                positions={state.openPositions} 
                lastSignal={lastSignal} 
                onLoadMore={async () => {}}
              />
           </div>
        </div>

        {/* RIGHT: DETAILS & HISTORY */}
        <div className="md:col-span-12 lg:col-span-3 flex flex-col gap-4">
           
           {/* SERVER STATUS */}
           <div className="bg-[#0b1121] border border-white/5 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">System Status</div>
              <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${state.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="font-bold text-white text-sm">{state.isActive ? 'ENGINE RUNNING' : 'ENGINE STOPPED'}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                  Bot is analyzing 8 pairs on the server every 5 seconds.
              </div>
           </div>

           {/* POSITIONS */}
           <div className="bg-[#0b1121] border border-white/5 rounded-xl flex-1 flex flex-col overflow-hidden">
               <div className="p-3 border-b border-white/5 font-bold text-xs bg-white/2">OPEN POSITIONS (SERVER)</div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {state.openPositions.length === 0 && <div className="text-center py-4 text-[10px] text-slate-600">NO EXPOSURE</div>}
                  {state.openPositions.map(p => {
                    // Estimate PnL based on current view price if symbol matches, else rely on entry
                    const price = p.symbol === activeSymbol ? currentPrice : p.entryPrice; 
                    // Note: This is an estimation, real PnL is calculated on server close
                    const pnl = p.type === 'BUY' ? (price - p.entryPrice)*p.amount : (p.entryPrice - price)*p.amount;
                    return (
                      <div key={p.id} className="bg-black/40 border border-white/5 p-2 rounded relative overflow-hidden">
                         <div className="flex justify-between items-start z-10 relative">
                            <div>
                               <div className="font-black text-xs text-white">{p.symbol}</div>
                               <div className={`text-[9px] font-bold ${p.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>{p.type}</div>
                            </div>
                            <div className={`font-mono font-bold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                            </div>
                         </div>
                      </div>
                    )
                  })}
               </div>
           </div>

           <button onClick={resetAccount} className="p-2 text-[10px] font-bold text-slate-600 hover:text-white transition-colors">
              RESET SERVER STATE
           </button>
        </div>

      </div>
    </div>
  );
}
