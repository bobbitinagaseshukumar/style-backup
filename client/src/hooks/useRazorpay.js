/**
 * useRazorpay — Custom hook for Razorpay Standard Checkout.
 * Handles: load script → create order → open modal → verify signature.
 * With auto-retry for Razorpay CDN script loading on poor networks.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../config/api';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

/**
 * Load or reload the Razorpay checkout script with retry.
 * Returns true if loaded successfully, false if all retries fail.
 */
const loadRazorpayScript = (retries = 3) => {
  return new Promise((resolve) => {
    // Already loaded
    if (typeof window.Razorpay !== 'undefined') {
      return resolve(true);
    }

    const attempt = (attemptsLeft) => {
      // Remove any broken previous script tags
      const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;

      script.onload = () => {
        if (typeof window.Razorpay !== 'undefined') {
          resolve(true);
        } else if (attemptsLeft > 1) {
          console.warn(`[Razorpay] Script loaded but Razorpay undefined, retrying... (${attemptsLeft - 1} left)`);
          setTimeout(() => attempt(attemptsLeft - 1), 2000);
        } else {
          resolve(false);
        }
      };

      script.onerror = () => {
        console.warn(`[Razorpay] Script load failed, ${attemptsLeft - 1} retries left`);
        if (attemptsLeft > 1) {
          setTimeout(() => attempt(attemptsLeft - 1), 2000);
        } else {
          resolve(false);
        }
      };

      document.body.appendChild(script);
    };

    attempt(retries);
  });
};

const useRazorpay = () => {
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(typeof window.Razorpay !== 'undefined');
  const user = useSelector(s => s.auth?.user);
  const storeSettings = useSelector(s => s.settings?.storeSettings);
  const abortRef = useRef(null);

  // Pre-load Razorpay script on mount
  useEffect(() => {
    if (!scriptReady) {
      loadRazorpayScript(3).then(success => {
        setScriptReady(success);
        if (!success) {
          console.error('[Razorpay] Failed to load payment script after 3 attempts');
        }
      });
    }
  }, []);

  /**
   * initiatePayment — Full Razorpay checkout flow.
   *
   * @param {Object} options
   * @param {number} options.amount      — Total in rupees (will be converted to paise)
   * @param {string} options.currency    — Currency code (default: 'INR')
   * @param {string} options.receipt     — Receipt ID
   * @param {Object} options.notes       — Metadata
   * @param {Function} options.onSuccess — Called with { razorpay_payment_id, razorpay_order_id, razorpay_signature }
   * @param {Function} options.onFailure — Called on payment failure or cancellation
   * @param {string} options.orderId     — Our internal order ID (for server-side status update)
   * @param {Object} options.prefill     — Prefill info { name, email, contact }
   */
  const initiatePayment = useCallback(async ({
    amount,
    currency = 'INR',
    receipt,
    notes = {},
    onSuccess,
    onFailure,
    orderId,
    prefill = {},
  }) => {
    // Try loading script if not ready (handles slow networks)
    if (typeof window.Razorpay === 'undefined') {
      toast.info('Loading payment gateway...');
      const loaded = await loadRazorpayScript(2);
      if (!loaded) {
        toast.error('Payment gateway unavailable. Please check your internet or try Cash on Delivery.');
        onFailure?.({ error: 'Razorpay script not loaded' });
        return;
      }
    }

    // Validate amount
    const amountInPaise = Math.round(amount * 100);
    if (amountInPaise < 100) {
      toast.error('Minimum payable amount is ₹1');
      onFailure?.({ error: 'Amount too low' });
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create Razorpay order on backend
      const { data } = await api.post('/payments/create-order', {
        amount: amountInPaise,
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
        notes: { ...notes, userId: user?.id },
      });

      if (!data?.success || !data?.data?.orderId) {
        throw new Error('Failed to create payment order');
      }

      const { orderId: razorpayOrderId, keyId } = data.data;

      // Step 2: Open Razorpay checkout modal
      const options = {
        key: keyId || RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency,
        name: storeSettings?.storeName || 'Styleverse',
        description: receipt || 'Order Payment',
        order_id: razorpayOrderId,
        prefill: {
          name: prefill.name || user?.fullName || '',
          email: prefill.email || user?.email || '',
          contact: prefill.contact || user?.phone || '',
        },
        theme: {
          color: storeSettings?.primaryColor || '#D4AF37',
        },
        handler: async function (response) {
          // Step 3: Verify payment signature on backend
          try {
            const verifyRes = await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: orderId || undefined,
            });

            if (verifyRes.data?.success) {
              toast.success('💰 Payment successful!');
              onSuccess?.({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
            } else {
              toast.error('Payment verification failed. Contact support.');
              onFailure?.({ error: 'Verification failed' });
            }
          } catch (verifyErr) {
            console.error('[Razorpay Verify Error]:', verifyErr);
            // Don't panic the user — payment may have gone through
            toast.warning('Payment received but verification pending. We\'ll confirm your order shortly.');
            onFailure?.({ error: verifyErr.message });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast.info('Payment cancelled');
            onFailure?.({ error: 'User cancelled payment' });
          },
          confirm_close: true,
          escape: true,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (response) {
        setLoading(false);
        console.error('[Razorpay Payment Failed]:', response.error);
        const desc = response.error.description || 'Unknown error';
        // User-friendly messages for common failures
        if (desc.includes('network') || desc.includes('timeout')) {
          toast.error('Payment failed due to network issue. Please try again.');
        } else {
          toast.error(`Payment failed: ${desc}`);
        }
        onFailure?.({
          error: response.error.description,
          code: response.error.code,
          reason: response.error.reason,
        });
      });

      razorpayInstance.open();
    } catch (err) {
      setLoading(false);
      console.error('[Razorpay Init Error]:', err);
      // User-friendly error messages
      if (err.code === 'ECONNABORTED' || !err.response) {
        toast.error('Connection timed out. Please check your internet and try again.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to initiate payment. Try again.');
      }
      onFailure?.({ error: err.message });
    }
  }, [user, storeSettings]);

  return { initiatePayment, loading, scriptReady };
};

export default useRazorpay;
