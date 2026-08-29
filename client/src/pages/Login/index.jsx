import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiCheck,
  FiAlertCircle, FiArrowRight, FiShield, FiPhone, FiKey, FiStar, FiCheckCircle
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../config/api';
import { setCredentials, logoutUser } from '../../redux/auth/authSlice';
import { fetchServerCart } from '../../redux/cart/cartSlice';
import { fetchServerWishlist } from '../../redux/wishlist/wishlistSlice';
import { toast } from 'react-toastify';
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';
import LoginScene from './LoginScene';
import DeviceLimitModal from '../../components/common/DeviceLimitModal';
import PasswordPolicyChecklist, { validatePasswordPolicy } from '../../components/auth/PasswordPolicyChecklist';

const customStyles = `
  @keyframes float-particle {
    0% { transform: translateY(0) translateX(0); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
  }
  @keyframes orb-float {
    0%, 100% { transform: translate(0, 0); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }
  @keyframes ripple {
    0% { transform: scale(0); opacity: 0.5; }
    100% { transform: scale(4); opacity: 0; }
  }
  .input-glow:focus {
    box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
  }
  .luxury-button-ripple {
    position: relative;
    overflow: hidden;
  }
  .ripple-span {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
  }
  .glass-card {
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 
                inset 0 1px 1px rgba(255, 255, 255, 0.1);
  }
`;

