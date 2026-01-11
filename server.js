
import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- DATA PERSISTENCE HELPERS ---
const DATA_DIR = path.join(__dirname, 'data');

const ensureDataDir = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

const readJson = async (filename, defaultVal) => {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    try {
      return JSON.parse(data) || defaultVal;
    } catch {
      return defaultVal;
    }
  } catch (error) {
    return defaultVal;
  }
};

const writeJson = async (filename, data) => {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
  } catch (error) {
    console.error(`Failed to write ${filename}:`, error);
  }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/state', async (req, res) => {
  const state = await readJson('botState.json', { isActive: false, balance: 1000, openPositions: [], history: [] });
  res.json(state);
});

app.post('/api/state', async (req, res) => {
  await writeJson('botState.json', req.body);
  res.json({ success: true });
});

app.get('/api/history', async (req, res) => {
  const history = await readJson('trades.json', []);
  res.json(history);
});

app.post('/api/history', async (req, res) => {
  const history = await readJson('trades.json', []);
  const newRecords = Array.isArray(req.body) ? req.body : [req.body];
  const updated = [...newRecords, ...history].slice(0, 1000); // Increased history limit for multiple pairs
  await writeJson('trades.json', updated);
  res.json({ success: true });
});

app.get('/api/key/status', async (req, res) => {
  const keyData = await readJson('key.json', {});
  res.json({ hasKey: !!keyData?.key });
});

app.post('/api/key', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'No key provided' });
  await writeJson('key.json', { key });
  res.json({ success: true });
});

app.delete('/api/key', async (req, res) => {
  await writeJson('key.json', {});
  res.json({ success: true });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const keyData = await readJson('key.json', {});
    const apiKey = keyData?.key || process.env.API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'AI API Key missing.' });
    }

    let { prompt, model } = req.body;
    
    // Safety clamp for prompt size
    if (prompt && prompt.length > 10000) {
      prompt = prompt.substring(0, 10000) + "... [Truncated]";
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            tp: { type: Type.NUMBER },
            sl: { type: Type.NUMBER },
            patterns: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["action", "confidence", "reasoning"]
        }
      }
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error("AI Proxy Error:", error);
    // Send a 200 with error details so the frontend handles it gracefully without a 500 crash
    res.json({ 
      text: JSON.stringify({
        action: "HOLD", 
        confidence: 0, 
        reasoning: `AI Error: ${error.message || 'Unknown'}` 
      }) 
    });
  }
});

// Explicit 404 for API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API Endpoint Not Found' });
});

// --- STATIC FILES ---
const distPath = path.join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // SPA Catch-all
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn("WARNING: 'dist' folder not found. Running in API-only mode.");
  app.get('/', (req, res) => res.send('Backend API is running. Frontend not built.'));
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
