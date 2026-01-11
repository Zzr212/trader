
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { analyzeMarket } from './algo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// --- IN-MEMORY STATE (The Server Brain) ---
// Note: This resets if the Render server restarts. 
let botState = {
    isActive: false,
    startTime: 0,
    balance: 1000,
    openPositions: [],
    history: [],
    totalProfit: 0
};

const WATCHLIST = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 
    'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'
];

// --- TRADING ENGINE LOOP ---
const runEngine = async () => {
    if (!botState.isActive) return;

    // console.log(`[Engine] Scanning market...`);

    for (const symbol of WATCHLIST) {
        try {
            // 1. Fetch Data
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=210`;
            const response = await fetch(binanceUrl);
            if (!response.ok) continue;
            
            const rawData = await response.json();
            const candles = rawData.map(d => ({
                time: Math.floor(d[0] / 1000),
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5]),
            }));

            const currentPrice = candles[candles.length - 1].close;

            // 2. Manage Existing Positions
            const posIndex = botState.openPositions.findIndex(p => p.symbol === symbol);
            
            if (posIndex !== -1) {
                const pos = botState.openPositions[posIndex];
                const isBuy = pos.type === 'BUY';
                
                // TP/SL Logic
                const hitTp = isBuy ? currentPrice >= pos.tp : currentPrice <= pos.tp;
                const hitSl = isBuy ? currentPrice <= pos.sl : currentPrice >= pos.sl;

                if (hitTp || hitSl) {
                    const pnl = isBuy 
                        ? (currentPrice - pos.entryPrice) * pos.amount 
                        : (pos.entryPrice - currentPrice) * pos.amount;
                    
                    // Fee 0.1%
                    const fee = (currentPrice * pos.amount) * 0.001; 
                    const finalPnl = pnl - fee;

                    // Close Position
                    botState.balance += finalPnl;
                    botState.totalProfit += finalPnl;
                    
                    const record = {
                        ...pos,
                        exitPrice: currentPrice,
                        exitTime: Date.now(),
                        status: finalPnl > 0 ? 'WIN' : 'LOSS',
                        pnl: finalPnl
                    };

                    botState.history.unshift(record);
                    botState.openPositions.splice(posIndex, 1);
                    
                    // Keep history manageable
                    if (botState.history.length > 50) botState.history.pop();
                    
                    console.log(`[Engine] Closed ${symbol}: $${finalPnl.toFixed(2)}`);
                }
            } 
            // 3. Search for New Trades
            else if (botState.openPositions.length < 3) {
                const signal = analyzeMarket(candles, symbol);
                
                if (signal.action !== 'HOLD') {
                    const riskAmount = botState.balance * 0.20; // 20% of balance
                    const amount = riskAmount / currentPrice;

                    const newPos = {
                        id: Math.random().toString(36).substring(7),
                        symbol: symbol,
                        type: signal.action,
                        entryPrice: currentPrice,
                        amount: amount,
                        tp: signal.tp,
                        sl: signal.sl,
                        leverage: 1,
                        timestamp: Date.now()
                    };

                    botState.openPositions.push(newPos);
                    console.log(`[Engine] Opened ${signal.action} on ${symbol}`);
                }
            }

        } catch (e) {
            console.error(`Error processing ${symbol}:`, e.message);
        }
    }
};

// Run engine every 5 seconds
setInterval(runEngine, 5000);


// --- API ROUTES ---

// Get Status
app.get('/api/state', (req, res) => {
    res.json(botState);
});

// Toggle Bot
app.post('/api/toggle', (req, res) => {
    botState.isActive = !botState.isActive;
    if (botState.isActive) {
        botState.startTime = Date.now();
        console.log("Bot Started");
    } else {
        botState.startTime = 0;
        console.log("Bot Stopped");
    }
    res.json(botState);
});

// Reset
app.post('/api/reset', (req, res) => {
    botState = {
        isActive: false,
        startTime: 0,
        balance: 1000,
        openPositions: [],
        history: [],
        totalProfit: 0
    };
    res.json(botState);
});

// Binance Proxy (for frontend charts)
app.get('/api/proxy/klines', async (req, res) => {
    try {
        const { symbol, interval, limit } = req.query;
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(binanceUrl);
        if (!response.ok) return res.status(response.status).json([]);
        const data = await response.json();
        
        const candles = data.map(d => ({
            time: Math.floor(d[0] / 1000),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));

        res.json(candles);
    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json([]);
    }
});

app.get('/api/health', (req, res) => res.send('OK'));

// --- STATIC FILES ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`NeuroTrade Server running on port ${PORT}`);
});
