import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from '../components/FestLogo';
import { UserRole } from '../types';
import confetti from 'canvas-confetti';
import { 
  Mail, 
  Lock, 
  User, 
  School, 
  Phone,
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff,
  Ticket,
  Calendar,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  QrCode,
  Music2,
  Check,
  TrendingUp,
  MapPin,
  Clock
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, resetPassword, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Live campus ticker feed
  const [tickerIndex, setTickerIndex] = useState(0);
  const recentActivities = [
    { name: 'Rohan Verma', college: 'IIT Bombay', event: 'Oasis EDM Night', time: '2m ago' },
    { name: 'Ananya Roy', college: 'BITS Pilani', event: 'HackIndia 2026', time: '4m ago' },
    { name: 'Aarav Patel', college: 'IIT Delhi', event: 'Spring Fest Cult Night', time: '6m ago' },
    { name: 'Sneha Rao', college: 'SRM Chennai', event: 'RoboWars Grand Finale', time: '9m ago' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % recentActivities.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [recentActivities.length]);

  const triggerSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#ec4899', '#38bdf8', '#fbbf24', '#10b981'],
      });
    } catch {
      // safe fallback
    }
  };

  // 1-Click Google Sign In
  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const googleEmail = role === 'host' 
        ? `host_${randomSuffix}@festplus.com`
        : `student_${randomSuffix}@festplus.com`;
      const googleName = role === 'host' ? 'Campus Event Host' : 'College Student';
      const defaultCollege = role === 'host' ? 'Campus Event Council' : 'College Campus';

      const res = await loginWithGoogle(
        googleName,
        googleEmail,
        role,
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(googleName + randomSuffix)}`,
        undefined,
        defaultCollege,
        ''
      );

      if (res.success) {
        triggerSuccessConfetti();
        onSuccess();
      } else {
        setError(res.error || 'Google login failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Click Fast Demo Login
  const handleQuickDemoLogin = async (demoRole: UserRole) => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const demoEmail = demoRole === 'host' ? 'host@campusfest.org' : 'student@college.edu';
      const demoName = demoRole === 'host' ? 'Cultural Committee Head' : 'Aarav Sharma';
      const demoCollege = demoRole === 'host' ? 'IIT Delhi Event Council' : 'IIT Delhi (CS Dept)';

      const res = await loginWithGoogle(
        demoName,
        demoEmail,
        demoRole,
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(demoName)}`,
        `demo_${demoRole}_uid`,
        demoCollege,
        '9876543210'
      );

      if (res.success) {
        triggerSuccessConfetti();
        onSuccess();
      } else {
        setError(res.error || 'Demo login failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Demo login encountered an issue.');
    } finally {
      setLoading(false);
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
          college.trim() || (role === 'host' ? 'Campus Event Council' : 'College Student'), 
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
        if (!newPassword || newPassword.length < 6) {
          setError('Please enter a new password (min 6 characters).');
          setLoading(false);
          return;
        }
        const res = await resetPassword(cleanEmail, newPassword);
        if (!res.success) {
          setError(res.error || 'Password reset failed.');
          setLoading(false);
          return;
        }
        setSuccessMsg('Password updated successfully! You can now log in.');
        setPassword(newPassword);
        setMode('login');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/50 to-rose-50/40 relative overflow-x-hidden selection:bg-indigo-600 selection:text-white flex flex-col justify-between">
      
      {/* 🌟 Animated Ambient Background Mesh & Floating Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Subtle geometric dot grid */}
        <div 
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        {/* Floating Soft Pastel Blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] bg-amber-200/30 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      {/* 🧭 Top Navigation / Branding Header */}
      <header className="relative z-10 w-full px-6 py-4 max-w-7xl mx-auto flex items-center justify-between">
        <FestLogo />
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-indigo-100/80 shadow-sm text-xs text-slate-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4" />
          <span>Campus Pass OS • Active</span>
        </div>
      </header>

      {/* 🎯 Main Center Container */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ══════════════════════════════════════════════════
              LEFT SIDE: Hero Showcase, Floating 3D Pass & Ticker
              ══════════════════════════════════════════════════ */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6">
            
            {/* Live Campus Activity Ticker */}
            <div className="inline-flex items-center gap-2.5 bg-white/90 backdrop-blur-md border border-indigo-100 shadow-sm rounded-full py-1.5 px-4 text-xs text-slate-700 w-fit">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="font-semibold text-indigo-700">Live Campus Feed:</span>
              <span className="font-medium text-slate-800">
                {recentActivities[tickerIndex].name} ({recentActivities[tickerIndex].college})
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{recentActivities[tickerIndex].event}</span>
              <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                {recentActivities[tickerIndex].time}
              </span>
            </div>

            {/* Hero Heading */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>INTER-COLLEGE PASS NETWORK</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                One Pass for All Your <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-500 bg-clip-text text-transparent">
                  College Fests & Hackathons.
                </span>
              </h1>
              <p className="text-slate-600 text-base max-w-lg leading-relaxed">
                Instant anti-counterfeit QR passes, seamless UPI ticketing, and superfast 0.2s camera gate check-ins across top universities.
              </p>
            </div>

            {/* 🎟️ Floating 3D Holographic Live Ticket Card */}
            <div className="relative pt-2">
              <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl border border-indigo-100 rounded-3xl p-5 shadow-[0_20px_50px_rgba(79,70,229,0.12)] hover:shadow-[0_25px_60px_rgba(79,70,229,0.18)] transition-all duration-300">
                
                {/* Header inside Pass */}
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20">
                      F+
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">CAMPUS PASS • VIP ACCESS</h4>
                      <p className="text-[10px] text-slate-500 font-medium">IIT Delhi • Cultural Fest 2026</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
                    <Check className="w-3 h-3" /> VERIFIED
                  </span>
                </div>

                {/* Ticket Details & Real-Time Equalizer */}
                <div className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Attendee</span>
                    <p className="text-sm font-bold text-slate-800">Eshu Singh</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      <span>Main Auditorium, Gate #2</span>
                    </div>
                  </div>

                  {/* Equalizer Frequency Waves */}
                  <div className="flex items-end gap-1 h-8 bg-indigo-50/80 px-2.5 py-1 rounded-xl border border-indigo-100">
                    <span className="w-1 bg-indigo-500 rounded-full h-3 animate-pulse" />
                    <span className="w-1 bg-indigo-600 rounded-full h-6 animate-pulse delay-75" />
                    <span className="w-1 bg-rose-500 rounded-full h-4 animate-pulse delay-150" />
                    <span className="w-1 bg-purple-600 rounded-full h-7 animate-pulse delay-300" />
                    <span className="w-1 bg-indigo-500 rounded-full h-3 animate-pulse delay-100" />
                  </div>

                  {/* QR Code Graphic */}
                  <div className="w-16 h-16 bg-slate-900 rounded-xl p-1.5 flex items-center justify-center shadow-inner">
                    <QrCode className="w-full h-full text-white" />
                  </div>
                </div>

                {/* Footer Perforated Styling */}
                <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono font-medium text-slate-600">PASS #VERIFIED_FEST_2026</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Fast Check-In Ready
                  </span>
                </div>
              </div>

              {/* Floating Pill Badges */}
              <div className="absolute -top-3 right-6 bg-white/95 border border-indigo-100 shadow-md py-1 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 animate-bounce">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>⚡ Instant 0.2s Check-In</span>
              </div>
              <div className="absolute -bottom-3 left-4 bg-white/95 border border-emerald-100 shadow-md py-1 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>🔥 Free Persistent DB</span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-xs">
                <p className="text-lg font-black text-indigo-600">100%</p>
                <p className="text-[11px] text-slate-500 font-medium">Free Storage</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-xs">
                <p className="text-lg font-black text-rose-600">0.2s</p>
                <p className="text-[11px] text-slate-500 font-medium">QR Gate Scan</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-xs">
                <p className="text-lg font-black text-emerald-600">UPI</p>
                <p className="text-[11px] text-slate-500 font-medium">Zero-Failure Pay</p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              RIGHT SIDE: The Crisp White Animated Login Card
              ══════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-indigo-100/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(79,70,229,0.09)] relative">
              
              {/* 🤖 FESTBOT: Cute Interactive Mascot with Eye-Covering Animation */}
              <div className="flex justify-center -mt-14 mb-2">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-rose-500 p-0.5 shadow-xl shadow-indigo-500/25">
                    <div className="w-full h-full bg-white rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
                      
                      {/* Antenna */}
                      <div className="w-1 h-2 bg-indigo-500 -mt-1 rounded-full" />
                      
                      {/* Bot Face */}
                      <div className="flex items-center gap-2.5 my-1">
                        {/* Eyes */}
                        {isPasswordFocused ? (
                          <>
                            {/* Closed/Happy Eyes when covering */}
                            <span className="text-sm font-bold text-indigo-600">^</span>
                            <span className="text-sm font-bold text-indigo-600">^</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 group-hover:bg-indigo-600 transition" />
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 group-hover:bg-indigo-600 transition" />
                          </>
                        )}
                      </div>

                      {/* Cute Smile */}
                      <div className="w-3.5 h-1.5 border-b-2 border-slate-800 rounded-full" />

                      {/* Mascot Paws / Hands covering eyes during Password focus */}
                      {isPasswordFocused && (
                        <div className="absolute inset-0 bg-indigo-50/90 flex items-center justify-center transition-all animate-bounce">
                          <span className="text-xs font-black text-indigo-700 tracking-wider">🙈 NO PEEK!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="text-center mb-5">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' && 'Welcome Back! 👋'}
                  {mode === 'register' && 'Join Fest-Plus 🚀'}
                  {mode === 'forgot' && 'Reset Password 🔑'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {mode === 'login' && 'Sign in to access your passes, tickets and event dashboard'}
                  {mode === 'register' && 'Register in seconds to book passes or host college events'}
                  {mode === 'forgot' && 'Enter your email and create a new secure password'}
                </p>
              </div>

              {/* Role Selector Tabs (Student vs Host) */}
              {mode !== 'forgot' && (
                <div className="mb-4 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'user'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Student / Attendee</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('host')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'host'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    <span>College / Host</span>
                  </button>
                </div>
              )}

              {/* Google 1-Click Sign-In */}
              {mode !== 'forgot' && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 flex items-center justify-center gap-2.5 transition shadow-xs active:scale-[0.99] cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  {/* ⚡ Quick 1-Click Fast Demo Logins */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('user')}
                      disabled={loading}
                      className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 rounded-lg text-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-indigo-600" />
                      <span>⚡ Student Demo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('host')}
                      disabled={loading}
                      className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 rounded-lg text-rose-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Calendar className="w-3 h-3 text-rose-600" />
                      <span>🎪 Host Demo</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative my-3.5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="bg-white px-2.5 text-slate-400 font-medium">or continue with email</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Switch (Sign In vs Create Account) */}
              {mode !== 'forgot' && (
                <div className="flex border-b border-slate-200 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                      mode === 'login'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className={`flex-1 pb-2 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
                      mode === 'register'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Error & Success Messages */}
              {error && (
                <div className="mb-3.5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-600 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-3.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Elements */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Full Name (Register only) */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                </div>

                {/* College / Organization & Mobile (Register only) */}
                {mode === 'register' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {role === 'host' ? 'Council/Club' : 'College'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <School className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          placeholder={role === 'host' ? 'Event Committee' : 'IIT Delhi'}
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mobile</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Password field */}
                {mode !== 'forgot' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-700">Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setError('');
                            setSuccessMsg('');
                          }}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder={mode === 'register' ? 'Min 6 characters' : 'Enter your password'}
                        value={password}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* New Password field (Forgot mode only) */}
                {mode === 'forgot' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login' && 'Sign In to CampusPass'}
                        {mode === 'register' && 'Create Free Account'}
                        {mode === 'forgot' && 'Reset & Update Password'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login for Forgot Password */}
              {mode === 'forgot' && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    &larr; Back to Sign In
                  </button>
                </div>
              )}

              {/* Bottom Feature Badges */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Free Persistent DB
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" /> Instant Access
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 👟 Footer */}
      <footer className="relative z-10 w-full py-3 text-center text-xs text-slate-400">
        CampusPass OS • Secure Student & Host Ticketing Architecture
      </footer>
    </div>
  );
};
