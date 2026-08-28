import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMessageSquare, FiX, FiSend, FiShoppingBag, FiTruck,
  FiRefreshCw, FiZap, FiTrash2, FiDownload, FiUser, FiCpu,
  FiCheckCircle, FiHeart, FiTag, FiStar, FiCamera,
  FiMic, FiMicOff, FiVolume2, FiVolumeX, FiLayers, FiGlobe
} from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../redux/cart/cartSlice';
import api from '../../config/api';
import { toast } from 'react-toastify';

import { formatCurrency } from '../../utils/formatCurrency';
import { formatImageUrl } from '../../utils/formatImageUrl';

const QUICK_ACTIONS = [
  { label: '📷 Find Similar Products', action: 'VISUAL_SEARCH' },
  { label: '👑 Wedding outfit under ₹3000', query: 'I have ₹3000 and I am going to a wedding. Suggest an outfit.' },
  { label: '✨ Shirts under ₹1500', query: 'Find shirts under ₹1500' },
  { label: '👕 Casual wear', query: 'Show casual wear' },
  { label: '🎁 Under ₹2000', query: 'Find something under ₹2000' },
  { label: '🔥 What\'s trending?', query: 'Show trending luxury products' },
  { label: '🚚 Track Order', query: 'Where is my order?' },
  { label: '🔄 Returns', query: 'What is your return policy?' },
];

/**
 * AI Shopping Assistant Chatbot Widget
 * Powered by Ollama AI with streaming responses.
 * Controlled dynamically by Admin Chatbot Settings in Admin Dashboard!
 */
