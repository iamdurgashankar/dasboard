
import { GoogleGenAI } from "@google/genai";

export const askTechnicalQuestion = async (prompt: string, history: any[] = []) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: `You are DevInquire AI, a senior technical lead assistant. 
        Your goal is to help developers analyze project metrics, debug code, and understand system architecture. 
        Be professional and technical. Use markdown for code blocks. Provide actionable insights.`,
        tools: [{ googleSearch: {} }]
      }
    });

    const response = await chat.sendMessage({ message: prompt });
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Resource',
        uri: chunk.web?.uri || '#'
      })) || []
    };
  } catch (error) {
    console.error("Gemini Inquiry Error:", error);
    return { text: "I encountered an error processing your inquiry.", sources: [] };
  }
};

export const generateMetricsSummary = async (metricsData: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze these developer metrics and provide a 2-sentence summary and 3 bullet points of insights: ${JSON.stringify(metricsData)}`,
    });
    return response.text;
  } catch (error) {
    return "Unable to generate AI summary at this moment.";
  }
};

export const generateBlogPostDraft = async (topic: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Write a high-quality technical blog post draft. Topic: ${topic}. 
      Include Title, Excerpt, and Markdown Content. Format with TITLE, EXCERPT, and CONTENT sections.`,
    });
    return response.text;
  } catch (error) {
    return "Failed to generate blog draft.";
  }
};
