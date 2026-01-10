import { GoogleGenAI, Type } from "@google/genai";
import { Candle, TradeSignal, TradeAction } from "../types";

export const analyzeWithAi = async (apiKey: string, candles: Candle[], algoSignal: TradeSignal): Promise<TradeSignal> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
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
    const response = await ai.models.generateContent({
      model,
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

    const data = JSON.parse(response.text);
    return {
      ...algoSignal,
      action: data.action as TradeAction,
      confidence: data.confidence,
      reasoning: `AI: ${data.reasoning}`,
      tp: data.tp || algoSignal.tp,
      sl: data.sl || algoSignal.sl,
      patterns: data.patterns || algoSignal.patterns
    };
  } catch (err) {
    console.error("Gemini Error:", err);
    return algoSignal; // Fallback to algo
  }
};