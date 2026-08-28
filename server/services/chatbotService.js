const prisma = require('../config/db');
const ollamaService = require('./ollamaService');
const geminiService = require('./geminiService');
const productIntentService = require('./productIntentService');
const stylistService = require('./stylistService');
const visualSearchService = require('./visualSearchService');
const comparisonService = require('./comparisonService');
const cartOptimizerService = require('./cartOptimizerService');
const personalizedOfferService = require('./personalizedOfferService');

/**
 * Enterprise Intelligent AI Shopping Assistant Service
 */
class ChatbotService {

  _matchesWord(text, word) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  }

  _matchesAny(text, words) {
    return words.some(w => this._matchesWord(text, w));
  }

  isCartBudgetQuery(q) {
    return (
      (q.includes('cart') || q.includes('reduce') || q.includes('reduce my') || q.includes('cut') || q.includes('lower') || q.includes('expensive')) &&
      (q.includes('budget') || q.includes('expensive') || q.includes('over') || /\b(under|below|less than|only have|have|max|limit|₹|\d+)\b/i.test(q))
    ) || /reduce my cart|keep my cart|cart is too expensive|cart budget|reduce cart|help me reduce/i.test(q)
      || /i only have\s*(?:₹|rs\.?|inr)?\s*\d+/i.test(q)
      || /my budget\s*(?:is)?\s*(?:₹|rs\.?|inr)?\s*\d+/i.test(q)
      || (/\b(only have|budget|don'?t want to spend|spend more than|can'?t afford|too much)\b/i.test(q) && /(?:₹|rs\.?|inr)?\s*\d{3,}/i.test(q));
  }

  isOfferQuery(q) {
    return this._matchesAny(q, ['offer', 'offers', 'coupon', 'coupons', 'discount', 'discounts', 'deal', 'deals', 'promo', 'promotional', 'best deal', 'best offer', 'apply coupon', 'apply offer']);
  }

  isComparisonQuery(q) {
    return this._matchesAny(q, ['compare', 'vs', 'versus', 'which is best', 'which one is best', 'which is cheapest', 'which has highest rating', 'which is best value', 'which should i buy', 'which one should i buy', 'difference between', 'better choice']);
  }

  isEscalationQuery(q) {
    return this._matchesAny(q, ['human', 'agent', 'person', 'frustrated', 'useless', 'escalate', 'complaint', 'customer care', 'speak to someone', 'real person']);
  }

  isOrderQuery(q) {
    return this._matchesAny(q, ['order', 'track', 'shipped', 'dispatch']) || q.includes('where is my');
  }

  isProductSearchQuery(q) {
    // Match product keywords including plural forms (shirts, shoes, sarees, etc.)
    const productKeywords = ['shirt', 'saree', 'shoe', 'dress', 'gold', 'jean', 'bag', 'watch', 'jacket', 'kurta', 'ring', 'necklace', 'earring', 'bracelet', 'top', 'pant', 'lehenga', 'sandal', 'heel', 'tshirt', 't-shirt', 'trouser', 'sari', 'suit', 'blazer', 'sneaker', 'boot', 'chain', 'pendant'];
    const matchesProduct = productKeywords.some(w => {
      const regex = new RegExp(`\\b${w}s?\\b`, 'i'); // Allow optional plural 's'
      return regex.test(q);
    });
    return matchesProduct ||
           (this._matchesAny(q, ['show', 'recommend', 'find', 'search', 'looking for', 'browse']) && q.length > 8) ||
           (q.includes('under') && /under\s*(?:₹|rs\.?|inr)?\s*\d+/i.test(q));
  }

  /** Simple greetings: hi, hello, hlo, hey — get the welcome message */
  isGreetingQuery(q) {
    return this._matchesAny(q, [
      'hi', 'hello', 'hey', 'greet', 'hii', 'hiii', 'namaste', 'howdy',
      'hlo', 'hllo', 'hloo', 'hola', 'helo', 'heloo', 'hiya', 'greetings',
      'wassup', 'wsup', 'hy', 'hru', 'yo', 'sup', 'gm', 'gn', 'ga', 'ge',
      'slm', 'salam', 'namaskar', 'vanakkam', 'pranam', 'heyya', 'heya', 'holla'
    ]) || /^(h+l+o+|h+e+l+o+|h+i+|h+e+y+)\b/i.test(q);
  }

  /** Conversational greetings: how are you, good morning — get a natural response */
  isConversationalGreeting(q) {
    return /\bhow are you\b/i.test(q) ||
           /\bhow('s| is) it going\b/i.test(q) ||
           /\bwhat'?s up\b/i.test(q) ||
           /\bhow do you do\b/i.test(q) ||
           /^good (morning|afternoon|evening|night)\b/i.test(q) ||
           /^(sup|yo)\b/i.test(q);
  }

  isThankYouQuery(q) {
    return this._matchesAny(q, ['thank', 'thanks', 'thankyou', 'thank you', 'ty', 'appreciated', 'helpful', 'great help']);
  }

  isFarewellQuery(q) {
    return this._matchesAny(q, ['bye', 'goodbye', 'see you', 'cya', 'take care', 'goodnight', 'good night']);
  }

  isAboutBotQuery(q) {
    return q.includes('who are you') || q.includes('what are you') || q.includes('what can you do') ||
           q.includes('your name') || q.includes('are you a bot') || q.includes('are you ai') ||
           q.includes('are you real') || q.includes('are you human');
  }

  isShippingQuery(q) {
    return this._matchesAny(q, ['shipping', 'delivery', 'courier', 'deliver', 'shipped']) ||
           (this._matchesWord(q, 'ship') && !this._matchesWord(q, 'relationship')) ||
           (q.includes('delivery time') || q.includes('how long') || q.includes('when will'));
  }

  isReturnQuery(q) {
    return this._matchesAny(q, ['return', 'refund', 'replace', 'exchange', 'return policy']);
  }

  isPaymentQuery(q) {
    return this._matchesAny(q, ['pay', 'payment', 'upi', 'cod', 'netbanking', 'razorpay', 'gpay', 'phonpe']) ||
           (this._matchesWord(q, 'card') && (q.includes('credit') || q.includes('debit') || q.includes('pay')));
  }

  isCartQuery(q) {
    return this._matchesAny(q, ['cart', 'basket', 'checkout']);
  }

  isWishlistQuery(q) {
    return this._matchesAny(q, ['wishlist', 'saved items', 'favorites']);
  }

  /**
   * Detect if a query is conversational (non-product, non-transactional).
   * Used to provide smart fallbacks when Ollama is unavailable.
   */
  isConversationalQuery(q) {
    return this.isGreetingQuery(q) || this.isConversationalGreeting(q) ||
           this.isThankYouQuery(q) || this.isFarewellQuery(q) ||
           this.isAboutBotQuery(q) ||
           q.length < 10;
  }

  /* ══════════════════════════════════════════════════════════════════
     SMART FALLBACK for when Ollama is unavailable
     Returns contextual responses instead of "I searched our catalog"
  ══════════════════════════════════════════════════════════════════ */
  getSmartFallback(q, query, user) {
    // Conversational greetings ("how are you", "good morning") — natural response
    if (this.isConversationalGreeting(q)) {
      const timeOfDay = new Date().getHours();
      const timeGreeting = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';
      return {
        reply: `😊 I'm doing great, thank you for asking${user ? ', ' + (user.fullName || '') : ''}! ${timeGreeting} and welcome to KVLR Styles! ✨\n\nI'm your AI Shopping Assistant — available 24/7 to help you with:\n• 🔍 Finding luxury products\n• 🚚 Tracking orders\n• 🎟️ Offers & coupons\n• 💳 Payment support\n\nHow can I assist you today?`,
        type: 'AI_RESPONSE',
        aiPowered: true,
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // Simple greetings ("hi", "hello") — welcome message
    if (this.isGreetingQuery(q)) {
      return {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I'm your AI Shopping Assistant — here to help you find luxury fashion, track orders, check offers, and more. How can I assist you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // Thank you
    if (this.isThankYouQuery(q)) {
      return {
        reply: `😊 You're welcome${user ? ', ' + (user.fullName || '') : ''}! I'm glad I could help. Feel free to ask me anything else — I'm here 24/7 to assist you with shopping, orders, returns, and more!`,
        type: 'INFO',
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' }
        ]
      };
    }

    // Farewell
    if (this.isFarewellQuery(q)) {
      return {
        reply: `👋 Goodbye${user ? ', ' + (user.fullName || '') : ''}! Thank you for shopping with KVLR Styles. Have a wonderful day! Feel free to come back anytime — I'm always here to help. 🌟`,
        type: 'INFO',
        actions: [{ label: '🏠 Back to Store', action: 'STORE_HOME' }]
      };
    }

    // About the bot
    if (this.isAboutBotQuery(q)) {
      return {
        reply: `🤖 I'm the **KVLR Styles AI Shopping Assistant**! I'm here to help you with:\n\n• 🔍 Finding luxury products (clothes, jewelry, accessories)\n• 🚚 Tracking your orders in real-time\n• 🔄 Returns & refund information\n• 💳 Payment options & active offers\n• 🎟️ Coupons & discounts\n• 👨‍💻 Connecting you with human support\n\nJust ask me anything!`,
        type: 'INFO',
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // Simple acknowledgment keywords ("ok", "cool", "nice", "thanks", "sure", "got it")
    if (this._matchesAny(q, ['ok', 'okay', 'cool', 'nice', 'sure', 'fine', 'kk', 'great', 'awesome', 'got it', 'yep', 'yeah', 'yes'])) {
      return {
        reply: `Awesome! Let me know whenever you'd like to search for products, check active offers, or track an order. 😊`,
        type: 'INFO',
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' }
        ]
      };
    }

    // Short/simple query fallback — default to welcome greeting
    if (q.length < 10) {
      return {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I'm your AI Shopping Assistant — here to help you find luxury fashion, track orders, check offers, and more. How can I assist you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // For truly unknown queries when Ollama is down — be honest but helpful
    return {
      reply: `I appreciate your question! While I'm best at helping with shopping, orders, and store information, I'd love to assist you. Here's what I can do:\n\n• 🔍 Search our luxury collection\n• 🚚 Track your orders\n• 🔄 Returns & exchanges\n• 💳 Payments & offers\n• 👨‍💻 Connect with human support\n\nCould you try rephrasing your question, or pick an option below?`,
      type: 'INFO',
      actions: [
        { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
        { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
        { label: '👨‍💻 Human Support', action: 'ESCALATE' }
      ]
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     MAIN QUERY PROCESSOR (non-streaming)
  ══════════════════════════════════════════════════════════════════ */

  async processQuery({ query, user, sessionId, history }) {
    const q = query.trim().toLowerCase();

    // 1. Human Support Escalation
    if (this.isEscalationQuery(q)) {
      return await this.escalateToSupport({ user, sessionId, query });
    }

    // 2. Order Tracking & Status
    if (this.isOrderQuery(q)) {
      return await this.handleOrderSupport({ q, user });
    }

    // 2.5 — Phase 9: AI Cart Budget Optimization (must be before isCartQuery)
    if (this.isCartBudgetQuery(q)) {
      return await this._handleCartBudgetQuery({ q, user, query });
    }

    // 2.7 — Greetings (hi, hello, hlo, helo, etc.)
    if (this.isGreetingQuery(q)) {
      return {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I'm your AI Shopping Assistant. How can I help you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // 3. Product Search
    if (this.isProductSearchQuery(q)) {
      return await this.handleProductSearch({ q, user, history: history || [] });
    }

    // 4. Cart & Wishlist
    if (this.isCartQuery(q)) {
      return this.handleCartHelp({ user });
    }
    if (this.isWishlistQuery(q)) {
      return this.handleWishlistHelp({ user });
    }

    // 5. Shipping & Delivery
    if (this.isShippingQuery(q)) {
      return {
        reply: "📦 **Shipping & Delivery Information**:\n• Free Express Shipping on orders above ₹2,999.\n• Standard Delivery: 2-5 business days across India.\n• Cash on Delivery (COD) is available on all eligible postal codes.\n• Real-time SMS & Email tracking links sent upon dispatch.",
        type: 'INFO',
        actions: [{ label: 'Track My Order', action: 'TRACK_ORDER' }, { label: 'Store Policies', action: 'POLICIES' }]
      };
    }

    // 6. Returns & Refunds
    if (this.isReturnQuery(q)) {
      return {
        reply: "🔄 **Returns & Refund Policy**:\n• Easy 7-Day Hassle-Free Returns & Replacements.\n• Pickup arranged right from your doorstep.\n• Refunds processed back to original payment method or wallet within 48 hours of quality verification.",
        type: 'INFO',
        actions: [{ label: 'Return an Item', action: 'RETURN_ITEM' }, { label: 'Contact Support', action: 'ESCALATE' }]
      };
    }

    // 7. Payments & Offers
    if (this.isPaymentQuery(q)) {
      return {
        reply: "💳 **Payment Methods & Active Offers**:\n• We accept UPI, GPay, PhonePe, Credit/Debit Cards, NetBanking & Cash on Delivery.\n• Use code **KVLR10** for extra 10% OFF on luxury collections.\n• Festive offers & flash sales updated daily!",
        type: 'INFO',
        actions: [{ label: 'View Offers & Coupons', action: 'OFFERS' }, { label: 'Find a Product', action: 'SEARCH_PRODUCT' }]
      };
    }

    // 8. Conversational greetings ("how are you", "good morning") — try Ollama, then Gemini, then smart fallback
    if (this.isConversationalGreeting(q)) {
      const aiResult = await ollamaService.chat(query, history || []);
      if (aiResult.success) {
        return {
          reply: aiResult.response,
          type: 'AI_RESPONSE',
          aiPowered: true,
          actions: [
            { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
            { label: '👨‍💻 Human Support', action: 'ESCALATE' }
          ]
        };
      }
      // Ollama unavailable — try Gemini
      if (geminiService.isConfigured()) {
        const geminiResult = await geminiService.chat(query, history || []);
        if (geminiResult.success) {
          return {
            reply: geminiResult.response,
            type: 'AI_RESPONSE',
            aiPowered: true,
            actions: [
              { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
              { label: '👨‍💻 Human Support', action: 'ESCALATE' }
            ]
          };
        }
      }
      // Both unavailable — use smart natural fallback
      return this.getSmartFallback(q, query, user);
    }

    // 9. Simple greetings ("hi", "hello", "hey")
    if (this.isGreetingQuery(q)) {
      return {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I am your AI Shopping Assistant. How can I help you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // 10. Thank you
    if (this.isThankYouQuery(q)) {
      return this.getSmartFallback(q, query, user);
    }

    // 11. Farewell
    if (this.isFarewellQuery(q)) {
      return this.getSmartFallback(q, query, user);
    }

    // 12. About the bot
    if (this.isAboutBotQuery(q)) {
      return this.getSmartFallback(q, query, user);
    }

    // ─── Default: Send to Ollama AI, then Gemini, for intelligent response ───
    const aiResult = await ollamaService.chat(query, history || []);

    if (aiResult.success) {
      return {
        reply: aiResult.response,
        type: 'AI_RESPONSE',
        aiPowered: true,
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      };
    }

    // Ollama unavailable — try Gemini
    if (geminiService.isConfigured()) {
      const geminiResult = await geminiService.chat(query, history || []);
      if (geminiResult.success) {
        return {
          reply: geminiResult.response,
          type: 'AI_RESPONSE',
          aiPowered: true,
          actions: [
            { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
            { label: '👨‍💻 Human Support', action: 'ESCALATE' }
          ]
        };
      }
    }

    // Both AI providers unavailable — use smart fallback
    console.warn('[ChatbotService] All AI providers unavailable, using smart fallback');
    return this.getSmartFallback(q, query, user);
  }

  /* ══════════════════════════════════════════════════════════════════
     STREAMING QUERY PROCESSOR (SSE)
  ══════════════════════════════════════════════════════════════════ */

  async processStreamQuery({ query, user, sessionId, history, onChunk, signal }) {
    const q = query.trim().toLowerCase();

    // All intent handlers return structured data (no streaming needed)
    if (this.isEscalationQuery(q)) {
      return { streamed: false, data: await this.escalateToSupport({ user, sessionId, query }) };
    }
    if (this.isOrderQuery(q)) {
      return { streamed: false, data: await this.handleOrderSupport({ q, user }) };
    }

    // Phase 9: AI Cart Budget Optimization (must be before isCartQuery)
    if (this.isCartBudgetQuery(q)) {
      return { streamed: false, data: await this._handleCartBudgetQuery({ q, user, query }) };
    }

    // Phase 10: AI Personalized Offers (must be before isPaymentQuery)
    if (this.isOfferQuery(q)) {
      return { streamed: false, data: await this._handleOfferQuery({ q, user }) };
    }

    // Greetings (hi, hello, hlo, helo, etc.)
    if (this.isGreetingQuery(q)) {
      return { streamed: false, data: {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I'm your AI Shopping Assistant. How can I help you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      }};
    }

    if (this.isProductSearchQuery(q)) {
      return { streamed: false, data: await this.handleProductSearch({ q, user, history: history || [] }) };
    }
    if (this.isCartQuery(q)) {
      return { streamed: false, data: this.handleCartHelp({ user }) };
    }
    if (this.isWishlistQuery(q)) {
      return { streamed: false, data: this.handleWishlistHelp({ user }) };
    }
    if (this.isShippingQuery(q)) {
      return { streamed: false, data: {
        reply: "📦 **Shipping & Delivery Information**:\n• Free Express Shipping on orders above ₹2,999.\n• Standard Delivery: 2-5 business days across India.\n• Cash on Delivery (COD) is available on all eligible postal codes.\n• Real-time SMS & Email tracking links sent upon dispatch.",
        type: 'INFO',
        actions: [{ label: 'Track My Order', action: 'TRACK_ORDER' }, { label: 'Store Policies', action: 'POLICIES' }]
      }};
    }
    if (this.isReturnQuery(q)) {
      return { streamed: false, data: {
        reply: "🔄 **Returns & Refund Policy**:\n• Easy 7-Day Hassle-Free Returns & Replacements.\n• Pickup arranged right from your doorstep.\n• Refunds processed back to original payment method or wallet within 48 hours of quality verification.",
        type: 'INFO',
        actions: [{ label: 'Return an Item', action: 'RETURN_ITEM' }, { label: 'Contact Support', action: 'ESCALATE' }]
      }};
    }
    if (this.isPaymentQuery(q)) {
      return { streamed: false, data: {
        reply: "💳 **Payment Methods & Active Offers**:\n• We accept UPI, GPay, PhonePe, Credit/Debit Cards, NetBanking & Cash on Delivery.\n• Use code **KVLR10** for extra 10% OFF on luxury collections.\n• Festive offers & flash sales updated daily!",
        type: 'INFO',
        actions: [{ label: 'View Offers & Coupons', action: 'OFFERS' }, { label: 'Find a Product', action: 'SEARCH_PRODUCT' }]
      }};
    }
    // Conversational greetings ("how are you", "good morning") — stream from Ollama, fallback to Gemini
    if (this.isConversationalGreeting(q)) {
      const streamResult = await ollamaService.chatStream(query, history || [], onChunk, signal);
      if (streamResult.success) {
        return { streamed: true, fullResponse: streamResult.fullResponse };
      }
      // Ollama unavailable — try Gemini non-streaming
      if (geminiService.isConfigured()) {
        const geminiResult = await geminiService.chat(query, history || []);
        if (geminiResult.success) {
          return { streamed: false, data: { reply: geminiResult.response, type: 'AI_RESPONSE', aiPowered: true, actions: [{ label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' }, { label: '👨‍💻 Human Support', action: 'ESCALATE' }] } };
        }
      }
      return { streamed: false, data: this.getSmartFallback(q, query, user) };
    }
    if (this.isGreetingQuery(q)) {
      return { streamed: false, data: {
        reply: `👋 Hello${user ? ' ' + (user.fullName || 'there') : ''}! Welcome to KVLR Styles. I am your AI Shopping Assistant. How can I help you today?`,
        type: 'GREETING',
        actions: [
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🔄 Return & Refund', action: 'RETURNS' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' },
          { label: '👨‍💻 Human Support', action: 'ESCALATE' }
        ]
      }};
    }
    if (this.isThankYouQuery(q)) {
      return { streamed: false, data: this.getSmartFallback(q, query, user) };
    }
    if (this.isFarewellQuery(q)) {
      return { streamed: false, data: this.getSmartFallback(q, query, user) };
    }
    if (this.isAboutBotQuery(q)) {
      return { streamed: false, data: this.getSmartFallback(q, query, user) };
    }

    // Free-form query — try Ollama stream, then Gemini, then fallback
    const streamResult = await ollamaService.chatStream(
      query,
      history || [],
      onChunk,
      signal
    );

    if (streamResult.success) {
      return { streamed: true, fullResponse: streamResult.fullResponse };
    }

    // Ollama unavailable — try Gemini non-streaming
    if (geminiService.isConfigured()) {
      const geminiResult = await geminiService.chat(query, history || []);
      if (geminiResult.success) {
        return { streamed: false, data: { reply: geminiResult.response, type: 'AI_RESPONSE', aiPowered: true, actions: [{ label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' }, { label: '👨‍💻 Human Support', action: 'ESCALATE' }] } };
      }
    }

    // All AI providers unavailable — smart fallback
    console.warn('[ChatbotService] All AI providers unavailable in stream mode, using smart fallback');
    return {
      streamed: false,
      data: this.getSmartFallback(q, query, user)
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════════════ */

  async handleOrderSupport({ q, user }) {
    if (!user) {
      return {
        reply: "🔐 Please sign in to securely track your orders and check real-time delivery status.",
        type: 'AUTH_REQUIRED',
        actions: [{ label: 'Sign In Now', action: 'LOGIN' }]
      };
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: { include: { product: { include: { images: true } } } } }
    });

    if (orders.length === 0) {
      return {
        reply: "🛍️ You have not placed any orders yet. Would you like me to help you find some trending luxury products?",
        type: 'INFO',
        actions: [{ label: 'Browse Trending Products', action: 'SEARCH_PRODUCT' }]
      };
    }

    const latestOrder = orders[0];
    const itemNames = latestOrder.items.map(i => i.product?.name || 'Product').join(', ');
    const trackingLink = `/orders/${latestOrder.id}`;

    return {
      reply: `📦 **Your Latest Order (#${latestOrder.orderNo || latestOrder.id.slice(0, 8)})**:\n• Status: **${latestOrder.orderStatus}**\n• Items: ${itemNames}\n• Payment: **${latestOrder.paymentStatus}** (${latestOrder.paymentMethod})\n• Total: ₹${latestOrder.totalAmount}`,
      type: 'ORDER_CARD',
      order: {
        id: latestOrder.id,
        orderNo: latestOrder.orderNo || latestOrder.id.slice(0, 8),
        status: latestOrder.orderStatus,
        total: latestOrder.totalAmount,
        items: latestOrder.items,
        trackingLink
      },
      actions: [{ label: 'View Order Details', action: 'VIEW_ORDER', link: trackingLink }, { label: 'Contact Support', action: 'ESCALATE' }]
    };
  }

  async handleProductSearch({ q, history = [] }) {
    let extractedIntent = null;
    let replyText = null;

    // 1. Try Gemini AI Intent Extraction (with conversation history for context preservation)
    if (geminiService.isConfigured()) {
      try {
        extractedIntent = await geminiService.extractIntent(q, history);
      } catch (gemErr) {
        console.warn('[ChatbotService] Gemini intent extraction fallback:', gemErr.message);
      }
    }

    // ─── PHASE 9: AI Smart Cart & Budget Optimizer Routing ───
    if (this.isCartBudgetQuery(q) || extractedIntent?.intent === 'cart_budget_optimization') {
      const budgetMatch = q.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})/i);
      const maxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : (extractedIntent?.maxPrice || 3500);

      const cartOptRes = await cartOptimizerService.optimizeCart({
        maxBudget,
        userPrompt: q
      });

      if (cartOptRes.success) {
        return {
          reply: `🛒 **AI Smart Cart & Budget Optimizer**:\n${cartOptRes.aiExplanation || cartOptRes.message}`,
          type: 'CART_OPTIMIZER_CARD',
          cartOptimization: cartOptRes,
          aiPowered: true,
          actions: [{ label: 'Open Cart Optimizer', action: 'VIEW_CART', link: '/cart' }]
        };
      }
    }

    // ─── PHASE 10: AI Personalized Offers & Smart Deals Routing ───
    if (this.isOfferQuery(q) || extractedIntent?.intent === 'offers') {
      const offerRes = await personalizedOfferService.getPersonalizedOffers({
        userPrompt: q
      });

      if (offerRes.success) {
        return {
          reply: `🎁 **AI Personalized Offers & Smart Deals**:\n${offerRes.aiExplanation}`,
          type: 'OFFER_CARD',
          offers: offerRes,
          aiPowered: true,
          actions: [{ label: 'Apply Offers in Cart', action: 'VIEW_CART', link: '/cart' }]
        };
      }
    }

    // ─── PHASE 8: Smart AI Product Comparison Routing ───
    const isCompareReq = this.isComparisonQuery(q) || extractedIntent?.intent === 'compare';
    if (isCompareReq) {
      const candidates = await productIntentService.searchProductsByIntent(extractedIntent, q);
      if (candidates.length >= 2) {
        const candidateIds = candidates.slice(0, 4).map(p => p.id);
        const goal = q.includes('cheapest') ? 'cheapest'
          : (q.includes('rating') || q.includes('rated')) ? 'highest_rated'
          : (q.includes('value') || q.includes('worth')) ? 'best_value'
          : 'best_overall';

        const compareResult = await comparisonService.compareProducts({
          productIds: candidateIds,
          criteria: {
            userPrompt: q,
            occasion: extractedIntent?.occasion,
            maxBudget: extractedIntent?.maxPrice,
            goal
          }
        });

        if (compareResult.success) {
          return {
            reply: `⚖️ **AI Product Comparison & Decision Assistant**:\n${compareResult.recommendation.aiExplanation}`,
            type: 'COMPARISON_CARD',
            comparison: {
              products: compareResult.products,
              recommendation: compareResult.recommendation,
              count: compareResult.count
            },
            aiPowered: true,
            actions: [{ label: 'View Full Comparison', action: 'VIEW_COMPARE', link: '/compare' }]
          };
        }
      }
    }

    // ─── Step 2: Comprehensive Occasion Detection ───
    const occasionKeywords = [
      'wedding', 'festive', 'festival', 'party', 'birthday', 'office', 'college',
      'formal', 'casual', 'travel', 'date', 'traditional', 'engagement', 'reception',
      'gift', 'daily', 'bridal', 'puja', 'diwali', 'holi', 'eid', 'christmas',
      'onam', 'pongal', 'navratri', 'rakhi', 'anniversary', 'interview', 'meeting'
    ];

    // ─── Step 10: Detect single product vs outfit ───
    const singleProductTypes = [
      'shirt', 'saree', 'dress', 'kurta', 'jacket', 'shoe', 'jeans', 'trouser',
      'top', 'pant', 'lehenga', 'sandal', 'heel', 'tshirt', 't-shirt', 'blazer',
      'ring', 'necklace', 'earring', 'bracelet', 'chain', 'pendant', 'watch', 'bag'
    ];
    const isSingleProductRequest = singleProductTypes.some(p => {
      const re = new RegExp(`\\b${p}s?\\b`, 'i');
      return re.test(q);
    }) && !this._matchesAny(q, ['outfit', 'look', 'suggest', 'combination', 'complete', 'build', 'style me', 'what to wear', 'what should i wear']);

    // ─── Step 16: Detect occasion + budget for stylist routing ───
    const hasOccasion = occasionKeywords.some(oc => this._matchesWord(q, oc)) ||
                        extractedIntent?.occasion;
    const hasBudget = extractedIntent?.maxPrice || /(?:under|below|within|budget|have|around|maximum)\s*(?:₹|rs\.?|inr)?\s*\d+/i.test(q) || /\d{3,}/.test(q);
    const isOutfitReq = (extractedIntent?.intent === 'outfit_recommendation') ||
                        this._matchesAny(q, ['outfit', 'look', 'suggest', 'combination', 'complete look', 'build', 'style me', 'what to wear', 'what should i wear']);

    // Route to AI Stylist if occasion/budget present (even for single products with occasion)
    if ((hasOccasion || isOutfitReq) && hasBudget) {
      // Extract budget — prefer Gemini intent, fallback to regex
      let budget = extractedIntent?.maxPrice || null;
      if (!budget) {
        const match = q.match(/(\d{3,})/);
        budget = match ? parseFloat(match[1]) : 3000;
      }

      // Step 3: Handle "around ₹2000" — use ±25% range
      if (/around/i.test(q) && budget) {
        budget = Math.ceil(budget * 1.25);
      }

      // Extract occasion — prefer Gemini, fallback to keyword matching
      let occasion = extractedIntent?.occasion || null;
      if (!occasion) {
        for (const oc of occasionKeywords) {
          if (this._matchesWord(q, oc)) { occasion = oc; break; }
        }
      }
      occasion = occasion || 'festive';

      // Step 12: Extract gender
      const gender = extractedIntent?.category ||
                     (this._matchesAny(q, ['men', "men's", 'male', 'gents', 'boy']) ? 'men' :
                      this._matchesAny(q, ['women', "women's", 'female', 'ladies', 'girl']) ? 'women' :
                      this._matchesAny(q, ['kid', 'kids', "children's", 'child', 'boy', 'girl']) ? 'kids' : null);

      // Step 11: Extract color
      const color = extractedIntent?.color || null;

      const outfitData = await stylistService.buildOutfitRecommendations({
        occasion,
        maxBudget: budget,
        category: gender,
        color,
        gender,
        isSingleProduct: isSingleProductRequest
      });

      // Handle outfit looks result
      if (outfitData.type === 'OUTFIT_LOOKS' && outfitData.looks?.length > 0) {
        return {
          reply: `✨ Based on your ₹${budget} budget for a ${occasion}, here are outfit combinations from our collection:`,
          type: 'OUTFIT_LOOKS',
          occasion,
          maxBudget: budget,
          looks: outfitData.looks,
          aiPowered: Boolean(extractedIntent),
          actions: [{ label: 'Browse Full Catalog', action: 'BROWSE_ALL', link: '/categories' }]
        };
      }

      // Handle single products result
      if (outfitData.type === 'SINGLE_PRODUCTS' && outfitData.products?.length > 0) {
        const note = outfitData.note || '';
        const suggestion = outfitData.suggestion || '';
        replyText = note
          ? `${note}${suggestion ? '\n\n' + suggestion : ''}`
          : `✨ Here are ${occasion} options within ₹${budget}:`;
        return {
          reply: replyText,
          type: 'PRODUCT_CARDS',
          products: outfitData.products,
          aiPowered: Boolean(extractedIntent),
          actions: [{ label: 'Browse Full Catalog', action: 'BROWSE_ALL', link: '/categories' }]
        };
      }

      // Step 18: No results — suggest increasing budget
      if (outfitData.type === 'NO_RESULTS') {
        return {
          reply: `${outfitData.note}\n\n${outfitData.suggestion || ''}`,
          type: 'INFO',
          aiPowered: Boolean(extractedIntent),
          actions: [{ label: 'Browse Full Catalog', action: 'BROWSE_ALL', link: '/categories' }]
        };
      }
    }

    // 3. Perform Real Database Query via ProductIntentService (non-outfit requests)
    const products = await productIntentService.searchProductsByIntent(extractedIntent, q);

    // 4. Smart reply based on what was found
    if (products.length > 0) {
      // Check if any product actually matches budget
      const budgetMatch = q.match(/(?:under|below|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
      const requestedBudget = budgetMatch ? parseFloat(budgetMatch[1]) : (extractedIntent?.maxPrice || null);

      if (requestedBudget) {
        const withinBudget = products.some(p => {
          const effectivePrice = (p.discountPrice && p.discountPrice > 0) ? p.discountPrice : p.price;
          return effectivePrice <= requestedBudget;
        });
        if (withinBudget) {
          replyText = `✨ Here are items under ₹${requestedBudget} from our collection:`;
        } else {
          replyText = `We don't have exact matches under ₹${requestedBudget}, but here are our most affordable similar options:`;
        }
      } else {
        replyText = `✨ Here are matching items from our collection:`;
      }
    } else {
      replyText = `I couldn't find products matching your request. Here are some suggestions — try browsing our full catalog!`;
    }

    return {
      reply: replyText,
      type: 'PRODUCT_CARDS',
      products,
      aiPowered: Boolean(extractedIntent),
      actions: [{ label: 'Browse Full Catalog', action: 'BROWSE_ALL', link: '/categories' }]
    };
  }

  handleCartHelp({ user }) {
    return {
      reply: "🛒 Your cart allows you to manage items, apply promo codes, and proceed to instant checkout. Click below to view your cart items.",
      type: 'INFO',
      actions: [{ label: 'View My Cart', action: 'VIEW_CART', link: '/cart' }]
    };
  }

  handleWishlistHelp({ user }) {
    return {
      reply: "❤️ Your wishlist keeps track of all your saved luxury items. Click below to explore your saved favorites.",
      type: 'INFO',
      actions: [{ label: 'View My Wishlist', action: 'VIEW_WISHLIST', link: '/wishlist' }]
    };
  }

  async escalateToSupport({ user, sessionId, query }) {
    // Generate unique Ticket No
    const ticketCount = await prisma.supportTicket.count();
    const ticketNo = `TICK-${Date.now().toString().slice(-5)}`;

    let ticket = null;
    if (user) {
      ticket = await prisma.supportTicket.create({
        data: {
          ticketNo,
          userId: user.id,
          subject: `Chatbot Escalation: ${query.slice(0, 40)}...`,
          category: 'Chatbot AI Escalation',
          priority: 'HIGH',
          status: 'OPEN',
          messages: {
            create: {
              senderRole: 'CUSTOMER',
              senderName: user.fullName || 'Customer',
              message: `Escalated Query: ${query}`
            }
          }
        }
      });
    }

    return {
      reply: `👨‍💻 **Support Ticket Created (#${ticketNo})**:\nOur customer support specialist has been notified and will contact you via email shortly. Your ticket reference is **${ticketNo}**.`,
      type: 'ESCALATION',
      ticketNo,
      actions: [{ label: 'Back to Store', action: 'STORE_HOME' }]
    };
  }

  /**
   * Phase 9 — AI Cart Budget Optimizer handler (routed from processQuery)
   */
  async _handleCartBudgetQuery({ q, user, query }) {
    try {
      const budgetMatch = q.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})/i);
      const maxBudget = budgetMatch ? parseFloat(budgetMatch[1]) : 3500;

      const cartOptRes = await cartOptimizerService.optimizeCart({
        userId: user?.id || null,
        maxBudget,
        userPrompt: q
      });

      if (cartOptRes.success) {
        return {
          reply: `🛒 **AI Smart Cart & Budget Optimizer**:\n${cartOptRes.aiExplanation || cartOptRes.message}`,
          type: 'CART_OPTIMIZER_CARD',
          cartOptimization: cartOptRes,
          aiPowered: true,
          actions: [{ label: 'Open Cart Optimizer', action: 'VIEW_CART', link: '/cart' }]
        };
      }
      return {
        reply: cartOptRes.error || 'Could not optimize your cart right now. Please try from the Cart page.',
        type: 'INFO',
        actions: [{ label: '🛒 Go to Cart', action: 'VIEW_CART', link: '/cart' }]
      };
    } catch (err) {
      console.error('[ChatbotService] Cart budget handler error:', err.message);
      return {
        reply: 'Sorry, I encountered an error while analyzing your cart budget. Please try the Budget Optimizer on the Cart page.',
        type: 'INFO',
        actions: [{ label: '🛒 Go to Cart', action: 'VIEW_CART', link: '/cart' }]
      };
    }
  }

  /**
   * Phase 10 — AI Personalized Offers handler (routed from processQuery)
   */
  async _handleOfferQuery({ q, user }) {
    try {
      // Get cart total for eligibility checks
      let cartTotal = 0;
      if (user?.id) {
        const cart = await prisma.cart.findUnique({
          where: { userId: user.id },
          include: { items: { include: { product: { select: { price: true, discountPrice: true } } } } }
        });
        if (cart?.items) {
          cartTotal = cart.items.reduce((sum, ci) => {
            const p = ci.product;
            if (!p) return sum;
            const fp = (p.discountPrice && p.discountPrice > 0) ? p.discountPrice : p.price;
            return sum + fp * (ci.quantity || 1);
          }, 0);
        }
      }

      const offerRes = await personalizedOfferService.getPersonalizedOffers({
        userId: user?.id || null,
        cartTotal,
        userPrompt: q
      });

      if (offerRes.success) {
        return {
          reply: `🎁 **AI Personalized Offers & Smart Deals**:\n${offerRes.aiExplanation || offerRes.message}`,
          type: 'OFFER_CARD',
          offers: offerRes,
          aiPowered: true,
          actions: [{ label: 'View Cart & Apply', action: 'VIEW_CART', link: '/cart' }]
        };
      }
      return {
        reply: 'There are no additional offers currently available for this purchase.',
        type: 'INFO',
        actions: [{ label: '🔍 Browse Products', action: 'SEARCH_PRODUCT' }]
      };
    } catch (err) {
      console.error('[ChatbotService] Offer handler error:', err.message);
      return {
        reply: 'Sorry, I had trouble finding offers right now. Please check the Cart page for available offers.',
        type: 'INFO',
        actions: [{ label: '🛒 Go to Cart', action: 'VIEW_CART', link: '/cart' }]
      };
    }
  }

  /**
   * Get AI status for admin panel — includes both Ollama and Gemini status.
   */
  async getAIStatus() {
    const ollamaAvailable = await ollamaService.isAvailable();
    return {
      ...ollamaService.getStatus(),
      ollamaAvailable,
      gemini: geminiService.getStatus(),
      available: ollamaAvailable || geminiService.isConfigured(),
    };
  }
}

module.exports = new ChatbotService();
