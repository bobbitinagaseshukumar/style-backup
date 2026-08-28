const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');

// Rate limiting state
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // max 20 AI requests per minute per session
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout for Gemini calls

class GeminiService {
  constructor() {
    this.apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.client = null;
    this.model = 'gemini-2.5-flash';
    this.fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
        console.log('[GeminiService] ✅ Initialized with API key');
      } catch (err) {
        console.error('[GeminiService] ❌ Failed to initialize:', err.message);
      }
    } else {
      console.warn('[GeminiService] ⚠️ No GEMINI_API_KEY found — AI features disabled');
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.client);
  }

  /**
   * Simple per-session rate limiter.
   * Returns true if the request should be allowed.
   */
  checkRateLimit(sessionId = 'global') {
    const now = Date.now();
    const key = `gemini_${sessionId}`;

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, []);
    }

    const timestamps = rateLimitMap.get(key).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    rateLimitMap.set(key, timestamps);

    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      return false; // Rate limited
    }

    timestamps.push(now);
    return true;
  }

  /**
   * Sanitize user message to prevent prompt injection.
   * Strips dangerous patterns while keeping the shopping request intact.
   */
  sanitizeUserMessage(message) {
    if (!message || typeof message !== 'string') return '';
    let clean = message.trim().slice(0, 1000); // Hard limit 1000 chars
    clean = clean.replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '');
    clean = clean.replace(/you\s+are\s+now\s+/gi, '');
    clean = clean.replace(/system\s*prompt/gi, '');
    clean = clean.replace(/\bDAN\b/g, '');
    return clean;
  }

  /**
   * Internal generator with automatic model fallback and enforced timeout
   */
  async generateWithFallback(contents, config = {}) {
    const modelsToTry = [this.model, ...this.fallbackModels.filter(m => m !== this.model)];
    for (const modelName of modelsToTry) {
      try {
        // Use Promise.race for guaranteed timeout enforcement
        const apiCall = this.client.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
        );

        const response = await Promise.race([apiCall, timeoutPromise]);
        const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return { text, modelUsed: modelName };
        }
      } catch (err) {
        console.warn(`[GeminiService] Model ${modelName} failed:`, err.message);
      }
    }
    return null;
  }

  /**
   * Extract customer search intent into structured JSON filter object.
   */
  async extractIntent(userMessage, conversationHistory = [], sessionId = 'global') {
    if (!this.isConfigured()) {
      return null;
    }

    if (!this.checkRateLimit(sessionId)) {
      console.warn('[GeminiService] Rate limited for session:', sessionId);
      return null;
    }

    const cleanMessage = this.sanitizeUserMessage(userMessage);
    if (!cleanMessage) return null;

    const historyContext = conversationHistory
      .slice(-6)
      .map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const prompt = `Convert this customer shopping request into a clean JSON filter object.
${historyContext ? `Previous Conversation:\n${historyContext}\n\n` : ''}Customer Request: "${cleanMessage}"

IMPORTANT: If the customer references a previous conversation (e.g. "make it under ₹2000", "only black", "give me something cheaper"), combine the new request with the previous context.

Return ONLY valid JSON matching this format:
{
  "intent": "product_search",
  "category": "men",
  "subcategory": "shirts",
  "keywords": ["black", "shirts"],
  "color": "black",
  "minPrice": null,
  "maxPrice": 1500,
  "occasion": null,
  "gender": null,
  "sort": "relevance"
}

For outfit/styling requests like "suggest an outfit for a wedding under ₹3000", use intent "outfit_recommendation".
For occasion values use: wedding, party, festival, office, college, casual, formal, travel, birthday, date, traditional, engagement, gift, daily, bridal, interview.
For gender values use: men, women, kids.`;

    try {
      const contents = [{ role: 'user', parts: [{ text: prompt }] }];
      const res = await this.generateWithFallback(contents, {
        temperature: 0.1,
        maxOutputTokens: 1000,
      });

      if (!res?.text) return null;

      const startIdx = res.text.indexOf('{');
      const endIdx = res.text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const cleanJson = res.text.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(cleanJson);
        console.log(`[GeminiService] ✅ Intent extracted via ${res.modelUsed}:`, JSON.stringify(parsed));
        return parsed;
      }
      return null;
    } catch (err) {
      console.warn('[GeminiService] Intent extraction failed:', err.message);
      return null;
    }
  }

  /**
   * Generate a warm, natural conversational summary of retrieved real products.
   */
  async summarizeProducts(query, products, sessionId = 'global') {
    if (!this.isConfigured() || !products || products.length === 0) {
      return null;
    }

    if (!this.checkRateLimit(sessionId)) {
      return null;
    }

    try {
      const productList = products.slice(0, 6).map(p => {
        const price = p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price;
        return `- ${p.name}: ₹${price} (${p.category?.name || 'Fashion'})`;
      }).join('\n');

      const prompt = `You are Styleverse AI, a premium Indian luxury fashion shopping assistant.

The customer asked: "${this.sanitizeUserMessage(query)}"

We found these REAL products in our store database:
${productList}

Write a short, warm, helpful response (1-2 sentences max, under 40 words) introducing these items.
RULES: Do NOT mention any item or price not listed above. Keep it concise.`;

      const res = await this.generateWithFallback([{ role: 'user', parts: [{ text: prompt }] }], {
        temperature: 0.4,
        maxOutputTokens: 300,
      });

      return res?.text ? res.text.trim() : null;
    } catch (err) {
      console.warn('[GeminiService] Product summary failed:', err.message);
      return null;
    }
  }

  /**
   * Handle general conversational queries using Gemini.
   */
  async chat(query, history = [], sessionId = 'global') {
    if (!this.isConfigured()) {
      return { success: false, error: 'Gemini not configured' };
    }

    if (!this.checkRateLimit(sessionId)) {
      return { success: false, error: 'Rate limited' };
    }

    const cleanQuery = this.sanitizeUserMessage(query);
    if (!cleanQuery) {
      return { success: false, error: 'Empty query' };
    }

    try {
      const historyContext = history
        .slice(-6)
        .map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
        .join('\n');

      const prompt = `You are KVLR Styles AI Shopping Assistant — a helpful, warm, and knowledgeable Indian luxury fashion e-commerce assistant.
Be warm, concise, and professional — respond in 2-3 sentences. Keep responses under 150 words.

${historyContext ? `Previous Conversation:\n${historyContext}\n\n` : ''}Customer: "${cleanQuery}"
Assistant:`;

      const res = await this.generateWithFallback([{ role: 'user', parts: [{ text: prompt }] }], {
        temperature: 0.6,
        maxOutputTokens: 500,
      });

      if (!res?.text) {
        return { success: false, error: 'Empty response' };
      }

      return { success: true, response: res.text.trim() };
    } catch (err) {
      console.warn('[GeminiService] Chat failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get AI service status info for admin dashboard.
   */
  getStatus() {
    return {
      provider: 'Google Gemini',
      model: this.model,
      configured: this.isConfigured(),
      apiKeyPresent: Boolean(this.apiKey),
    };
  }
}

module.exports = new GeminiService();
