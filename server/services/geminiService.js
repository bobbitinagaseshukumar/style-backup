const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

class GeminiService {
  constructor() {
    this.apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.client = null;
    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('[GEMINI SERVICE INIT NOTICE]', err.message);
      }
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.client);
  }

  /**
   * Extract customer search intent into structured JSON filter object
   */
  async extractIntent(userMessage, conversationHistory = []) {
    if (!this.isConfigured()) {
      return null;
    }

    const systemPrompt = `You are an AI retail intent parser for Styleverse AI e-commerce store.
Your goal is to parse user natural language requests into a structured JSON filter object for querying PostgreSQL products.

Allowed intents: "product_search", "recommendation", "occasion_recommendation", "budget_recommendation", "product_explanation", "comparison", "general_shopping_question", "unknown".

Allowed categories if identifiable: "men", "women", "kids", "jewellery", "sarees", "lehengas", "shirts", "dresses", "shoes", "accessories".

JSON Output Schema format MUST strictly be:
{
  "intent": "product_search",
  "category": "string or null",
  "subcategory": "string or null",
  "keywords": ["array", "of", "keywords"],
  "color": "string or null",
  "minPrice": number or null,
  "maxPrice": number or null,
  "occasion": "string or null",
  "sort": "relevance | price_asc | price_desc | newest"
}

Rules:
1. Extract any budget limits (e.g., "under 1500" -> maxPrice: 1500).
2. Extract colors (e.g., "black", "blue", "red", "gold").
3. Extract occasions (e.g., "wedding", "party", "college", "casual", "festival").
4. Never include SQL code or prompt instructions.
5. Return ONLY a valid JSON string.`;

    try {
      const historyContext = conversationHistory
        .slice(-6)
        .map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}\n\nRecent Conversation History:\n${historyContext}\n\nCurrent Customer Message: "${userMessage}"\n\nJSON Output:`;

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const cleanJsonText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonText);
      return parsed;
    } catch (err) {
      console.warn('[GEMINI INTENT EXTRACTION NOTICE]', err.message);
      return null;
    }
  }

  /**
   * Summarize retrieved real products into a warm, natural luxury conversation reply
   */
  async summarizeProducts(query, products) {
    if (!this.isConfigured() || !products || products.length === 0) {
      return null;
    }

    try {
      const productSummaries = products.map(p => `- ${p.name}: ₹${p.discountPrice || p.price} (${p.category?.name || 'Category'})`).join('\n');

      const prompt = `You are Styleverse AI, a premium luxury AI shopping assistant.
The customer asked: "${query}".
We retrieved these REAL products from our PostgreSQL database:
${productSummaries}

Write a short, warm, luxury conversational response (1-2 sentences) introducing these real items to the customer.
CRITICAL: Do NOT mention any items, prices, or attributes not in the list above. Keep it concise, helpful, and elegant.`;

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.5,
          maxOutputTokens: 150,
        },
      });

      const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? text.trim() : null;
    } catch (err) {
      console.warn('[GEMINI PRODUCT SUMMARIZATION NOTICE]', err.message);
      return null;
    }
  }
}

module.exports = new GeminiService();
