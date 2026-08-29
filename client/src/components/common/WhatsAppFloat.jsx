/**
 * WhatsAppFloat — Floating WhatsApp chat button.
 * Reads admin WhatsApp number from store settings API.
 * Updates automatically whenever admin changes the number.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { FiX, FiSend } from 'react-icons/fi';
import api from '../../config/api';
import { whatsappLink } from '../../utils/whatsapp';

const WhatsAppFloat = () => {
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pulse, setPulse] = useState(true);

  const fetchSettings = () => {
    api.get('/cms/settings')
      .then(r => setSettings(r.data?.data))
      .catch(() => {
        api.get('/settings').then(r => setSettings(r.data?.data)).catch(() => {});
      });
  };

  useEffect(() => {
    fetchSettings();

    window.addEventListener('kvlr:content-updated', fetchSettings);
    window.addEventListener('store_settings_updated', fetchSettings);

    // Stop pulsing after 6 seconds
    const t = setTimeout(() => setPulse(false), 6000);
    return () => {
      clearTimeout(t);
      window.removeEventListener('kvlr:content-updated', fetchSettings);
      window.removeEventListener('store_settings_updated', fetchSettings);
    };
  }, []);

  if (!settings?.whatsappEnabled || !settings?.whatsappNumber) return null;

  const phone = (settings.whatsappNumber || '').replace(/\D/g, '');

  const handleSend = () => {
    const link = whatsappLink(phone, message ? encodeURIComponent(message) : '');
    window.open(link, '_blank');
    setMessage('');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Chat header */}
            <div className="bg-[#25D366] px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <FaWhatsapp size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">{settings.whatsappBusinessName || 'Styleverse'}</p>
                <p className="text-[10px] text-white/80">
                  {settings.whatsappWorkingHours || 'Mon-Sat 9AM-7PM'} · Usually replies quickly
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/20 transition text-white">
                <FiX size={14} />
              </button>
            </div>

            {/* Chat bubble */}
            <div className="px-4 py-5 bg-[#ECE5DD]">
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-xs">
                <p className="text-sm text-gray-800 leading-relaxed">
                  {settings.whatsappAutoReply || '👋 Hi! How can we help you today?'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1.5 text-right">now ✓✓</p>
              </div>
            </div>

            {/* Input area */}
            <div className="px-3 py-3 bg-white border-t border-gray-100 flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button
                onClick={handleSend}
                className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white hover:bg-[#1ebe57] transition flex-shrink-0"
              >
                <FiSend size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        className="relative w-14 h-14 rounded-full bg-[#25D366] shadow-xl shadow-green-500/30 flex items-center justify-center text-white"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><FiX size={22} /></motion.div>
            : <motion.div key="wa" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><FaWhatsapp size={26} /></motion.div>
          }
        </AnimatePresence>

        {/* Pulse rings */}
        {pulse && !open && (
          <>
            <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
            <span className="absolute inset-0 rounded-full border-4 border-green-300 animate-pulse opacity-30" />
          </>
        )}
      </motion.button>
    </div>
  );
};

export default WhatsAppFloat;
