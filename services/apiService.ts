
import { BotState } from "../types";

export const apiService = {
  // Get State from Server
  getState: async (): Promise<BotState> => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to fetch state');
      return await res.json();
    } catch (error) {
      console.error("API Error", error);
      // Fallback only if server down
      return { isActive: false, balance: 0, openPositions: [], history: [], totalProfit: 0 };
    }
  },

  // Toggle Bot on Server
  toggleBot: async (): Promise<BotState> => {
    try {
      const res = await fetch('/api/toggle', { method: 'POST' });
      return await res.json();
    } catch (error) {
       console.error("API Error", error);
       throw error;
    }
  },

  resetState: async (): Promise<BotState> => {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        return await res.json();
      } catch (error) {
        throw error;
      }
  },

  // Still needed for Chart
  fetchCandlesProxy: async (symbol: string, interval: string, limit: number) => {
      try {
          const res = await fetch(`/api/proxy/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
          if (!res.ok) return [];
          return await res.json();
      } catch (e) {
          console.error("Proxy fetch failed", e);
          return [];
      }
  }
};
