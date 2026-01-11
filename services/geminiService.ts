import { GoogleGenAI, Type } from "@google/genai";
import { Candle, TradeSignal, TradeAction } from "../types";

// Initialize the Google GenAI SDK.
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeWithAi = async (candles: Candle[], algoSignal: TradeSignal): Promise<TradeSignal> => {
  const recent = candles.slice(-20).map(c => `H:${c.high} L:${c.low} C:${c.close}`).join('|');
  
  const prompt = `
    Context: BTC/USDT Trading.
    Algo Strategy Signal: ${algoSignal.action}
    Confidence: ${algoSignal.confidence}%
    Reason: ${algoSignal.reasoning}
    
    Data (Last 20 candles): ${recent}
    
    Task: Validate the trade. If signal is weak, change to HOLD.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"], description: "Action to take" },
            confidence: { type: Type.NUMBER, description: "Confidence level between 0 and 100" },
            reasoning: { type: Type.STRING, description: "Reasoning for the decision" },
            tp: { type: Type.NUMBER, description: "Take profit level" },
            sl: { type: Type.NUMBER, description: "Stop loss level" },
            patterns: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Detected chart patterns"
            }
          },
          required: ["action", "confidence", "reasoning"]
        }
      }
    });
    
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