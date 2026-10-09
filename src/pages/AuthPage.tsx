import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from '../components/FestLogo';
import { UserRole } from '../types';
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
  Check, 
  TrendingUp, 
  MapPin, 
  Clock, 
  ArrowLeft,
  Building2,
  BarChart3,
  Users
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
  initialRole?: UserRole;
  onBackToLanding?: () => void;
  onSwitchRole?: (role: UserRole) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ 
  onSuccess, 
  initialRole = 'user', 
  onBackToLanding,
  onSwitchRole 
}) => {
  const { login, register, resetPassword, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>(initialRole);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole]);

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

  // Switch role handler (clean switch without form selector)
  const handleRoleSwitch = (newRole: UserRole) => {
    setRole(newRole);
    setError('');
    setSuccessMsg('');
    if (onSwitchRole) {
      onSwitchRole(newRole);
    }
  };

  // Live campus ticker feed
  const [tickerIndex, setTickerIndex] = useState(0);

  const studentActivities = [
    { name: 'Rohan Verma', college: 'IIT Bombay', event: 'Oasis EDM Night Pass', time: '2m ago' },
    { name: 'Ananya Roy', college: 'BITS Pilani', event: 'HackIndia 2026 VIP Pass', time: '4m ago' },
    { name: 'Aarav Patel', college: 'IIT Delhi', event: 'Spring Fest Cult Night', time: '6m ago' },
    { name: 'Sneha Rao', college: 'SRM Chennai', event: 'RoboWars Grand Finale', time: '9m ago' },
  ];

  const hostActivities = [
    { name: 'IIT Delhi Council', college: 'Main Auditorium', event: '1,420 tickets issued', time: 'Just now' },
    { name: 'BITS Pilani Council', college: 'Gate #1 & #2', event: '580 gate entries scanned', time: '3m ago' },
    { name: 'IIT Bombay Techfest', college: 'Oasis Arena', event: '₹2,84,000 revenue settled', time: '5m ago' },
    { name: 'DTU Cultural Committee', college: 'Open Air Theatre', event: 'Live gate check-in 99.2%', time: '8m ago' },
  ];

  const currentActivities = role === 'host' ? hostActivities : studentActivities;

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % currentActivities.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [currentActivities.length]);

  // Quick 1-Click Fast Demo Login (Tailored to role, without Google login)
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

  const isHost = role === 'host';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50/40 to-rose-50/30 relative overflow-x-hidden selection:bg-indigo-600 selection:text-white flex flex-col justify-between">
      
      {/* 🌟 Animated Ambient Background Mesh & Floating Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Subtle geometric dot grid across full width */}
        <div 
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        {/* Floating Soft Pastel Blobs */}
        <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-indigo-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-rose-200/40 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-32 left-1/3 w-[36rem] h-[36rem] bg-amber-200/30 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      {/* 🧭 Top Navigation / Branding Header (Full Width) */}
      <header className="relative z-10 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-4 flex items-center justify-between border-b border-indigo-100/60 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <FestLogo 
            onClick={onBackToLanding}
            className="cursor-pointer hover:opacity-90 transition-opacity" 
          />
        </div>

        {/* Role Portal Indicator Badge */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 backdrop-blur-md px-3.5 py-1.5 rounded-full border shadow-2xs text-xs font-semibold ${
            isHost 
              ? 'bg-amber-50/90 border-amber-200 text-amber-800'
              : 'bg-indigo-50/90 border-indigo-200 text-indigo-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isHost ? 'bg-amber-500' : 'bg-emerald-500'} animate-ping`} />
            <span className={`w-2 h-2 rounded-full ${isHost ? 'bg-amber-500' : 'bg-emerald-500'} -ml-4`} />
            <span>{isHost ? '🎪 Event Host Portal' : '🎓 Student Access Portal'}</span>
          </div>
        </div>
      </header>

      {/* 🎯 Main Center Container (Full Wide Layout) */}
      <main className="relative z-10 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-10 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          
          {/* ══════════════════════════════════════════════════
              LEFT SIDE: Hero Showcase, 3D Interactive Card & Live Metrics (7 Cols)
              ══════════════════════════════════════════════════ */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center space-y-6">
            
            {/* Live Campus Activity Ticker */}
            <div className="inline-flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-indigo-100 shadow-xs rounded-full py-1.5 px-4 text-xs text-slate-700 w-fit">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHost ? 'bg-amber-400' : 'bg-rose-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isHost ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className={`font-semibold ${isHost ? 'text-amber-700' : 'text-indigo-700'}`}>
                {isHost ? 'Live Organizer Feed:' : 'Live Student Feed:'}
              </span>
              <span className="font-medium text-slate-800">
                {currentActivities[tickerIndex].name} ({currentActivities[tickerIndex].college})
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{currentActivities[tickerIndex].event}</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                isHost ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'
              }`}>
                {currentActivities[tickerIndex].time}
              </span>
            </div>

            {/* Hero Heading (Role-Tailored) */}
            <div className="space-y-3">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                isHost 
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isHost ? 'EVENT HOST & ORGANIZER PLATFORM' : 'INTER-COLLEGE STUDENT PASS NETWORK'}</span>
              </div>

              {isHost ? (
                <>
                  <h1 className="text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-[1.14]">
                    Host, Sell & Verify Passes <br />
                    <span className="bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 bg-clip-text text-transparent">
                      with Zero Platform Fees.
                    </span>
                  </h1>
                  <p className="text-slate-600 text-base max-w-xl leading-relaxed">
                    Deploy your college fest in 2 minutes. Scan attendee passes at 0.2s camera speed, track real-time admissions, and download official remittance tax invoices.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-[1.14]">
                    One Pass for All Your <br />
                    <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-500 bg-clip-text text-transparent">
                      College Fests & Hackathons.
                    </span>
                  </h1>
                  <p className="text-slate-600 text-base max-w-xl leading-relaxed">
                    Instant anti-counterfeit QR passes, seamless UPI ticketing, and superfast 0.2s camera gate check-ins across top universities.
                  </p>
                </>
              )}
            </div>

            {/* 🎟️ / 🎪 3D Holographic Card Preview (Tailored to Role) */}
            <div className="relative pt-2">
              {isHost ? (
                /* Host Organizer Command Center Card */
                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl border border-amber-200/90 rounded-3xl p-6 shadow-[0_20px_50px_rgba(245,158,11,0.12)] hover:shadow-[0_25px_60px_rgba(245,158,11,0.18)] transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/20">
                        🎪
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">HOST COMMAND CENTER • LIVE ACCESS</h4>
                        <p className="text-[10px] text-slate-500 font-medium">IIT Delhi • Cultural Fest 2026 Organizing Desk</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                      <Check className="w-3 h-3" /> SCANNER ACTIVE
                    </span>
                  </div>

                  <div className="py-4 grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Sold</span>
                      <p className="text-lg font-black text-slate-900 mt-0.5">2,450</p>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                        <TrendingUp className="w-2.5 h-2.5" /> +12% today
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Gate Checked</span>
                      <p className="text-lg font-black text-indigo-600 mt-0.5">1,890</p>
                      <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">77% arrived</span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Net Revenue</span>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">₹3.67L</p>
                      <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Ready to Settle</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono font-medium text-slate-600 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-amber-600" /> Gate Scanner Online (0.2s/scan)
                    </span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> 100% Direct Remittance
                    </span>
                  </div>
                </div>
              ) : (
                /* Student VIP Holographic Ticket Card */
                <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl border border-indigo-100 rounded-3xl p-6 shadow-[0_20px_50px_rgba(79,70,229,0.12)] hover:shadow-[0_25px_60px_rgba(79,70,229,0.18)] transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20">
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

                  <div className="py-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Attendee</span>
                      <p className="text-base font-bold text-slate-800">Aarav Sharma</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
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

                  <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono font-medium text-slate-600">PASS #VERIFIED_FEST_2026</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Fast Check-In Ready
                    </span>
                  </div>
                </div>
              )}

              {/* Floating Pill Badges */}
              <div className="absolute -top-3 right-8 bg-white/95 border border-indigo-100 shadow-md py-1 px-3.5 rounded-full flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 animate-bounce">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>⚡ Instant 0.2s Gate Check-In</span>
              </div>
              <div className="absolute -bottom-3 left-6 bg-white/95 border border-emerald-100 shadow-md py-1 px-3.5 rounded-full flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>🔥 Free Persistent Database</span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3.5 pt-2 max-w-lg">
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-2xs">
                <p className="text-xl font-black text-indigo-600">{isHost ? '0%' : '100%'}</p>
                <p className="text-[11px] text-slate-500 font-medium">{isHost ? 'Platform Fee' : 'Free Pass Storage'}</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-2xs">
                <p className="text-xl font-black text-rose-600">0.2s</p>
                <p className="text-[11px] text-slate-500 font-medium">{isHost ? 'Camera Scanner' : 'QR Gate Scan'}</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-3 text-center shadow-2xs">
                <p className="text-xl font-black text-emerald-600">{isHost ? 'Instant' : 'UPI'}</p>
                <p className="text-[11px] text-slate-500 font-medium">{isHost ? 'Bank Payouts' : 'Zero-Failure Pay'}</p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              RIGHT SIDE: Role-Specific Login Card (5 Cols, Full Width on Screen)
              ══════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-indigo-100/90 rounded-3xl p-6 sm:p-9 shadow-[0_20px_60px_rgba(79,70,229,0.09)] relative">
              
              {/* 🤖 FESTBOT: Cute Interactive Mascot with Eye-Covering Animation */}
              <div className="flex justify-center -mt-14 mb-2">
                <div className="relative group">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${
                    isHost 
                      ? 'from-amber-600 via-rose-500 to-indigo-500 shadow-amber-500/25'
                      : 'from-indigo-600 via-indigo-500 to-rose-500 shadow-indigo-500/25'
                  } p-0.5 shadow-xl`}>
                    <div className="w-full h-full bg-white rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
                      {/* Antenna */}
                      <div className={`w-1 h-2 ${isHost ? 'bg-amber-500' : 'bg-indigo-500'} -mt-1 rounded-full`} />
                      
                      {/* Bot Face */}
                      <div className="flex items-center gap-2.5 my-1">
                        {isPasswordFocused ? (
                          <>
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

                      {/* Mascot Paws covering eyes during Password focus */}
                      {isPasswordFocused && (
                        <div className="absolute inset-0 bg-indigo-50/90 flex items-center justify-center transition-all animate-bounce">
                          <span className="text-xs font-black text-indigo-700 tracking-wider">🙈 NO PEEK!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle (Strictly Role-Specific: Student vs Host) */}
              <div className="text-center mb-5">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-2.5 ${
                  isHost 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {isHost ? <Calendar className="w-3.5 h-3.5" /> : <Ticket className="w-3.5 h-3.5" />}
                  <span>{isHost ? 'Organizer / Host Login' : 'Student / Attendee Login'}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {mode === 'login' && (isHost ? 'Host Login 🎪' : 'Student Login 🎓')}
                  {mode === 'register' && (isHost ? 'Host Registration 🚀' : 'Student Registration 🚀')}
                  {mode === 'forgot' && 'Reset Password 🔑'}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {mode === 'login' && (isHost 
                    ? 'Sign in to manage your campus festivals, ticket sales & scanner.'
                    : 'Sign in to view your festival passes, tickets and gate QR codes.')}
                  {mode === 'register' && (isHost
                    ? 'Register your college council or club to publish and manage events.'
                    : 'Register your student profile to book passes and enter college fests.')}
                  {mode === 'forgot' && 'Enter your registered email to set a new password.'}
                </p>
              </div>

              {/* Quick 1-Click Fast Demo Login (Tailored to Role, NO Google Login) */}
              {mode === 'login' && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin(role)}
                    disabled={loading}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs border cursor-pointer disabled:opacity-60 ${
                      isHost
                        ? 'bg-amber-50 hover:bg-amber-100/90 text-amber-800 border-amber-200'
                        : 'bg-indigo-50 hover:bg-indigo-100/90 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${isHost ? 'text-amber-600' : 'text-indigo-600'}`} />
                    <span>{isHost ? '🎪 1-Click Host Demo Login' : '⚡ 1-Click Student Demo Login'}</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-1.5">
                    Instant one-tap login for testing without typing credentials
                  </p>
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
                    className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
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
                    className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition cursor-pointer ${
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

              {/* Form Elements (NO Role Select Inside Form) */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Full Name (Register only) */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isHost ? 'Organizer / Council Head Name' : 'Full Name'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder={isHost ? 'e.g. Cultural Committee Head' : 'e.g. Rahul Sharma'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isHost ? 'Host / Official Email Address' : 'Student Email Address'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder={isHost ? 'council@college.edu' : 'student@college.edu'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                </div>

                {/* College / Organization & Mobile (Register only) */}
                {mode === 'register' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isHost ? 'Host Council / Club' : 'College Name'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <School className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          placeholder={isHost ? 'Event Committee' : 'IIT Delhi'}
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                          className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Contact Mobile</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
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
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
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
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
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
                  className={`w-full mt-4 py-3 px-4 rounded-xl font-bold text-xs shadow-md text-white flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                    isHost
                      ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 hover:from-amber-500 hover:to-indigo-600 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 shadow-indigo-500/25'
                  }`}
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === 'login' && (isHost ? 'Sign In to Host Portal' : 'Sign In to Student Portal')}
                        {mode === 'register' && (isHost ? 'Create Host Account' : 'Create Student Account')}
                        {mode === 'forgot' && 'Reset & Update Password'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login for Forgot Password */}
              {mode === 'forgot' && (
                <div className="mt-3.5 text-center">
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
              <div className="mt-3.5 flex items-center justify-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Free Persistent DB
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" /> 0.2s Gate Verification
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 👟 Footer (Full Wide) */}
      <footer className="relative z-10 w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/40 backdrop-blur-xs">
        Fest-Plus OS • Smart Campus Ticketing & Verification Infrastructure
      </footer>
    </div>
  );
};