const ChatbotWidget = () => {
  const [settings, setSettings] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [unread, setUnread] = useState(1);
  const [conversationHistory, setConversationHistory] = useState([]);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);

  // Phase 7 — Voice Shopping & Speech Synthesis States
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN');
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const recognitionRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  /**
   * Phase 7: Voice Recognition Handler using Browser Speech Recognition
   */
  const handleVoiceClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Step 3: Browser compatibility check
    if (!SpeechRecognition) {
      toast.info("Voice shopping isn't supported in this browser. Please type your request instead.");
      return;
    }

    if (isListening) {
      // Step 15: Stop button
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      // Step 5: Request permission on explicit user tap
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = voiceLang;

      // Step 14: Clear states
      setIsListening(true);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        // Step 6: Recognized text appears inside input box
        if (transcript) {
          setInputValue(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[VoiceRecognition] Error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          toast.error('Microphone permission was denied. You can type your request instead.');
        } else if (event.error === 'no-speech') {
          toast.info("I couldn't understand that. Please try again or type your request.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('[VoiceRecognition] Failed to start:', err);
      setIsListening(false);
      toast.error('Could not access microphone.');
    }
  };

  /**
   * Phase 7 Step 26: Optional Text-to-Speech (read response aloud)
   */
  const toggleSpeech = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      toast.info('Text-to-speech is not supported in your browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = voiceLang;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/chatbot-setting/settings');
        const s = res.data?.data;
        setSettings(s);
        if (s?.welcomeMessage) {
          setMessages([
            {
              id: 'init-1',
              sender: 'BOT',
              text: s.welcomeMessage,
              type: 'GREETING',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } catch (err) {}
    };
    fetchSettings();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // Hide if disabled by Admin or hidden on current device view or checkout
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  if (settings) {
    if (settings.isEnabled === false) return null;
    if (isMobileView && settings.showOnMobile === false) return null;
    if (!isMobileView && settings.showOnDesktop === false) return null;
  }
  if (settings?.hideOnCheckout && location.pathname.startsWith('/checkout')) return null;

  /**
   * Send message with streaming SSE support.
   * Falls back to regular POST if streaming fails.
   */
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text || !text.trim() || isStreaming) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setIsStreaming(true);

    // Track conversation history for Ollama context
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: text.trim() }
    ].slice(-10); // Keep last 10 messages

    try {
      // Try streaming endpoint first
      const streamSuccess = await handleStreamRequest(text.trim(), updatedHistory);

      if (!streamSuccess) {
        // Fallback to regular non-streaming endpoint
        await handleRegularRequest(text.trim());
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'BOT',
          text: 'I apologize, I am temporarily reconnecting. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Handle streaming SSE request to /chatbot/stream
   */
  const handleStreamRequest = async (text, history) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build the full URL using the same base as the api instance
      const baseURL = api.defaults.baseURL || '/api/v1';
      const token = localStorage.getItem('token');

      const response = await fetch(`${baseURL}/chatbot/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return false;
      }

      setIsTyping(false); // Stop "thinking" indicator, start showing text

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamingMsgId = `bot-stream-${Date.now()}`;
      let fullText = '';
      let isAiPowered = false;
      let structuredData = null;

      // Add an empty bot message that we'll fill progressively
      setMessages((prev) => [
        ...prev,
        {
          id: streamingMsgId,
          sender: 'BOT',
          text: '',
          isStreaming: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6); // Remove "data: " prefix

          if (data === '[DONE]') {
            // Stream complete
            break;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'chunk') {
              // Progressive text from AI
              fullText += parsed.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId
                    ? { ...m, text: fullText }
                    : m
                )
              );
            } else if (parsed.type === 'done') {
              // AI stream finished — update message metadata
              isAiPowered = true;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId
                    ? { ...m, isStreaming: false, aiPowered: true, data: { actions: parsed.actions } }
                    : m
                )
              );
            } else if (parsed.type === 'structured') {
              // Intent-matched response — replace the streaming placeholder
              structuredData = parsed.data;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId
                    ? {
                        ...m,
                        text: structuredData.reply || '',
                        data: structuredData,
                        isStreaming: false,
                      }
                    : m
                )
              );
            } else if (parsed.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId
                    ? { ...m, text: parsed.message, isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Finalize the message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgId
            ? { ...m, isStreaming: false }
            : m
        )
      );

      // Update conversation history with the AI response
      if (fullText || structuredData?.reply) {
        setConversationHistory([
          ...history,
          { role: 'assistant', content: fullText || structuredData?.reply || '' }
        ].slice(-10));
      }

      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        return true; // User cancelled — not an error
      }
      console.warn('[ChatbotWidget] Streaming failed, falling back:', err.message);
      // Remove the placeholder streaming message
      setMessages((prev) => prev.filter((m) => !m.isStreaming));
      return false;
    }
  };

  /**
   * Fallback: Regular non-streaming POST to /chatbot/message
   */
  const handleRegularRequest = async (text) => {
    const res = await api.post('/chatbot/message', { message: text });
    const botData = res.data?.data || {};

    const botMsg = {
      id: `bot-${Date.now()}`,
      sender: 'BOT',
      text: botData.reply || 'I found some matching details for you.',
      data: botData,
      aiPowered: botData.aiPowered || false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, botMsg]);

    // Update conversation history
    setConversationHistory((prev) => [
      ...prev,
      { role: 'assistant', content: botData.reply || '' }
    ].slice(-10));
  };

  /**
   * Handle visual search image upload — validates, converts to base64, calls API, shows detected attributes + results
   */
  const handleVisualSearchUpload = async (file) => {
    // Step 3: Image validation — file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    // Step 3: Image validation — file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    // Show user message with image preview
    const imageUrl = URL.createObjectURL(file);
    const userMsg = {
      id: `user-vs-${Date.now()}`,
      sender: 'USER',
      text: '📷 Find similar products',
      imageUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);

    // Step 12: Processing UI — show "Analyzing your style..."
    const analyzingMsgId = `bot-vs-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: analyzingMsgId,
      sender: 'BOT',
      text: '🔍 Analyzing your style...',
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setVisualSearchLoading(true);
    setIsStreaming(true);

    try {
      // Convert image to base64
      const base64Promise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const dataUrl = await base64Promise;
      const base64Data = dataUrl.split(',')[1];

      // Step 12: Update loading state
      setMessages(prev => prev.map(m =>
        m.id === analyzingMsgId ? { ...m, text: '✨ Finding similar products in our collection...' } : m
      ));

      // Call visual search API
      const res = await api.post('/ai/visual-search', {
        imageBase64: base64Data,
        mimeType: file.type,
      });

      const result = res.data?.data;

      if (result?.success && result?.products?.length > 0) {
        // Step 14: Build detected attributes display
        const detected = result.detected || {};
        const attrTags = [
          detected.productType,
          detected.color,
          detected.pattern,
          detected.style,
          detected.category
        ].filter(Boolean);

        const detectedText = attrTags.length > 0
          ? `\n\n🏷️ Detected: ${attrTags.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(' • ')}`
          : '';

        setMessages(prev => prev.map(m =>
          m.id === analyzingMsgId ? {
            ...m,
            text: `📸 Found ${result.products.length} similar products from our collection!${detectedText}`,
            isStreaming: false,
            data: { products: result.products, detected: result.detected },
            aiPowered: true,
          } : m
        ));
      } else {
        // Step 10: No match — honest message, no fabrication
        setMessages(prev => prev.map(m =>
          m.id === analyzingMsgId ? {
            ...m,
            text: "I couldn't find a close match in our current collection. Try another image or browse our catalog!",
            isStreaming: false,
            actions: [{ label: 'Browse Catalog', action: 'BROWSE_ALL', link: '/categories' }],
          } : m
        ));
      }
    } catch (err) {
      console.error('[VisualSearch] Error:', err);
      // Step 26: Error handling — friendly message, no technical details
      setMessages(prev => prev.map(m =>
        m.id === analyzingMsgId ? {
          ...m,
          text: 'Visual search is temporarily unavailable. You can continue browsing normally.',
          isStreaming: false,
        } : m
      ));
    } finally {
      setVisualSearchLoading(false);
      setIsStreaming(false);
      // Reset file input so same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const posClass = settings?.position === 'bottom-left'
    ? 'bottom-20 left-4 sm:bottom-6 sm:left-6'
    : 'bottom-20 right-4 sm:bottom-6 sm:right-6';

  return (
    <>
      {/* TRIGGER BUTTON */}
      <div className={`fixed ${posClass} z-50`}>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full bg-charcoal-900 border-2 border-gold-500 text-gold-400 shadow-[0_8px_30px_rgba(212,175,55,0.4)] flex items-center justify-center cursor-pointer group backdrop-blur-md"
          aria-label="Open AI Shopping Assistant"
        >
          {isOpen ? (
            <FiX className="w-6 h-6 text-white" />
          ) : (
            <div className="relative">
              <FiCpu className="w-7 h-7 text-gold-400 group-hover:rotate-12 transition-transform duration-300" />
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-charcoal-900"
              />
            </div>
          )}

          {!isOpen && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center border border-black shadow">
              1
            </span>
          )}
        </motion.button>
      </div>

      {/* CHAT WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`fixed ${posClass} mb-16 z-50 w-[92vw] sm:w-[400px] h-[540px] bg-[#0D0D0D]/95 border border-gold-500/30 backdrop-blur-2xl rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden`}
          >
            {/* HEADER */}
            <div className="px-5 py-3.5 bg-charcoal-950 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/40 text-gold-400 flex items-center justify-center relative">
                  <FiCpu className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    KVLR AI Assistant <FiStar className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-semibold">● Online • 24/7 Active</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  className="bg-black/60 border border-white/20 text-gold-400 text-[10px] rounded-lg px-1.5 py-0.5 focus:outline-none cursor-pointer"
                  title="Select Speech Recognition Language"
                >
                  <option value="en-IN">🇬🇧 EN</option>
                  <option value="hi-IN">🇮🇳 HI</option>
                  <option value="te-IN">🇮🇳 TE</option>
                </select>

                <button onClick={() => setIsOpen(false)} title="Close" className="text-gray-400 hover:text-white p-1 rounded-lg">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MESSAGES BODY */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                      m.sender === 'USER'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-semibold rounded-br-none'
                        : 'bg-white/10 border border-white/10 text-white rounded-bl-none'
                    }`}
                  >
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="Uploaded" className="w-32 h-32 object-cover rounded-xl mb-2 border border-black/30" />
                    )}
                    <p className="whitespace-pre-line">{m.text}</p>

                    {/* Streaming cursor */}
                    {m.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-gold-400 ml-0.5 animate-pulse rounded-sm" />
                    )}
                  </div>

                  {/* Verified PostgreSQL Outfit Looks */}
                  {(m.data?.type === 'OUTFIT_LOOKS' || m.type === 'OUTFIT_LOOKS' || m.data?.looks) && (
                    <div className="mt-2 space-y-2.5 w-full max-w-[88%]">
                      {(m.data?.looks || m.looks || []).map((look, idx) => (
                        <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-gold-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-bold text-amber-300">{look.title}</h4>
                            <span className="text-[10px] text-emerald-400 font-bold">₹{look.subtotal}</span>
                          </div>
                          <div className="space-y-1.5">
                            {look.items?.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-[10px] text-gray-300 bg-black/40 p-1.5 rounded-lg">
                                <span className="truncate max-w-[160px] font-semibold">{item.name}</span>
                                <span className="font-black text-gold-400">₹{item.discountPrice || item.price}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-white/10">
                            <span className="text-[9px] text-gray-400">Within budget by ₹{look.remainingBudget}</span>
                            <button
                              onClick={() => {
                                look.items?.forEach(item => dispatch(addToCart({ product: item, quantity: 1 })));
                                toast.success(`Added ${look.title} items to cart!`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-[9px] hover:from-gold-400 transition cursor-pointer"
                            >
                              + Add Outfit to Cart
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Phase 8: Smart AI Product Comparison Matrix */}
                  {(m.data?.type === 'COMPARISON_CARD' || m.type === 'COMPARISON_CARD' || m.data?.comparison || m.comparison) && (
                    <div className="mt-2 p-3 rounded-2xl bg-white/5 border border-gold-500/30 space-y-2 w-full max-w-[88%]">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                          <FiLayers className="w-3.5 h-3.5" /> Product Comparison
                        </h4>
                        <span className="text-[9px] text-emerald-400 font-bold">
                          {(m.data?.comparison?.products || m.comparison?.products || []).length} Items Evaluated
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(m.data?.comparison?.products || m.comparison?.products || []).map(item => (
                          <div key={item.id} className="flex items-center justify-between text-[10px] text-gray-300 bg-black/40 p-1.5 rounded-lg">
                            <span className="truncate max-w-[140px] font-semibold">{item.name}</span>
                            <span className="font-black text-gold-400">₹{item.finalPrice || item.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/10">
                        <span className="text-[9px] text-gray-400">Objective decision scoring</span>
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            navigate('/compare');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-gold-500 to-amber-500 text-black font-bold text-[9px] hover:from-gold-400 transition cursor-pointer"
                        >
                          View Full Matrix →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verified PostgreSQL Product Cards */}
                  {((m.data?.products && m.data.products.length > 0) || (m.products && m.products.length > 0)) && (
                    <div className="mt-2 space-y-2 w-full max-w-[85%]">
                      {(m.data?.products || m.products).slice(0, 4).map((prod) => {
                        const imgUrl = prod.images?.[0]?.url || (Array.isArray(prod.images) ? prod.images[0] : null);
                        const formattedImg = formatImageUrl(imgUrl);
                        const displayPrice = prod.discountPrice || prod.price;

                        return (
                          <div
                            key={prod.id}
                            className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition group"
                          >
                            <img
                              src={formattedImg}
                              alt={prod.name}
                              className="w-10 h-12 object-cover rounded-lg shrink-0 border border-amber-400/30"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] text-amber-400 font-bold uppercase truncate">
                                {prod.category?.name || 'Luxury Fashion'}
                              </p>
                              <h4 className="text-[11px] font-bold text-white truncate group-hover:text-amber-300 transition">
                                {prod.name}
                              </h4>
                              <p className="text-[11px] font-black text-amber-400 mt-0.5">
                                {formatCurrency(displayPrice)}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setIsOpen(false);
                                  navigate(`/product/${prod.slug || prod.id}`);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-[9px] transition cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  dispatch(addToCart({ product: prod, quantity: 1 }));
                                  toast.success(`Added ${prod.name} to cart!`);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[9px] transition cursor-pointer flex items-center gap-0.5"
                              >
                                <FiShoppingBag size={9} /> +Cart
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* AI badge + timestamp */}
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    {m.aiPowered && (
                      <span className="text-[8px] text-gold-400/60 font-semibold flex items-center gap-0.5">
                        <FiZap className="w-2.5 h-2.5" /> AI Powered
                      </span>
                    )}
                    <span className="text-[9px] text-gray-500">{m.timestamp}</span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-2xl rounded-bl-none px-3 py-2 w-fit">
                  <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-gold-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px] text-gray-400 ml-1.5">AI is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* QUICK ACTIONS */}
            <div className="px-3 py-2 bg-charcoal-950 border-t border-white/5 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.action === 'VISUAL_SEARCH') {
                      fileInputRef.current?.click();
                    } else {
                      handleSendMessage(action.query);
                    }
                  }}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-gold-500/20 border border-white/10 text-gray-300 hover:text-gold-400 text-[10px] font-semibold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* HIDDEN FILE INPUT FOR VISUAL SEARCH */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVisualSearchUpload(file);
              }}
            />

            {/* Phase 7: LISTENING STATUS BANNER */}
            {isListening && (
              <div className="px-3.5 py-1.5 bg-red-600/20 border-t border-red-500/30 flex items-center justify-between text-[10px] text-red-300 animate-pulse shrink-0">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  🔴 Listening ({voiceLang === 'hi-IN' ? 'हिन्दी' : voiceLang === 'te-IN' ? 'తెలుగు' : 'English'})...
                </span>
                <button
                  type="button"
                  onClick={handleVoiceClick}
                  className="px-2 py-0.5 rounded bg-red-500 text-white font-bold text-[9px] hover:bg-red-600 transition"
                >
                  Stop Listening
                </button>
              </div>
            )}

            {/* INPUT FORM */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-black border-t border-white/10 flex items-center gap-2 shrink-0"
            >
              {/* Visual Search Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Image for Visual Search"
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-gold-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <FiCamera className="w-4 h-4" />
              </button>

              {/* Phase 7: Voice Shopping Microphone Button */}
              <button
                type="button"
                onClick={handleVoiceClick}
                title={isListening ? 'Stop listening' : 'Start Voice Shopping (Speak)'}
                className={`p-2 rounded-xl border transition cursor-pointer relative ${
                  isListening
                    ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)]'
                    : 'bg-white/5 border-white/10 text-gold-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {isListening ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                placeholder={isListening ? 'Listening to your voice...' : isStreaming ? 'AI is responding...' : 'Ask or speak product, outfit, budget...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isStreaming}
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-gold-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isStreaming || !inputValue.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 text-black font-bold hover:from-gold-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSend className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatbotWidget;
