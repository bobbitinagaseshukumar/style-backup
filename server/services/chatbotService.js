const prisma = require('../config/db');
const ollamaService = require('./ollamaService');
const geminiService = require('./geminiService');
const productIntentService = require('./productIntentService');
const stylistService = require('./stylistService');
const visualSearchService = require('./visualSearchService');

/**
 * Enterprise Intelligent AI Shopping Assistant Service
 * Natural language intent parser, live product database search, order status checker,
 * policy engine, and human support escalation with ticket generation.
 * 
 * When Ollama is available: free-form queries get true AI responses.
 * When Ollama is unavailable (production/Render): intelligent local fallbacks handle
 * conversational queries, greetings, thanks, and common questions without showing
 * the misleading "I searched our catalog" message for non-product queries.
 */
class ChatbotService {

  /* ══════════════════════════════════════════════════════════════════
     WORD-BOUNDARY MATCH HELPERS
     Prevents false positives like "this" matching "hi", "history" matching "hi",
     "undertime" matching "time", etc.
  ══════════════════════════════════════════════════════════════════ */
  _matchesWord(text, word) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  }

  _matchesAny(text, words) {
    return words.some(w => this._matchesWord(text, w));
  }

  /* ══════════════════════════════════════════════════════════════════
     INTENT DETECTORS (improved with word-boundary matching)
  ══════════════════════════════════════════════════════════════════ */

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

  /** Simple greetings: hi, hello, hey — get the welcome message */
  isGreetingQuery(q) {
    return this._matchesAny(q, ['hi', 'hello', 'hey', 'greet', 'hii', 'hiii', 'namaste', 'howdy']);
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
    return this._matchesAny(q, ['pay', 'payment', 'upi', 'cod', 'coupon', 'offer', 'discount', 'promo']) ||
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

    // Short/simple queries like "ok", "cool", "nice", "hmm"
    if (q.length < 10) {
      return {
        reply: `Got it! Is there anything else I can help you with? I can help you find products, track orders, check offers, or connect you with our support team. 😊`,
        type: 'INFO',
        actions: [
          { label: '🔍 Find a Product', action: 'SEARCH_PRODUCT' },
          { label: '🚚 Track My Order', action: 'TRACK_ORDER' },
          { label: '🎟️ Offers & Coupons', action: 'OFFERS' }
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

    // 3. Product Search
    if (this.isProductSearchQuery(q)) {
      return await this.handleProductSearch({ q, history: history || [] });
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
    if (this.isProductSearchQuery(q)) {
      return { streamed: false, data: await this.handleProductSearch({ q, history: history || [] }) };
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

    // 4. Generate Natural Conversational Reply with Gemini or Fallback
    if (products.length > 0) {
      if (geminiService.isConfigured()) {
        replyText = await geminiService.summarizeProducts(q, products);
      }
      if (!replyText) {
        replyText = `✨ Here are matching luxury items from our collection:`;
      }
    } else {
      replyText = `I couldn't find an exact match in our current collection. Try a different keyword, color, or category!`;
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
