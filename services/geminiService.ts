
import { Candle, TradeSignal, TradeAction } from "../types";
import { apiService } from "./apiService";

export const analyzeWithAi = async (candles: Candle[], algoSignal: TradeSignal): Promise<TradeSignal> => {
  const recent = candles.slice(-20).map(c => `H:${c.high} L:${c.low} C:${c.close}`).join('|');
  
  const prompt = `
    Context: BTC/USDT Trading.
    Algo Strategy Signal: ${algoSignal.action}
    Confidence: ${algoSignal.confidence}%
    Reason: ${algoSignal.reasoning}
    
    Data (Last 20 candles): ${recent}
    
    Task: Validate the trade. If signal is weak, change to HOLD.
    Respond in JSON only.
  `;

  try {
    // Call server proxy
    const response = await apiService.analyze(prompt, "gemini-3-flash-preview");
    
    const jsonStr = response.text?.trim();
    if (!jsonStr) return algoSignal;

    const data = JSON.parse(jsonStr);
    
    // Safety check: Ensure strict return types
    return {
      ...algoSignal,
      action: (['BUY', 'SELL', 'HOLD'].includes(data.action) ? data.action : TradeAction.HOLD) as TradeAction,
      confidence: data.confidence || 0,
      reasoning: `AI: ${data.reasoning}`,
      tp: data.tp || algoSignal.tp,
      sl: data.sl || algoSignal.sl,
      patterns: data.patterns || algoSignal.patterns
    };
  } catch (err) {
    console.error("AI Service Error:", err);
    // If AI fails, fallback to algo signal but mark as AI_ERROR
    return {
        ...algoSignal,
        reasoning: `${algoSignal.reasoning} (AI Unreachable)`
    };
  }
};
