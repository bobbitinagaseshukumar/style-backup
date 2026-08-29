import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiX, FiLock, FiMail, FiUser, FiArrowRight, FiCheckCircle, FiSmartphone, FiKey, FiEye, FiEyeOff } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, clearError, setCredentials } from '../../redux/auth/authSlice';
import { fetchServerCart } from '../../redux/cart/cartSlice';
import { fetchServerWishlist } from '../../redux/wishlist/wishlistSlice';
import { fetchAuthSettings } from '../../redux/settings/settingsSlice';
import api from '../../config/api';
import { toast } from 'react-toastify';
import PasswordPolicyChecklist, { validatePasswordPolicy } from './PasswordPolicyChecklist';
import SocialAuthButtons from './SocialAuthButtons';

/**
 * Premium Luxury Auth Drawer — Sign In & Register Overlay
 * Dynamically reacts to Admin Authentication Manager settings (Login Methods, OTP Login, Form Fields, UI Branding).
 */
const AuthDrawer = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loginMethodType, setLoginMethodType] = useState('PASSWORD'); // 'PASSWORD' | 'OTP'
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpUserId, setOtpUserId] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    gender: '',
    dob: '',
    address: '',
    termsConsent: true,
  });

  const dispatch = useDispatch();
  const { isLoading, error, isAuthenticated, user } = useSelector((state) => state.auth);
  const { storeSettings, authSettings } = useSelector((state) => state.settings);

  // Parse dynamic configuration from authSettings
  let parsedLoginMethods = ['EMAIL', 'MOBILE', 'OTP_LOGIN'];
  if (authSettings?.loginMethods) {
    try {
      parsedLoginMethods = typeof authSettings.loginMethods === 'string'
        ? JSON.parse(authSettings.loginMethods)
        : authSettings.loginMethods;
    } catch (e) {}
  }

  let parsedFormFields = [
    { name: 'fullName', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Your Full Name' },
    { name: 'email', label: 'Email Address', type: 'email', required: true, enabled: true, placeholder: 'name@example.com' },
    { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, enabled: true, placeholder: '+91 98765 43210' },
    { name: 'password', label: 'Password', type: 'password', required: true, enabled: true, placeholder: '••••••••' },
  ];
  if (authSettings?.formFields) {
    try {
      const p = typeof authSettings.formFields === 'string'
        ? JSON.parse(authSettings.formFields)
        : authSettings.formFields;
      if (Array.isArray(p) && p.length > 0) parsedFormFields = p;
    } catch (e) {}
  }

  let parsedUi = {
    welcomeTitle: 'Welcome to ' + (storeSettings?.storeName || 'Styleverse'),
    loginButtonText: 'Sign In',
    registerButtonText: 'Create Account',
  };
  if (authSettings?.uiSettings) {
    try {
      const u = typeof authSettings.uiSettings === 'string'
        ? JSON.parse(authSettings.uiSettings)
        : authSettings.uiSettings;
      if (u) parsedUi = { ...parsedUi, ...u };
    } catch (e) {}
  }

  const isRegistrationEnabled = authSettings?.enableRegistration !== false;
  const isOtpLoginEnabled = parsedLoginMethods.includes('OTP_LOGIN') || parsedLoginMethods.includes('MOBILE');

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAuthSettings());
    }
  }, [isOpen, dispatch]);

  // Auto close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Auto close on successful authentication
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      toast.success(`Welcome back, ${user?.fullName || user?.name || 'Valued Customer'}! ✨`);
      onClose();
    }
  }, [isAuthenticated, isOpen, onClose, user]);

  if (!isOpen) return null;

  // Handle requesting instant login OTP
  const handleRequestOtp = async () => {
    const identifier = formData.email.trim();
    if (!identifier) {
      return toast.error('Please enter your email or mobile number');
    }
    setOtpLoading(true);
    try {
      const res = await api.post('/auth/login', {
        identifier,
        email: identifier,
        loginType: 'OTP'
      });
      if (res.data?.success && res.data.data?.requiresOTP) {
        setOtpEmail(res.data.data.email || identifier);
        setOtpUserId(res.data.data.userId || '');
        setOtpStep(true);
        toast.success(res.data.message || `6-digit OTP code sent to ${identifier}`);
      } else {
        toast.error(res.data?.message || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle verifying instant login OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      return toast.error('Please enter the 6-digit OTP code');
    }
    setOtpLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        userId: otpUserId,
        email: otpEmail,
        otp: otpCode.trim(),
      });
      const token = res.data?.token || res.data?.data?.token;
      const loggedUser = res.data?.user || res.data?.data?.user;
      if (res.data?.success && token && loggedUser) {
        dispatch(setCredentials({ user: loggedUser, token }));
        dispatch(fetchServerCart());
        dispatch(fetchServerWishlist());
        toast.success('🎉 Login successful! Welcome back.');
        onClose();
      } else {
        toast.error(res.data?.message || 'Verification failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearError());

    if (mode === 'login') {
      if (loginMethodType === 'OTP') {
        return handleRequestOtp();
      }
      if (!formData.email || !formData.password) {
        return toast.error('Please enter your email and password');
      }
      dispatch(loginUser({ email: formData.email, password: formData.password }));
    } else {
      // Validate dynamic required fields
      for (const field of parsedFormFields) {
        if (field.enabled && field.required) {
          const val = formData[field.name];
          if (val === undefined || val === null || val === '' || (field.type === 'checkbox' && !val)) {
            return toast.error(`Please provide ${field.label || field.name}`);
          }
        }
      }

      // Validate dynamic password policy
      let parsedPolicy = { minLength: 6, requireUppercase: true, requireLowercase: true, requireNumbers: false, requireSymbols: false, customRules: [] };
      if (authSettings?.passwordPolicy) {
        try {
          const p = typeof authSettings.passwordPolicy === 'string' ? JSON.parse(authSettings.passwordPolicy) : authSettings.passwordPolicy;
          if (p && typeof p === 'object') parsedPolicy = { ...parsedPolicy, ...p };
        } catch (e) {}
      }

      const policyCheck = validatePasswordPolicy(formData.password, parsedPolicy);
      if (!policyCheck.isValid) {
        return toast.error(`Password requirement not met: ${policyCheck.errors.join(', ')}`);
      }

      dispatch(registerUser({
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        gender: formData.gender,
        dob: formData.dob,
        address: formData.address,
      }));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        />

        {/* Drawer Content */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            {/* Header */}
            <div>
              <div className="p-6 bg-charcoal-900 border-b border-gold-500/20 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400">{(storeSettings?.storeName || 'STYLEVERSE').toUpperCase()} LUXURY</span>
                  <h2 className="text-xl font-serif font-bold mt-0.5">
                    {mode === 'login' ? (parsedUi.welcomeTitle || 'Customer Sign In') : (parsedUi.registerButtonText || 'Create Account')}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition cursor-pointer"
                  aria-label="Close Sign In"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex border-b border-gray-100 bg-gray-50/80">
                <button
                  onClick={() => { setMode('login'); setOtpStep(false); dispatch(clearError()); }}
                  className={`flex-1 py-3 text-xs font-bold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-gold-600 border-b-2 border-gold-500 shadow-sm'
                      : 'text-gray-500 hover:text-charcoal-900'
                  }`}
                >
                  {parsedUi.loginButtonText || 'Sign In'}
                </button>
                {isRegistrationEnabled && (
                  <button
                    onClick={() => { setMode('register'); setOtpStep(false); dispatch(clearError()); }}
                    className={`flex-1 py-3 text-xs font-bold transition-all cursor-pointer ${
                      mode === 'register'
                        ? 'bg-white text-gold-600 border-b-2 border-gold-500 shadow-sm'
                        : 'text-gray-500 hover:text-charcoal-900'
                    }`}
                  >
                    {parsedUi.registerButtonText || 'Create Account'}
                  </button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600">
                  {error}
                </div>
              )}

              {/* Login Method Sub-Toggle (Password vs OTP) */}
              {mode === 'login' && !otpStep && isOtpLoginEnabled && (
                <div className="mx-6 mt-4 p-1 bg-gray-100 rounded-xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setLoginMethodType('PASSWORD')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      loginMethodType === 'PASSWORD' ? 'bg-white text-charcoal-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Password Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethodType('OTP')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                      loginMethodType === 'OTP' ? 'bg-white text-gold-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <FiKey className="w-3.5 h-3.5" /> Instant OTP Login
                  </button>
                </div>
              )}

              {/* OTP Verification Step Form */}
              {mode === 'login' && otpStep ? (
                <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
                  <div className="p-4 bg-gold-50/50 border border-gold-200 rounded-2xl text-center space-y-1">
                    <p className="text-xs font-bold text-charcoal-900">Enter Verification Code</p>
                    <p className="text-[11px] text-gray-500">
                      We sent a 6-digit code to <strong className="text-charcoal-900">{otpEmail}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide mb-1">
                      6-Digit OTP Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] text-xl font-bold py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full py-3.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-900 font-extrabold text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpStep(false)}
                    className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-900 pt-2 cursor-pointer"
                  >
                    ← Back to Login
                  </button>
                </form>
              ) : (
                /* Standard Dynamic Form Body */
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {mode === 'login' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide mb-1">
                          Email Address / Mobile Number *
                        </label>
                        <div className="relative">
                          <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            required
                            placeholder="name@example.com or mobile"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold-500 allow-select"
                          />
                        </div>
                      </div>

                      {loginMethodType === 'PASSWORD' && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide">
                              Password *
                            </label>
                            <Link to="/forgot-password" onClick={onClose} className="text-[11px] text-gold-600 hover:underline font-semibold">
                              Forgot Password?
                            </Link>
                          </div>
                          <div className="relative">
                            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              placeholder="••••••••"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold-500 allow-select"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Dynamic Registration Fields */
                    <>
                      {parsedFormFields.filter(f => f.enabled).map((field) => {
                        if (field.name === 'termsConsent' || field.name === 'newsletterConsent') {
                          return (
                            <label key={field.name} className="flex items-start gap-2 pt-1 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!formData[field.name]}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                                className="w-4 h-4 mt-0.5 rounded text-gold-500 cursor-pointer"
                              />
                              <span>{field.label || (field.name === 'termsConsent' ? 'I agree to the Terms of Service & Privacy Policy' : 'Subscribe to newsletter')}</span>
                            </label>
                          );
                        }

                        if (field.type === 'select' && field.name === 'gender') {
                          return (
                            <div key={field.name}>
                              <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide mb-1">
                                {field.label || 'Gender'} {field.required ? '*' : ''}
                              </label>
                              <select
                                value={formData.gender || ''}
                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold-500 bg-white"
                              >
                                <option value="">Select Gender</option>
                                <option value="Women">Women</option>
                                <option value="Men">Men</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <div key={field.name}>
                              <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide mb-1">
                                {field.label} {field.required ? '*' : ''}
                              </label>
                              <textarea
                                rows={2}
                                placeholder={field.placeholder}
                                value={formData[field.name] || ''}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold-500"
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={field.name} className="space-y-1.5">
                            <label className="block text-xs font-bold text-charcoal-900 uppercase tracking-wide mb-1">
                              {field.label} {field.required ? '*' : ''}
                            </label>
                            <input
                              type={field.type || 'text'}
                              required={field.required}
                              placeholder={field.placeholder || ''}
                              value={formData[field.name] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold-500 allow-select"
                            />
                            {field.name === 'password' && (
                              <PasswordPolicyChecklist
                                password={formData.password}
                                policy={(() => {
                                  let p = { minLength: 6, requireUppercase: true, requireLowercase: true, requireNumbers: false, requireSymbols: false, customRules: [] };
                                  if (authSettings?.passwordPolicy) {
                                    try {
                                      const parsed = typeof authSettings.passwordPolicy === 'string' ? JSON.parse(authSettings.passwordPolicy) : authSettings.passwordPolicy;
                                      if (parsed && typeof parsed === 'object') p = { ...p, ...parsed };
                                    } catch (e) {}
                                  }
                                  return p;
                                })()}
                              />
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || otpLoading}
                    className="w-full py-3.5 rounded-xl bg-charcoal-900 hover:bg-black text-gold-400 font-extrabold text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-4"
                  >
                    {isLoading || otpLoading ? (
                      <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'login'
                          ? (loginMethodType === 'OTP' ? 'Request 6-Digit OTP Code' : (parsedUi.loginButtonText || 'Sign In'))
                          : (parsedUi.registerButtonText || 'Create Account')} <FiArrowRight />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Dynamic Social Login Options (Google, Apple, Facebook, GitHub) */}
              {!otpStep && (
                <div className="px-6 pb-4">
                  <SocialAuthButtons mode={mode} onSuccess={onClose} />
                </div>
              )}
            </div>

            {/* Footer Trust Badges */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 text-center space-y-2">
              <Link
                to="/login"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-700 hover:bg-gold-500/20 font-bold text-xs transition mb-2"
              >
                ✨ Open Full 3D Interactive Login Page
              </Link>
              <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
                <FiCheckCircle className="text-emerald-500" /> 100% Encrypted & Safe Login
              </div>
              <p className="text-[10px] text-gray-400">
                By continuing, you agree to {(storeSettings?.storeName || 'StyleVerse')} Privacy Policy and Terms of Service.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default AuthDrawer;
