
import { BotState, TradeRecord } from "../types";

const API_BASE = '/api';

const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      // Try to get text, but handle cases where body might be empty
      const text = await res.text().catch(() => '');
      // If 404 and HTML, it's likely a wrong route or missing file
      if (res.status === 404 && text.includes('<!DOCTYPE html>')) {
        throw new Error('API Endpoint Not Found');
      }
      throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}`);
    }
    return res.json();
  } catch (error) {
    console.error(`Fetch failed for ${url}:`, error);
    throw error;
  }
};

export const apiService = {
  // State
  getState: async (): Promise<BotState> => {
    return fetchJson<BotState>(`${API_BASE}/state`);
  },
  saveState: async (state: BotState): Promise<void> => {
    await fetchJson(`${API_BASE}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  },

  // History
  getHistory: async (): Promise<TradeRecord[]> => {
    return fetchJson<TradeRecord[]>(`${API_BASE}/history`);
  },
  addToHistory: async (record: TradeRecord): Promise<void> => {
    await fetchJson(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  },

  // Key
  checkKeyStatus: async (): Promise<boolean> => {
    try {
      const data = await fetchJson<{hasKey: boolean}>(`${API_BASE}/key/status`);
      return data.hasKey;
    } catch { return false; }
  },
  saveKey: async (key: string): Promise<void> => {
    await fetchJson(`${API_BASE}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  },
  deleteKey: async (): Promise<void> => {
    await fetchJson(`${API_BASE}/key`, { method: 'DELETE' });
  },

  // AI Proxy
  analyze: async (prompt: string, model: string): Promise<any> => {
    return fetchJson(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    });
  }
};
