
import { BotState, TradeRecord } from "../types";

const API_BASE = '/api';

const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404) {
        throw new Error('API_NOT_FOUND');
      }
      throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}`);
    }
    return res.json();
  } catch (error) {
    // Re-throw to be handled by specific service methods
    throw error;
  }
};

export const apiService = {
  // State
  getState: async (): Promise<BotState> => {
    try {
      return await fetchJson<BotState>(`${API_BASE}/state`);
    } catch (error) {
      console.warn("API State unreachable, using default:", error);
      // Return default offline state to prevent UI crash
      return { isActive: false, balance: 1000, openPositions: [], history: [] };
    }
  },
  saveState: async (state: BotState): Promise<void> => {
    try {
      await fetchJson(`${API_BASE}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch (error) {
      console.warn("Failed to save state (Offline mode)", error);
    }
  },

  // History
  getHistory: async (): Promise<TradeRecord[]> => {
    try {
      return await fetchJson<TradeRecord[]>(`${API_BASE}/history`);
    } catch (error) {
      return []; // Return empty history if offline
    }
  },
  addToHistory: async (record: TradeRecord): Promise<void> => {
    try {
      await fetchJson(`${API_BASE}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    } catch (error) {
      console.warn("Failed to save history (Offline mode)");
    }
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