const Particles = () => {
  const particles = Array.from({ length: 35 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    top: Math.random() * 100,
    left: Math.random() * 100,
    duration: Math.random() * 12 + 8,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.3 + 0.3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-gradient-to-b from-amber-400/60 to-amber-500/30"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            top: `${p.top}%`,
            left: `${p.left}%`,
            opacity: p.opacity,
            animation: `float-particle ${p.duration}s infinite linear`,
            animationDelay: `${p.delay}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
};

const RippleButton = ({ children, onClick, className, disabled, type = 'button' }) => {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples([...ripples, { x, y, id: Date.now() }]);
    if (onClick) onClick(e);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`luxury-button-ripple ${className}`}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-span"
          style={{ left: r.x, top: r.y, width: 20, height: 20, marginTop: -10, marginLeft: -10 }}
          onAnimationEnd={() => setRipples((prev) => prev.filter((prevR) => prevR.id !== r.id))}
        />
      ))}
    </button>
  );
};

const Login = ({ initialMode }) => {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const isGoogleMode = searchParams.get('google') === 'true';

  // 3D Flip State (0 = Login, 180 = Register)
  const [isRegister, setIsRegister] = useState(initialMode === 'register' || modeParam === 'register' || isGoogleMode);

  const [googleProfile, setGoogleProfile] = useState(null);

  // Form State
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    rememberMe: true,
    acceptTerms: true,
    street: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [error, setError] = useState('');

  const mouseRef = useRef({ x: 0, y: 0 });
  const [deviceLimitData, setDeviceLimitData] = useState(null);

  // OTP Login State
  const [loginOtpStep, setLoginOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpUserId, setOtpUserId] = useState('');
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [dynamicFields, setDynamicFields] = useState([]);

  const handleRequestLoginOTP = async () => {
    if (!form.email.trim()) {
      setError('Please enter your email address first');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: form.email.trim(), loginType: 'OTP' });
      if (res.data?.success && res.data.data?.requiresOTP) {
        setOtpEmail(res.data.data.email || form.email);
        setOtpUserId(res.data.data.userId);
        setLoginOtpStep(true);
        toast.success(res.data.message || `6-digit OTP code sent to ${form.email}`);
      } else {
        setError(res.data?.message || 'Failed to send OTP code.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOTP = async (e) => {
    if (e) e.preventDefault();
    if (!loginOtpCode || loginOtpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit OTP code sent to your email');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        userId: otpUserId,
        email: otpEmail,
        otp: loginOtpCode.trim()
      });

      const token = res.data?.token || res.data?.data?.token;
      const user = res.data?.user || res.data?.data?.user;

      if (res.data?.success && token && user) {
        setAuthSuccess(true);
        dispatch(setCredentials({ user, token }));
        dispatch(fetchServerCart());
        dispatch(fetchServerWishlist());
        toast.success('🎉 Login successful! Welcome back.');
        const targetPath = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/dashboard';
        navigate(targetPath, { replace: true });
      } else {
        toast.error(res.data?.message || 'Invalid OTP code');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const [storeSettings, setStoreSettings] = useState(null);
  const [authSettings, setAuthSettings] = useState(null);
  const storeName = storeSettings?.storeName || 'Styleverse';

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [settingsRes, authRes] = await Promise.allSettled([
          api.get('/cms/settings'),
          api.get('/auth/settings/public'),
        ]);
        if (settingsRes.status === 'fulfilled' && settingsRes.value.data?.data) {
          setStoreSettings(settingsRes.value.data.data);
        }
        if (authRes.status === 'fulfilled' && authRes.value.data?.data) {
          const authData = authRes.value.data.data;
          setAuthSettings(authData);
          if (authData.formFields) {
            try {
              const fields = typeof authData.formFields === 'string'
                ? JSON.parse(authData.formFields)
                : authData.formFields;
              if (Array.isArray(fields) && fields.length > 0) setDynamicFields(fields);
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchConfigs();

    const handleUpdate = () => fetchConfigs();
    window.addEventListener('settings_updated', handleUpdate);
    window.addEventListener('auth_settings_updated', handleUpdate);
    window.addEventListener('kvlr:content-updated', handleUpdate);

    // Parse Google profile from session storage if redirected from OAuth callback
    const cachedGoogle = sessionStorage.getItem('googleProfile');
    if (cachedGoogle) {
      try {
        const parsed = JSON.parse(cachedGoogle);
        setGoogleProfile(parsed);
        setForm((prev) => ({
          ...prev,
          fullName: parsed.fullName || '',
          email: parsed.email || '',
        }));
      } catch (e) {
        console.error('Error parsing googleProfile from sessionStorage', e);
      }
    }

    // Always clear remembered email to keep login form fresh and blank
    localStorage.removeItem('remembered_email');

    return () => {
      window.removeEventListener('settings_updated', handleUpdate);
      window.removeEventListener('auth_settings_updated', handleUpdate);
      window.removeEventListener('kvlr:content-updated', handleUpdate);
    };
  }, []);

  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, token: reduxToken } = useSelector((state) => state.auth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSwitching = params.get('switch') === 'true' || params.get('logout') === 'true';

    if (isSwitching) {
      dispatch(logoutUser());
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('persist:auth');
        sessionStorage.clear();
      } catch (e) {}
      return;
    }

    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if ((isAuthenticated || reduxToken || storedToken) && !isSwitching) {
      if (user) {
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        const targetPath = isAdmin ? '/admin/dashboard' : '/';
        navigate(targetPath, { replace: true });
      }
    }
  }, [isAuthenticated, reduxToken, user, navigate, dispatch]);

  const handleMouseMove = (e) => {
    if (mouseRef.current) {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    }
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
    
    if (!isMobile) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      
      setTilt({ rotateX, rotateY });
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setTilt({ rotateX: 0, rotateY: 0 });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (!form.fullName.trim()) return setError('Full Name is required');
      if (!form.email.trim()) return setError('Email address is required');

      let parsedPasswordPolicy = {
        minLength: 6,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: false,
        requireSymbols: false,
        customRules: [],
      };
      if (authSettings?.passwordPolicy) {
        try {
          const p = typeof authSettings.passwordPolicy === 'string'
            ? JSON.parse(authSettings.passwordPolicy)
            : authSettings.passwordPolicy;
          if (p && typeof p === 'object') parsedPasswordPolicy = { ...parsedPasswordPolicy, ...p };
        } catch (e) {}
      }

      const policyCheck = validatePasswordPolicy(form.password, parsedPasswordPolicy);
      if (!policyCheck.isValid) {
        const msg = `Password requirement not met: ${policyCheck.errors.join(', ')}`;
        toast.error(msg);
        return setError(msg);
      }
      if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return setError('Passwords do not match'); }
      if (!form.acceptTerms) { toast.error('Please accept the terms & conditions'); return setError('Please accept the terms & conditions'); }
    } else {
      if (!form.email.trim()) { toast.error('Email address is required'); return setError('Email address is required'); }
      if (!form.password) { toast.error('Password is required'); return setError('Password is required'); }
    }

    setLoading(true);

    try {
      const isGoogleReg = isRegister && isGoogleMode;
      const endpoint = isGoogleReg ? '/auth/google/register' : (isRegister ? '/auth/register' : '/auth/login');
      
      const payload = isGoogleReg
        ? {
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            mobile: form.mobile,
            phone: form.mobile,
            uid: googleProfile?.uid,
            name: googleProfile?.name,
            photo: googleProfile?.photo,
            idToken: googleProfile?.idToken,
            street: form.street,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
          }
        : isRegister
          ? { fullName: form.fullName, email: form.email, password: form.password, mobile: form.mobile }
          : { email: form.email, password: form.password };

      const res = await api.post(endpoint, payload);

      if (res.data?.code === 'MAX_DEVICES_REACHED') {
        setDeviceLimitData(res.data.data);
        return;
      }

      const token = res.data?.token || res.data?.data?.token;
      const user = res.data?.user || res.data?.data?.user;

      if (res.data?.data?.requiresOTP) {
        setOtpEmail(res.data.data.email || form.email);
        setOtpUserId(res.data.data.userId);
        setLoginOtpStep(true);
        toast.info(res.data.message || `6-digit OTP sent to ${res.data.data.email}`);
        return;
      }

      if (res.data?.success && token && user) {
        localStorage.removeItem('remembered_email');
        if (isGoogleMode) {
          sessionStorage.removeItem('googleProfile');
        }
        setAuthSuccess(true);
        dispatch(setCredentials({ user, token }));
        dispatch(fetchServerCart());
        dispatch(fetchServerWishlist());
        toast.success(isRegister ? '🎉 Account created successfully!' : '✨ Welcome back!');
        const targetPath = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/';
        navigate(targetPath, { replace: true });
      } else {
        setError(res.data?.message || 'Authentication failed');
        toast.error(res.data?.message || 'Authentication failed');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Server connection error. Please try again.';
      const isUserNotFound = !isRegister && (
        err.response?.status === 404 ||
        errMsg.toLowerCase().includes('not found') ||
        errMsg.toLowerCase().includes('no account') ||
        errMsg.toLowerCase().includes('unregistered')
      );

      if (isUserNotFound) {
        setIsRegister(true);
        setError(`Email ${form.email} is new to ${storeName}. We've switched you to Create Account so you can complete your details!`);
        toast.info(`✨ Welcome to ${storeName}! Please complete your details below to create your account.`, { autoClose: 7000 });
      } else {
        setError(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;

    try {
      setForgotLoading(true);
      if (forgotStep === 1) {
        if (!forgotEmail) return toast.error('Enter your registered email address');
        const res = await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
        toast.success(res.data?.message || '6-digit OTP code sent to your email!');
        setForgotStep(2);
      } else if (forgotStep === 2) {
        if (!otp || otp.trim().length !== 6) return toast.error('Enter 6-digit OTP code');
        await api.post('/auth/verify-reset-otp', { email: forgotEmail.trim(), otp: otp.trim() });
        toast.success('OTP code verified! Now enter your new password.');
        setForgotStep(3);
      } else {
        if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters');
        const res = await api.post('/auth/reset-password', {
          email: forgotEmail.trim(),
          otp: otp.trim(),
          newPassword
        });
        toast.success(res.data?.message || 'Password reset successfully! Please login with your new password.');
        setForgotModalOpen(false);
        setForgotStep(1);
        setOtp('');
        setNewPassword('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed. Please check and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <style>{customStyles}</style>
      <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
        
        {/* Animated Background Orbs */}
        <div className="absolute top-[10%] left-[15%] w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" style={{ animation: 'orb-float 20s infinite ease-in-out' }} />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-yellow-600/10 rounded-full blur-[120px] pointer-events-none" style={{ animation: 'orb-float 25s infinite ease-in-out reverse' }} />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-amber-400/5 rounded-full blur-[80px] pointer-events-none" style={{ animation: 'orb-float 15s infinite ease-in-out', animationDelay: '-5s' }} />

        <Particles />

        {/* 3D Gold Jewellery Background Scene */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
          <React.Suspense fallback={null}>
            <LoginScene mouse={mouseRef} />
          </React.Suspense>
        </div>

        {/* Global Spotlight Beam following external mouse (if needed) */}
        {!isMobile && (
          <div
            className="absolute w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none transition-transform duration-300 z-0"
            style={{
              transform: `translate(${mousePos.x * 0.1}px, ${mousePos.y * 0.1}px)`,
            }}
          />
        )}

        {/* 3D SCENE CONTAINER */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full max-w-md my-8 relative z-10"
          style={{ perspective: 1500 }}
          animate={{ 
            y: authSuccess ? 0 : [0, -8, 0],
            scale: authSuccess ? 0.9 : 1,
            opacity: authSuccess ? 0 : 1,
          }}
          transition={{
            y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 0.6, ease: 'backIn' },
            opacity: { duration: 0.8, delay: 0.6 }
          }}
        >
          {/* Animated Gold Border Wrapper */}
          <motion.div
            animate={{
              rotateX: tilt.rotateX,
              rotateY: tilt.rotateY,
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{ transformStyle: 'preserve-3d' }}
            className={`relative w-full rounded-3xl p-[1px] transition-colors duration-500 ${
              authSuccess 
                ? 'bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' 
                : 'bg-gradient-to-br from-amber-500/50 via-amber-500/10 to-gold-500/50 shadow-[0_0_40px_rgba(212,175,55,0.15)]'
            }`}
          >
            {/* INNER CARD */}
            <div className="relative w-full rounded-[23px] bg-[#0D0D12]/90 backdrop-blur-2xl glass-card overflow-hidden border border-white/10">
              {/* Internal Cursor Spotlight Overlay */}
              {!isMobile && (
                 <div 
                   className="absolute w-64 h-64 bg-white/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-300 z-0"
                   style={{
                     left: mousePos.x - 128,
                     top: mousePos.y - 128,
                   }}
                 />
              )}

              <AnimatePresence mode="wait">
                {!isRegister ? (
                  /* ── LOGIN FORM ── */
                  <motion.div
                    key="login-view"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="w-full p-5 sm:p-8 relative z-10"
                  >
                <div className="text-center space-y-2 mb-6 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                    <FiStar className="w-6 h-6 fill-amber-400" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Welcome Back</h2>
                  <p className="text-xs text-gray-400">Sign in to continue shopping and access your luxury profile.</p>
                </div>

                {error && !isRegister && (
                  <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <FiAlertCircle className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 text-xs relative z-10">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Email Address</label>
                    <div className="relative group">
                      <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors z-10" />
                      <input
                        type="email"
                        name="email"
                        autoComplete="new-password"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="name@domain.com"
                        className={`w-full pl-10 pr-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 ${error && !isRegister ? 'border-red-500' : ''} ${authSuccess ? 'border-emerald-500' : ''}`}
                      />
                    </div>
                  </div>

                  {loginOtpStep ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                        🔑 A 6-digit OTP code has been emailed to <span className="font-bold text-white">{otpEmail}</span>. Enter it below to log in.
                      </div>
                      <div className="relative group">
                        <FiKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                        <input
                          type="text"
                          maxLength={6}
                          value={loginOtpCode}
                          onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit OTP"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyLoginOTP}
                        disabled={otpLoading || loginOtpCode.length !== 6}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 font-bold text-black uppercase tracking-wider text-xs hover:from-amber-400 hover:to-yellow-500 transition cursor-pointer disabled:opacity-50"
                      >
                        {otpLoading ? 'Verifying OTP...' : 'Verify OTP & Log In'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginOtpStep(false)}
                        className="w-full text-center text-xs text-gray-400 hover:text-white transition cursor-pointer"
                      >
                        ← Back to Password Sign In
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-300">Password</label>
                          <button
                            type="button"
                            onClick={() => setForgotModalOpen(true)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <div className="relative group">
                          <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors z-10" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            autoComplete="new-password"
                            required
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••••••"
                            className={`w-full pl-10 pr-10 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 ${error && !isRegister ? 'border-red-500' : ''} ${authSuccess ? 'border-emerald-500' : ''}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-10 transition-colors"
                          >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                          <input
                            type="checkbox"
                            name="rememberMe"
                            checked={form.rememberMe}
                            onChange={handleChange}
                            className="rounded text-amber-500 focus:ring-amber-500 bg-white/10 border-gray-700 w-4 h-4 cursor-pointer"
                          />
                          <span>Remember me</span>
                        </label>
                      </div>

                      <RippleButton
                        type="submit"
                        disabled={loading || authSuccess}
                        className={`w-full py-3.5 min-h-[44px] rounded-xl font-black uppercase tracking-wider text-xs shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                          authSuccess 
                            ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                            : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black shadow-amber-500/20 hover:-translate-y-[2px] active:scale-[0.98]'
                        }`}
                      >
                        {authSuccess ? (
                          <>
                            <FiCheckCircle className="w-5 h-5" /> Authenticated!
                          </>
                        ) : loading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            Signing In...
                          </div>
                        ) : (
                          <>
                            Sign In <FiArrowRight />
                          </>
                        )}
                      </RippleButton>
                    </>
                  )}
                </form>

                <div className="relative z-10 mt-6">
                  <SocialAuthButtons />
                </div>

                <div className="mt-6 text-center text-xs text-gray-400 border-t border-white/10 pt-4 relative z-10">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegister(true)}
                    className="font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer ml-1 transition-colors"
                  >
                    Create Account →
                  </button>
                </div>
              </motion.div>

                ) : (
                  /* ── REGISTER FORM ── */
                  <motion.div
                    key="register-view"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="w-full p-5 sm:p-8 relative z-10"
                  >
                {isGoogleMode && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-400 text-xs font-semibold">✨ Welcome! Your Google account is verified. Complete your profile to get started.</p>
                  </div>
                )}
                <div className="text-center space-y-2 mb-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                    <FiUser className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Create Account</h2>
                  <p className="text-xs text-gray-400">Join {storeName} to unlock VIP deals and instant order tracking.</p>
                </div>

                {isGoogleMode && googleProfile && (
                  <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <FiCheckCircle className="shrink-0" />
                    <span>Your Google account is verified. Please complete your details.</span>
                  </div>
                )}

                {error && isRegister && (
                  <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <FiAlertCircle className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3 text-xs relative z-10 overflow-y-auto no-scrollbar pb-2">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Full Name</label>
                    <div className="relative group">
                      <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors z-10" />
                      <input
                        type="text"
                        name="fullName"
                        autoComplete="off"
                        required
                        value={form.fullName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className={`w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 ${error && isRegister && !form.fullName ? 'border-red-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Email Address</label>
                    <div className="relative group">
                      <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors z-10" />
                      <input
                        type="email"
                        name="email"
                        autoComplete="new-password"
                        required
                        disabled={isGoogleMode}
                        value={form.email}
                        onChange={handleChange}
                        placeholder="name@domain.com"
                        className={`w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 ${isGoogleMode ? 'opacity-50 cursor-not-allowed' : ''} ${error && isRegister && !form.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Mobile Number (Optional)</label>
                    <div className="relative group">
                      <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors z-10" />
                      <input
                        type="tel"
                        name="mobile"
                        value={form.mobile}
                        onChange={handleChange}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300"
                      />
                    </div>
                  </div>

                  {isGoogleMode && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Street Address *</label>
                        <div className="relative">
                          <input
                            type="text"
                            name="street"
                            value={form.street}
                            onChange={handleChange}
                            placeholder="Flat, House no., Building, Street"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none input-glow transition focus:border-amber-500/50"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">City *</label>
                          <input
                            type="text"
                            name="city"
                            value={form.city}
                            onChange={handleChange}
                            placeholder="City"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none input-glow transition focus:border-amber-500/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">State *</label>
                          <input
                            type="text"
                            name="state"
                            value={form.state}
                            onChange={handleChange}
                            placeholder="State"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none input-glow transition focus:border-amber-500/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pincode *</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={form.postalCode}
                          onChange={handleChange}
                          placeholder="Postal Code / Pincode"
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none input-glow transition focus:border-amber-500/50"
                        />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-gray-300 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          autoComplete="new-password"
                          required
                          value={form.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                          className={`w-full px-3 pr-9 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 text-xs ${error && isRegister && form.password.length < 6 ? 'border-red-500' : ''}`}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-10 transition-colors">
                          {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-300 mb-1">Confirm</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          autoComplete="new-password"
                          required
                          value={form.confirmPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          className={`w-full px-3 pr-9 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 input-glow transition-all duration-300 text-xs ${error && isRegister && form.password !== form.confirmPassword ? 'border-red-500' : ''}`}
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-10 transition-colors">
                          {showConfirmPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Password Policy Requirements Checklist */}
                  <PasswordPolicyChecklist
                    password={form.password}
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
                    isDark={true}
                  />

                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer pt-1 hover:text-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={form.acceptTerms}
                      onChange={handleChange}
                      className="rounded text-amber-500 focus:ring-amber-500 bg-white/10 border-gray-700 w-4 h-4 cursor-pointer"
                    />
                    <span>I accept Terms & Conditions</span>
                  </label>

                  <RippleButton
                    type="submit"
                    disabled={loading || authSuccess}
                    className={`w-full py-3.5 min-h-[44px] rounded-xl font-black uppercase tracking-wider text-xs shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mt-2 ${
                      authSuccess 
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                        : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black shadow-amber-500/20 hover:-translate-y-[2px] active:scale-[0.98]'
                    }`}
                  >
                    {authSuccess ? (
                      <>
                        <FiCheckCircle className="w-5 h-5" /> Account Created!
                      </>
                    ) : loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Creating Account...
                      </div>
                    ) : (
                      <>
                        Create Account <FiArrowRight />
                      </>
                    )}
                  </RippleButton>
                </form>

                <div className="relative z-10 mt-6">
                  <SocialAuthButtons mode="register" />
                </div>

                <div className="mt-3 text-center text-xs text-gray-400 border-t border-white/10 pt-3 relative z-10">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegister(false)}
                    className="font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer ml-1 transition-colors"
                  >
                    Sign In →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </motion.div>
        </motion.div>

        {/* FORGOT PASSWORD MODAL */}
        <AnimatePresence>
          {forgotModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[#0D0D12] border border-amber-500/30 shadow-[0_0_40px_rgba(212,175,55,0.15)] rounded-3xl p-6 max-w-sm w-full space-y-4 text-xs text-white relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
                  <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                    <FiKey /> Reset Password
                  </h3>
                  <button onClick={() => setForgotModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 relative z-10">
                  {forgotStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-gray-400 mb-3 leading-relaxed">Enter your registered email to receive a 6-digit OTP code.</p>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@domain.com"
                        className="w-full px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400 input-glow transition-all"
                      />
                    </motion.div>
                  )}

                  {forgotStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-gray-400 mb-3 leading-relaxed">Enter 6-digit OTP code sent to <span className="text-amber-400">{forgotEmail}</span>:</p>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        className="w-full px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white text-center font-bold tracking-widest text-lg focus:outline-none focus:border-amber-400 input-glow transition-all"
                      />
                    </motion.div>
                  )}

                  {forgotStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-gray-400 mb-3 leading-relaxed">Enter your new strong password:</p>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400 input-glow transition-all"
                      />
                    </motion.div>
                  )}

                  <RippleButton
                    type="submit"
                    className="w-full py-3.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:-translate-y-[2px] active:scale-[0.98] transition-all"
                  >
                    {forgotStep === 1 ? 'Send OTP Code' : forgotStep === 2 ? 'Verify OTP' : 'Reset Password'}
                  </RippleButton>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <DeviceLimitModal
          isOpen={!!deviceLimitData}
          onClose={() => setDeviceLimitData(null)}
          activeSessions={deviceLimitData?.activeSessions || []}
          userId={deviceLimitData?.userId}
          email={deviceLimitData?.email}
          onSessionTerminated={() => {
            setDeviceLimitData(null);
            toast.info('Session terminated. Please try logging in again.');
          }}
        />
      </div>
    </>
  );
};

export default Login;
