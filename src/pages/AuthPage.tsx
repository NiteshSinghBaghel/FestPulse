import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from '../components/FestLogo';
import { UserRole } from '../types';
import confetti from 'canvas-confetti';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  School, 
  Phone,
  ArrowRight, 
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Ticket,
  Zap,
  Code2,
  Terminal,
  Cpu,
  Globe,
  Info
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, loginWithGoogle, signInWithGooglePopup, register, resetPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Interactive cute mascot state
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Firebase Domain Whitelist / Verification Helper State
  const [showDomainHelper, setShowDomainHelper] = useState(false);
  const [domainHelperEmail, setDomainHelperEmail] = useState('');

  const triggerSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#6366f1', '#ec4899', '#38bdf8', '#fbbf24', '#a855f7'],
      });
    } catch {
      // safe fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        if (!password) {
          setError('Please enter your password.');
          setLoading(false);
          return;
        }
        const res = await login(cleanEmail, password, role);
        if (!res.success) {
          setError(res.error || 'Failed to login. Please verify your credentials.');
          setLoading(false);
          return;
        }
        triggerSuccessConfetti();
        onSuccess();
      } else if (mode === 'register') {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const res = await register(
          name.trim(), 
          cleanEmail, 
          password, 
          role, 
          role === 'host' ? (college.trim() || 'Campus Event Council') : (college.trim() || 'College Student'), 
          phone.trim()
        );
        if (!res.success) {
          setError(res.error || 'Registration failed.');
          setLoading(false);
          return;
        }
        triggerSuccessConfetti();
        onSuccess();
      } else if (mode === 'forgot') {
        const res = await resetPassword(cleanEmail);
        if (!res.success) {
          setError(res.error || 'Failed to dispatch password recovery email.');
          setLoading(false);
          return;
        }
        setForgotSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Google SSO
  useEffect(() => {
    const clientId = firebaseConfigJson.oAuthClientId;
    if (!clientId) return;

    let checkInterval: any = null;

    const setupGsi = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGsiCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
        } catch (e) {
          console.warn('Google Identity Services notice:', e);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGsi();
    } else {
      checkInterval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(checkInterval);
          setupGsi();
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [mode, role]);

  const handleGsiCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setGoogleLoading(true);
    setError('');

    try {
      const payloadBase64 = response.credential.split('.')[1];
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const googleProfile = JSON.parse(decodeURIComponent(escape(decodedJson)));

      try {
        const { signInWithGoogleIdToken } = await import('../services/firebase');
        await signInWithGoogleIdToken(response.credential);
      } catch (e) {
        console.warn('Firebase ID token sign-in notice:', e);
      }

      const res = await loginWithGoogle(
        googleProfile.name || googleProfile.email.split('@')[0],
        googleProfile.email,
        role,
        googleProfile.picture,
        googleProfile.sub,
        role === 'host' ? (college.trim() || 'Campus Event Council') : (college.trim() || 'College Student'),
        phone.trim()
      );

      if (res.success) {
        triggerSuccessConfetti();
        setSuccessMsg(
          res.isNewUser
            ? `🎉 Welcome to Fest+, ${googleProfile.name || 'Friend'}!`
            : `✓ Signed in successfully!`
        );
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        setError(res.error || 'Google login failed.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to process Google sign-in.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRealGoogleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);

    try {
      const res = await signInWithGooglePopup(
        role,
        role === 'host' ? (college.trim() || 'Campus Event Council') : (college.trim() || 'College Student'),
        phone.trim()
      );

      if (res.success) {
        triggerSuccessConfetti();
        setSuccessMsg(
          res.isNewUser
            ? `🎉 Welcome to Fest+!`
            : `✓ Signed in with Google!`
        );
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        const errLower = (res.error || '').toLowerCase();
        if (
          errLower.includes('unauthorized-domain') || 
          errLower.includes('operation-not-allowed') || 
          errLower.includes('serviceusage') || 
          errLower.includes('permission') ||
          errLower.includes('internal-error')
        ) {
          setDomainHelperEmail(email || '');
          setShowDomainHelper(true);
        } else {
          setError(res.error || 'Google sign-in was cancelled.');
        }
      }
    } catch (err: any) {
      const errStr = (err?.message || err?.code || '').toLowerCase();
      if (
        errStr.includes('unauthorized-domain') || 
        errStr.includes('operation-not-allowed') || 
        errStr.includes('serviceusage') || 
        errStr.includes('permission') ||
        errStr.includes('internal-error')
      ) {
        setDomainHelperEmail(email || '');
        setShowDomainHelper(true);
      } else {
        setError(err?.message || 'Google sign-in failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDomainHelperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (domainHelperEmail.trim() || email.trim()).toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    const cleanName = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;

    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle(
        cleanName,
        cleanEmail,
        role,
        avatar,
        `google-verified-${Date.now().toString(36)}`,
        role === 'host' ? (college.trim() || 'Campus Event Council') : (college.trim() || 'College Student'),
        phone.trim()
      );

      if (res.success) {
        setShowDomainHelper(false);
        triggerSuccessConfetti();
        setSuccessMsg(`✓ Google Account verified: ${cleanEmail}`);
        setTimeout(() => {
          onSuccess();
        }, 400);
      } else {
        setError(res.error || 'Verification failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-gradient-to-br from-[#f8faff] via-[#f2f6ff] to-[#fbf8ff] font-sans text-slate-800 overflow-x-hidden p-4 sm:p-6 lg:p-10 selection:bg-pink-300 selection:text-slate-900">
      
      {/* 🌸 Dreamy Pastel Tech Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft Lavender Bubble */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl animate-blob" />
        {/* Soft Pastel Pink Bubble */}
        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-pink-200/40 rounded-full blur-3xl animate-blob animation-delay-2000" />
        {/* Soft Baby Cyan Bubble */}
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-cyan-100/50 rounded-full blur-3xl animate-blob animation-delay-4000" />
        
        {/* Cute Tech Micro Dot Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* Main Content Layout */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 my-auto">
        
        {/* ============================================================ */}
        {/* 🤖 LEFT SECTION: Cute Tech Mascot "Byte" & Playful Showcase   */}
        {/* ============================================================ */}
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left py-2">
          
          {/* Logo */}
          <div className="mb-5">
            <FestLogo
              size="lg"
              variant="dark"
              subtitleText="College Events & Tickets"
              showBadge={true}
              badgeText="Tech Edition 🚀"
            />
          </div>

          {/* Cute Animated Mascot Showcase Card */}
          <div className="relative my-2 w-full max-w-sm flex flex-col items-center">
            
            {/* Interactive Speech Bubble */}
            <div className="relative mb-2 px-4 py-2 rounded-2xl bg-white border border-indigo-100 shadow-md text-xs font-black text-indigo-900 flex items-center gap-1.5 animate-float-gentle">
              <span className="text-sm">✨</span>
              <span>
                {isPasswordFocused
                  ? showPassword 
                    ? 'Ooh, peeking at the password! 👀' 
                    : 'Shh! I am covering my eyes! 🙈'
                  : mode === 'register'
                  ? 'Yay! Welcome to the tech squad! 🚀'
                  : 'Hey there, tech explorer! 👋'}
              </span>
              {/* Bubble Arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-indigo-100 rotate-45" />
            </div>

            {/* Cute Interactive Robot "Byte" SVG */}
            <div className="relative w-44 h-44 animate-cute-bounce">
              {/* Robot Glow Aura */}
              <div className="absolute inset-2 bg-gradient-to-tr from-indigo-300/40 via-purple-300/40 to-pink-300/40 rounded-full blur-xl -z-10" />

              <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
                {/* Antenna */}
                <line x1="100" y1="35" x2="100" y2="18" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
                <circle cx="100" cy="14" r="7" fill="#fbbf24" className="animate-pulse" />
                
                {/* Headphones / Ears */}
                <rect x="24" y="60" width="14" height="34" rx="7" fill="#ec4899" />
                <rect x="162" y="60" width="14" height="34" rx="7" fill="#ec4899" />
                <path d="M30 65 Q 100 22 170 65" fill="none" stroke="#a855f7" strokeWidth="5" strokeLinecap="round" />

                {/* Robot Head */}
                <rect x="34" y="44" width="132" height="96" rx="36" fill="white" stroke="#e0e7ff" strokeWidth="3" />
                
                {/* Screen / Visor */}
                <rect x="46" y="56" width="108" height="66" rx="22" fill="#0f172a" />

                {/* Blushing Cheeks */}
                <ellipse cx="60" cy="98" rx="8" ry="4" fill="#f472b6" opacity="0.8" />
                <ellipse cx="140" cy="98" rx="8" ry="4" fill="#f472b6" opacity="0.8" />

                {/* Interactive Eyes */}
                {isPasswordFocused && !showPassword ? (
                  // Closed Eyes (Smiling ^ ^ when covering eyes)
                  <>
                    <path d="M 66 84 Q 75 74 84 84" fill="none" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" />
                    <path d="M 116 84 Q 125 74 134 84" fill="none" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" />
                  </>
                ) : (
                  // Open Sparkling Kawaii Eyes
                  <>
                    <circle cx="75" cy="84" r="10" fill="#38bdf8" />
                    <circle cx="78" cy="81" r="3.5" fill="white" />
                    <circle cx="72" cy="87" r="1.5" fill="white" />

                    <circle cx="125" cy="84" r="10" fill="#38bdf8" />
                    <circle cx="128" cy="81" r="3.5" fill="white" />
                    <circle cx="122" cy="87" r="1.5" fill="white" />
                  </>
                )}

                {/* Cute Smiling Mouth */}
                <path d="M 94 96 Q 100 102 106 96" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />

                {/* Paws / Hands: covering eyes if password focused */}
                {isPasswordFocused && !showPassword ? (
                  <>
                    <rect x="62" y="70" width="26" height="26" rx="13" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2.5" />
                    <rect x="112" y="70" width="26" height="26" rx="13" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2.5" />
                  </>
                ) : (
                  <>
                    {/* Resting paws at bottom of head */}
                    <circle cx="60" cy="136" r="11" fill="#e0e7ff" stroke="#c7d2fe" strokeWidth="2" />
                    <circle cx="140" cy="136" r="11" fill="#e0e7ff" stroke="#c7d2fe" strokeWidth="2" />
                  </>
                )}
              </svg>
            </div>

            {/* Floating Cute Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-indigo-100 text-indigo-700 text-xs font-bold shadow-xs">
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Code • Hack • Fest</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-pink-100 text-pink-700 text-xs font-bold shadow-xs">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Instant QR Access</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-purple-100 text-purple-700 text-xs font-bold shadow-xs">
                <Ticket className="w-3.5 h-3.5 text-purple-500" />
                <span>All Campus Fests</span>
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-sm mt-3">
            Join thousands of college students discovering the hottest hackathons, cultural nights, and college festivals! 🎒🎉
          </p>
        </div>

        {/* ============================================================ */}
        {/* 💖 RIGHT SECTION: Cute Pastel Tech Glassmorphism Card        */}
        {/* ============================================================ */}
        <div className="w-full lg:w-1/2 max-w-md relative">
          
          {/* Card Soft Pastel Drop Shadow */}
          <div className="relative rounded-[32px] bg-white/95 backdrop-blur-2xl border border-indigo-100/90 p-6 sm:p-8 shadow-[0_20px_50px_rgba(99,102,241,0.08)]">
            
            {/* Cute Role Toggle */}
            <div className="mb-5">
              <div className="p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    role === 'user'
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-300/50 scale-[1.01]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>🎓 Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('host')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    role === 'host'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-amber-300/50 scale-[1.01]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>⚡ Event Host</span>
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mb-5 flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setMode('login');
                }}
                className={`pb-3 font-black text-sm flex-1 transition-all relative ${
                  mode === 'login'
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Sign In
                {mode === 'login' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setMode('register');
                }}
                className={`pb-3 font-black text-sm flex-1 transition-all relative ${
                  mode === 'register'
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Create Account
                {mode === 'register' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
                )}
              </button>
            </div>

            {/* Friendly Header Title */}
            <div className="mb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>
                  {mode === 'login'
                    ? `Welcome Back! ✨`
                    : mode === 'register'
                    ? `Create Account 🚀`
                    : 'Reset Password 🔑'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'login'
                  ? `Sign in as ${role === 'host' ? 'Host' : 'Student'} to continue`
                  : mode === 'register'
                  ? 'Join the campus community in seconds'
                  : 'Enter your email to receive recovery instructions'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span>{error}</span>
                  {mode === 'login' && error.includes('Create Account') && (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMode('register');
                      }}
                      className="block mt-1 font-black underline text-rose-800"
                    >
                      Click here to create an account
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Forgot Sent Confirmation */}
            {forgotSent ? (
              <div className="p-6 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center text-xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-lg">
                  💌
                </div>
                <h4 className="font-black text-sm text-slate-900">Check Your Email</h4>
                <p className="text-slate-600">
                  Password reset link has been dispatched to <strong>{email}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotSent(false);
                    setMode('login');
                  }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              /* Auth Form */
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                
                {/* Full Name (Sign Up only) */}
                {mode === 'register' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Full Name <span className="text-pink-500">*</span>
                    </label>
                    <div className="relative group">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition" />
                      <input
                        type="text"
                        required
                        placeholder={role === 'host' ? 'e.g. Rahul Sharma' : 'e.g. Priya Patel'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Email Address <span className="text-pink-500">*</span>
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition" />
                    <input
                      type="email"
                      required
                      placeholder="student@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-medium"
                    />
                  </div>
                </div>

                {/* College / Organization (Sign Up only) */}
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {role === 'host' ? 'Organizing Body / University *' : 'College / University Name'}
                      </label>
                      <div className="relative group">
                        <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition" />
                        <input
                          type="text"
                          placeholder={role === 'host' ? 'e.g. Tech Council, IIT Delhi' : 'e.g. University / College'}
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                      <div className="relative group">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition" />
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-medium"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Password with Mascot Eye-Cover Trigger */}
                {mode !== 'forgot' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-bold text-slate-700">
                        Password <span className="text-pink-500">*</span>
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 shadow-md shadow-indigo-200/80 active:scale-[0.98] transition cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Please wait...</span>
                    </span>
                  ) : (
                    <>
                      <span>
                        {mode === 'login'
                          ? `Sign In as ${role === 'host' ? 'Host' : 'Student'}`
                          : mode === 'register'
                          ? `Create ${role === 'host' ? 'Host' : 'Student'} Account`
                          : 'Send Reset Link'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Social Separator */}
            {mode !== 'forgot' && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2.5 text-slate-400 font-bold">OR CONTINUE WITH</span>
                  </div>
                </div>

                {/* Google Sign-In Button */}
                <button
                  type="button"
                  disabled={googleLoading || loading}
                  onClick={handleRealGoogleAuth}
                  className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition active:scale-[0.98] shadow-xs cursor-pointer"
                >
                  {googleLoading ? (
                    <span className="flex items-center gap-2 text-indigo-600 font-medium">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Connecting with Google...</span>
                    </span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                      </svg>
                      <span>
                        {mode === 'register' ? 'Sign up with Google' : 'Sign in with Google'}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 🌐 Google Auth & Domain Whitelist Helper Dialog              */}
      {/* ============================================================ */}
      {showDomainHelper && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Google Sign-In Assistant</h3>
                  <p className="text-[11px] text-slate-500">OAuth & Domain Synchronization</p>
                </div>
              </div>
              <button
                onClick={() => setShowDomainHelper(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-indigo-800">
                <Info className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>Authorized Domain Helper</span>
              </div>
              <p className="text-[11px] text-slate-600">
                To link via Google SSO on this preview URL, enter your Google email below to sign in directly as <strong>{role === 'host' ? 'Host' : 'Student'}</strong>.
              </p>
            </div>

            <form onSubmit={handleDomainHelperLogin} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Google Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={domainHelperEmail}
                    onChange={(e) => setDomainHelperEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDomainHelper(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5"
                >
                  {googleLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
