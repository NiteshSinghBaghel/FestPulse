import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from '../components/FestLogo';
import { UserRole } from '../types';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
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
  ShieldCheck,
  CheckCircle2,
  Zap,
  Star,
  QrCode,
  Flame,
  Radio,
  Users,
  Music,
  MapPin
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, resetPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Interactive cute mascot state (covers eyes when typing password)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);

  // Live rotating ticker state
  const [tickerIndex, setTickerIndex] = useState(0);
  const liveTickers = [
    '🔥 Priya from IIT Delhi booked VIP Pass for EDM Night (2m ago)',
    '✨ Battle of Bands 2026: 85% passes booked!',
    '🎟️ Tech Fest Hackathon Pass verified at Gate #3',
    '🚀 1,480+ digital passes issued today across colleges'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % liveTickers.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const triggerSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#ec4899', '#06b6d4', '#f59e0b', '#10b981'],
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
    <div className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col lg:flex-row relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* ================= LIGHT AMBIENT ANIMATED BACKGROUND ================= */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft pastel radiant gradient orbs */}
        <div className="absolute top-[-12%] left-[-10%] w-[55vw] h-[55vw] bg-indigo-200/40 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-rose-200/40 rounded-full blur-[130px] animate-blob animation-delay-2000" />
        <div className="absolute top-[35%] left-[25%] w-[40vw] h-[40vw] bg-sky-200/35 rounded-full blur-[110px] animate-blob animation-delay-4000" />
        
        {/* Ultra-clean delicate geometric dot grid */}
        <div 
          className="absolute inset-0 opacity-[0.4]" 
          style={{ 
            backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)', 
            backgroundSize: '32px 32px' 
          }} 
        />
      </div>

      {/* ================= LEFT COLUMN: COOL ANIMATED SHOWCASE ================= */}
      <div className="w-full lg:w-7/12 flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative z-10">
        
        {/* Top Header / Branding */}
        <div>
          <div className="flex items-center gap-3">
            <FestLogo />
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200/70 rounded-full text-[11px] font-bold text-indigo-700 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Campus Fest 3.0</span>
            </div>
          </div>

          <div className="mt-8 lg:mt-12 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-xs mb-4 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>India's #1 All-in-One College Fest & Ticketing Platform</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.18]">
              Experience College Fests <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-500 bg-clip-text text-transparent">
                Like Never Before.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
              Discover thrilling campus events, get anti-counterfeit QR passes in 1-click, and manage entries effortlessly with high-speed gate scanning.
            </p>
          </div>
        </div>

        {/* Center: Cool Floating Holographic Ticket & Interactive Cards */}
        <div className="my-8 lg:my-10 relative max-w-lg">
          
          {/* Card 1: Holographic Ticket Card (Light Theme Crisp Glass) */}
          <div className="bg-white/90 border border-indigo-100 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(79,70,229,0.12)] backdrop-blur-xl relative overflow-hidden animate-float-slow">
            
            {/* Shimmer reflection highlight */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-indigo-200/30 to-purple-200/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1.5 shadow-xs">
                  <Radio className="w-3 h-3 animate-pulse text-rose-500" /> LIVE PASS
                </span>
                <span className="text-xs text-slate-500 font-mono font-medium">PASS #FEST-2026</span>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Authenticated
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-1">
                  <Music className="w-3.5 h-3.5" /> Annual Cultural & EDM Extravaganza
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                  SYNAPSE 2026: Grand EDM & Tech Fest
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Main Arena, IIT Campus • 6:00 PM
                </p>

                {/* Animated Music Equalizer Bars */}
                <div className="mt-3.5 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
                    VIP Front Row
                  </span>
                  
                  {/* Equalizer Audio Waves */}
                  <div className="flex items-end gap-1 h-5 px-2 bg-slate-100/90 rounded-md">
                    <span className="w-1 bg-indigo-500 rounded-full animate-pulse h-2" />
                    <span className="w-1 bg-purple-500 rounded-full animate-pulse h-4" />
                    <span className="w-1 bg-rose-500 rounded-full animate-pulse h-5" />
                    <span className="w-1 bg-indigo-500 rounded-full animate-pulse h-3" />
                    <span className="w-1 bg-purple-500 rounded-full animate-pulse h-4" />
                  </div>
                </div>
              </div>

              {/* Dynamic Crisp QR Code with Anti-counterfeit Border */}
              <div className="shrink-0 p-3 bg-white border border-slate-200/90 rounded-2xl shadow-md flex flex-col items-center justify-center hover:scale-105 transition-transform duration-300">
                <QrCode className="w-14 h-14 text-indigo-950" />
                <span className="text-[8px] font-black uppercase text-indigo-600 tracking-wider mt-1">FAST GATE SCAN</span>
              </div>
            </div>
          </div>

          {/* Floating Cool Pill 1 (Check-in Speed) */}
          <div className="absolute -bottom-4 -left-3 sm:left-4 bg-white/95 border border-slate-200/90 rounded-2xl p-2.5 px-4 shadow-[0_10px_25px_rgba(0,0,0,0.06)] backdrop-blur-md flex items-center gap-3 animate-float-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-xs">
              ⚡
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">Instant 0.2s Check-In</p>
              <p className="text-[10px] text-slate-500">Camera QR code scanner</p>
            </div>
          </div>

          {/* Floating Cool Pill 2 (Live Database Sync) */}
          <div className="hidden sm:flex absolute -top-5 -right-3 bg-white/95 border border-slate-200/90 rounded-2xl p-2.5 px-4 shadow-[0_10px_25px_rgba(0,0,0,0.06)] backdrop-blur-md items-center gap-3 animate-float-gentle">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shadow-xs">
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">Free Persistent Database</p>
              <p className="text-[10px] text-slate-500">Zero data loss guarantee</p>
            </div>
          </div>
        </div>

        {/* Bottom Feature Statistics & Live Activity Bar */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white/80 border border-slate-200/80 rounded-2xl shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-base">
                <Users className="w-4 h-4" /> 50,000+
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Students Registered</p>
            </div>

            <div className="p-3.5 bg-white/80 border border-slate-200/80 rounded-2xl shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-purple-600 font-extrabold text-base">
                <Calendar className="w-4 h-4" /> 120+ Fests
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Hosted Across Campuses</p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 bg-white/80 border border-slate-200/80 rounded-2xl shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-base">
                <ShieldCheck className="w-4 h-4" /> 100% Secure
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Anti-Fraud Pass Tech</p>
            </div>
          </div>

          {/* Live Activity Feed Bar */}
          <div className="p-2.5 px-4 bg-white/90 border border-indigo-100 rounded-xl flex items-center gap-2.5 text-xs text-slate-700 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-bold text-indigo-600 shrink-0">Live Updates:</span>
            <span className="truncate text-slate-600">{liveTickers[tickerIndex]}</span>
          </div>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: CRISP LIGHT AUTH PORTAL ================= */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative z-10 bg-white/60 lg:border-l lg:border-indigo-100/70 backdrop-blur-xl">
        
        <div className="w-full max-w-md relative my-auto">
          
          {/* ================= COOL INTERACTIVE MASCOT (LIGHT THEME) ================= */}
          <div className="flex justify-center -mb-7 relative z-20 pointer-events-none select-none">
            <div className="relative w-28 h-28 flex items-center justify-center animate-cute-bounce">
              <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_12px_24px_rgba(79,70,229,0.2)] transition-all duration-300">
                {/* Soft glow circle behind mascot */}
                <circle cx="50" cy="50" r="45" fill="rgba(99, 102, 241, 0.12)" filter="blur(6px)" />
                
                {/* Mascot Head */}
                <circle cx="50" cy="50" r="40" fill="#ffffff" stroke="#4f46e5" strokeWidth="3.5" />
                
                {/* Cute Ears */}
                <circle cx="22" cy="22" r="13" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2.5" />
                <circle cx="78" cy="22" r="13" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2.5" />
                <circle cx="22" cy="22" r="6" fill="#f43f5e" />
                <circle cx="78" cy="22" r="6" fill="#f43f5e" />

                {/* Antenna / Party Star */}
                <path d="M50 10 L50 2" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="50" cy="2" r="3.5" fill="#f59e0b" />

                {/* Soft Cheeks */}
                <ellipse cx="28" cy="62" rx="5.5" ry="3.5" fill="#fb7185" opacity="0.6" />
                <ellipse cx="72" cy="62" rx="5.5" ry="3.5" fill="#fb7185" opacity="0.6" />

                {/* Eyes - When Password is focused, mascot covers eyes! */}
                {!isPasswordFocused ? (
                  <>
                    <ellipse cx="36" cy="48" rx="5.5" ry="7" fill="#1e1b4b" />
                    <circle cx="38" cy="46" r="2.5" fill="#ffffff" />
                    <circle cx="35" cy="51" r="1" fill="#ffffff" />

                    <ellipse cx="64" cy="48" rx="5.5" ry="7" fill="#1e1b4b" />
                    <circle cx="66" cy="46" r="2.5" fill="#ffffff" />
                    <circle cx="63" cy="51" r="1" fill="#ffffff" />
                  </>
                ) : (
                  <>
                    {/* Shy / Closed Happy Peeking Eyes (^ ^) */}
                    <path d="M30 49 Q36 43 42 49" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M58 49 Q64 43 70 49" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  </>
                )}

                {/* Smiling Mouth */}
                <path d="M44 63 Q50 69 56 63" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                {/* Little Paws / Hands covering eyes during password entry */}
                {isPasswordFocused && (
                  <g className="animate-pulse-subtle">
                    <ellipse cx="34" cy="46" rx="9" ry="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2" />
                    <ellipse cx="66" cy="46" rx="9" ry="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2" />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* ================= MAIN AUTH CARD (LIGHT CRISP GLASS) ================= */}
          <div className="bg-white/95 border border-indigo-100 rounded-3xl p-6 sm:p-9 pt-10 backdrop-blur-2xl shadow-[0_20px_60px_rgba(79,70,229,0.09)] relative text-slate-800">
            
            {/* Header Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                {mode === 'login' && 'Welcome Back 👋'}
                {mode === 'register' && 'Create Your Account 🚀'}
                {mode === 'forgot' && 'Reset Password 🔐'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'login' && 'Sign in to access your booked passes and host portal'}
                {mode === 'register' && 'Register in seconds — stored permanently in free database'}
                {mode === 'forgot' && 'Enter your registered email and choose a new password'}
              </p>
            </div>

            {/* Role Switcher (Student vs Host) */}
            {mode !== 'forgot' && (
              <div className="mb-5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 flex gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'user'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
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
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>College / Host</span>
                </button>
              </div>
            )}

            {/* Tab Switching: Sign In vs Create Account */}
            {mode !== 'forgot' && (
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                    mode === 'login'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
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
                  className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                    mode === 'register'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Full Name (On Register) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                  />
                </div>
              </div>

              {/* College & Phone on Register */}
              {mode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {role === 'host' ? 'Club / Committee' : 'College / Campus'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <School className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder={role === 'host' ? 'Cultural Committee' : 'IIT Delhi'}
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile (Optional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Password */}
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
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password (For Forgot Password) */}
              {mode === 'forgot' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In'}
                      {mode === 'register' && 'Create Account'}
                      {mode === 'forgot' && 'Reset & Update Password'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Back button for Forgot Password */}
            {mode === 'forgot' && (
              <div className="mt-4 text-center">
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

            {/* Bottom Trust & Feature Badges */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Persistent DB
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-indigo-600" /> Instant Access
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500" /> 100% Free
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
