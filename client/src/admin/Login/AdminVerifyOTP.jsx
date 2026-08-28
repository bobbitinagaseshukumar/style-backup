import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../redux/auth/authSlice';
import { FiShield, FiKey, FiRefreshCw, FiCheck, FiArrowLeft } from 'react-icons/fi';
import api from '../../config/api';
import DeviceLimitModal from '../../components/common/DeviceLimitModal';

const AdminVerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Retrieve stateData from location.state OR fallback to sessionStorage if browser tab was refreshed
  const getInitialStateData = () => {
    if (location.state && location.state.adminId) {
      sessionStorage.setItem('pendingAdminOTPAuth', JSON.stringify(location.state));
      return location.state;
    }
    const saved = sessionStorage.getItem('pendingAdminOTPAuth');
    if (saved) {
      try { return JSON.parse(saved); } catch { return {}; }
    }
    return {};
  };

  const stateData = getInitialStateData();
  const { adminId, email, trustDevice, deviceFingerprint, deviceName } = stateData;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [deviceLimitData, setDeviceLimitData] = useState(null);

  const inputsRef = useRef([]);

  // Redirect only if NO adminId exists in both location.state AND sessionStorage
  useEffect(() => {
    if (!adminId) {
      toast.error('Session expired. Please log in again.');
      navigate('/admin/login', { replace: true });
    }
  }, [adminId, navigate]);

  // 60-second countdown timer
  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(countdown);
    }
  }, [timer]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (adminId) {
      setTimeout(() => inputsRef.current[0]?.focus(), 300);
    }
  }, [adminId]);

  // Handle box input
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  // Handle paste (for OTP autofill from email)
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      inputsRef.current[5]?.focus();
    }
  };

  // Submit OTP Verification
  const handleVerify = async (e) => {
    e?.preventDefault();
    if (loading) return;
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      toast.error('Please enter complete 6-digit OTP code');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/admin/auth/verify-otp', {
        adminId,
        otpCode: fullOtp,
        trustDevice,
        deviceFingerprint,
        deviceName
      });

      if (res.data?.code === 'MAX_DEVICES_REACHED') {
        setDeviceLimitData(res.data.data);
        return;
      }

      const { user, token } = res.data.data;
      dispatch(setCredentials({ user, token }));
      localStorage.setItem('adminToken', token);
      localStorage.setItem('token', token);
      localStorage.setItem('kvlr_admin_last_activity', Date.now().toString());
      localStorage.setItem('kvlr_last_activity', Date.now().toString());
      sessionStorage.removeItem('pendingAdminOTPAuth');
      toast.success('OTP verified! Authenticated as Administrator 🎉');
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code');
      // Clear OTP inputs on failed verification so user can re-enter
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const handleResend = async () => {
    try {
      setResending(true);
      await api.post('/admin/auth/resend-otp', { adminId });
      toast.success(`Fresh 6-digit OTP sent to your email (${email})`);

      // Clear old OTP digits and reset timer so user enters the NEW code from email
      setOtp(['', '', '', '', '', '']);
      setTimer(60);

      // Focus back on first input for easy entry
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resend OTP failed. Try again.');
    } finally {
      setResending(false);
    }
  };

  // Don't render if no session data
  if (!adminId) return null;

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/6 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="w-full max-w-md bg-[#0C1120]/90 border border-amber-500/20 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl relative z-10 space-y-6 text-center"
      >
        {/* Top gold accent line */}
        <div className="absolute top-0 left-12 right-12 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <FiKey className="w-8 h-8 text-amber-400" />
        </div>

        <div>
          <h1 className="text-xl font-black text-white">Enter 6-Digit Verification OTP</h1>
          <p className="text-xs text-gray-400 mt-1.5">
            Verification code sent to <strong className="text-amber-400">{email}</strong>
          </p>
        </div>

        {/* Security info banner */}
        <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300/80 flex items-center gap-2">
          <FiShield className="shrink-0 text-amber-400" size={14} />
          <span>Check your email inbox for the 6-digit verification code. Code expires in 5 minutes.</span>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          {/* 6-Digit Box Inputs */}
          <div className="flex justify-center gap-2.5">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => inputsRef.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="w-12 h-14 text-center text-xl font-black font-mono bg-black/60 border border-amber-500/25 rounded-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 focus:outline-none transition text-amber-50 placeholder:text-gray-600"
                placeholder="·"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <FiRefreshCw className="animate-spin" size={14} /> Verifying OTP...
              </>
            ) : (
              <>
                Verify Code & Access Dashboard <FiCheck size={16} />
              </>
            )}
          </button>
        </form>

        {/* Resend Timer Controls */}
        <div className="pt-2 text-xs text-gray-400 flex items-center justify-center gap-2">
          <span>Didn&apos;t receive code?</span>
          {timer > 0 ? (
            <span className="font-mono text-amber-400">Resend in {timer}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <FiRefreshCw size={12} className={resending ? 'animate-spin' : ''} /> Resend OTP
            </button>
          )}
        </div>

        {/* Back to login link */}
        <div className="pt-1 border-t border-white/8">
          <button
            onClick={() => navigate('/admin/login', { replace: true })}
            className="text-[11px] text-gray-500 hover:text-amber-400 transition flex items-center gap-1 justify-center mx-auto cursor-pointer"
          >
            <FiArrowLeft size={11} /> Back to Admin Login
          </button>
        </div>
      </motion.div>

      <DeviceLimitModal
        isOpen={!!deviceLimitData}
        onClose={() => setDeviceLimitData(null)}
        activeSessions={deviceLimitData?.activeSessions || []}
        userId={deviceLimitData?.adminId || deviceLimitData?.userId}
        email={deviceLimitData?.email}
        onSessionTerminated={() => {
          setDeviceLimitData(null);
          handleVerify();
        }}
      />
    </div>
  );
};

export default AdminVerifyOTP;
