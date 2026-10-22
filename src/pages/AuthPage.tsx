import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from '../components/FestLogo';
import { UserRole } from '../types';
import { firebaseVerifyPasswordResetCode, getFirebaseErrorMessage } from '../services/firebase';
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
  Users,
  Home,
  Send,
  KeyRound,
  RotateCcw,
  Copy,
  ExternalLink
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
  const { 
    login, 
    register, 
    resetPassword, 
    sendPasswordResetLink, 
    confirmPasswordResetWithCode, 
    loginWithGoogle 
  } = useAuth();

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
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [showConfirmRegisterPassword, setShowConfirmRegisterPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [generatedResetLink, setGeneratedResetLink] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Check if user reached this page via an official password reset email link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash);
      
      const oobCode = searchParams.get('oobCode') || hashParams.get('oobCode');
      const resetToken = searchParams.get('resetToken') || hashParams.get('resetToken');
      const action = searchParams.get('mode') || hashParams.get('mode');

      const incomingCode = resetToken || oobCode;

      if (incomingCode && (action === 'resetPassword' || !action || resetToken)) {
        setResetCode(incomingCode);
        setMode('forgot');
        setLoading(true);

        // If it's a server resetToken, verify it with server
        if (incomingCode.startsWith('prt_')) {
          fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(incomingCode)}`)
            .then(res => res.json())
            .then(data => {
              setLoading(false);
              if (data.valid) {
                if (data.email) {
                  setEmail(data.email);
                }
                if (data.role) {
                  setRole(data.role as UserRole);
                }
                setSuccessMsg(`✓ Reset link verified for ${data.email}. Please set your new password.`);
              } else {
                setError(data.error || 'This password reset link is invalid or has expired. Please request a new link.');
                setResetCode(null);
              }
            })
            .catch(() => {
              setLoading(false);
              setError('Failed to verify reset link. Please try requesting a new link.');
              setResetCode(null);
            });
        } else {
          // Firebase oobCode - verify code and extract registered email
          firebaseVerifyPasswordResetCode(incomingCode)
            .then((extractedEmail) => {
              setLoading(false);
              if (extractedEmail) {
                setEmail(extractedEmail);
                setSuccessMsg(`✓ Secure reset link verified for ${extractedEmail}. Please set your new password.`);
              } else {
                setSuccessMsg('✓ Secure reset link verified! Please set your new password.');
              }
            })
            .catch((err) => {
              setLoading(false);
              setError(getFirebaseErrorMessage(err));
              setResetCode(null);
            });
        }
      }
    }
  }, []);

  // Switch role handler (clean switch without form selector)
  const handleRoleSwitch = (newRole: UserRole) => {
    setRole(newRole);
    setError('');
    setSuccessMsg('');
    if (onSwitchRole) {
      onSwitchRole(newRole);
    }
  };

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
        if (password !== confirmRegisterPassword) {
          setError('Passwords do not match. Please verify your confirm password.');
          setLoading(false);
          return;
        }
        const cleanPhone = phone.trim().replace(/[\s\-()+]/g, '');
        if (!cleanPhone) {
          setError('Mobile number is required. Please enter your 10-digit mobile number.');
          setLoading(false);
          return;
        }
        if (!/^[0-9]{10}$/.test(cleanPhone)) {
          setError('Please enter a valid 10-digit mobile number (e.g., 9876543210).');
          setLoading(false);
          return;
        }
        const res = await register(
          name.trim(), 
          cleanEmail, 
          password, 
          role, 
          college.trim() || (role === 'host' ? 'Campus Event Council' : 'College Student'), 
          cleanPhone
        );
        if (!res.success) {
          setError(res.error || 'Registration failed.');
          setLoading(false);
          return;
        }
        onSuccess();
      } else if (mode === 'forgot') {
        if (resetCode) {
          // User opened email reset link with resetToken or oobCode -> change password
          if (!newPassword || newPassword.length < 6) {
            setError('Please enter a new password (min 6 characters).');
            setLoading(false);
            return;
          }
          if (newPassword !== confirmNewPassword) {
            setError('Passwords do not match. Please re-enter.');
            setLoading(false);
            return;
          }
          const res = await confirmPasswordResetWithCode(resetCode, newPassword, email);
          if (!res.success) {
            setError(res.error || 'Password reset failed. The link may have expired or already been used.');
            setLoading(false);
            return;
          }
          setSuccessMsg('Saved successfully');
          setResetCode(null);
          // Clean the query parameters from URL
          if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setMode('login');
          setPassword(newPassword);
          setNewPassword('');
          setConfirmNewPassword('');
        } else {
          // User submits email to receive genuine reset link
          if (!cleanEmail || !cleanEmail.includes('@')) {
            setError('Please enter a valid email address.');
            setLoading(false);
            return;
          }
          const res = await sendPasswordResetLink(cleanEmail, role);
          if (!res.success) {
            setError(res.error || 'Failed to send password reset email.');
            setLoading(false);
            return;
          }
          setResetEmailSent(true);
          if (res.resetLink) {
            setGeneratedResetLink(res.resetLink);
          }
          setSuccessMsg('Check email, reset link sent successfully');
        }
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
        <div className="flex items-center gap-3 sm:gap-5">
          <FestLogo 
            onClick={onBackToLanding}
            className="cursor-pointer hover:opacity-90 transition-opacity" 
          />

          {/* Home Link Option for Both Roles - Increased Size */}
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-2 px-4 py-2 sm:px-4.5 sm:py-2.5 rounded-xl text-sm sm:text-base font-bold text-slate-700 hover:text-indigo-600 bg-white/80 hover:bg-white border border-slate-200/80 hover:border-indigo-200 transition shadow-xs hover:shadow-sm cursor-pointer group"
            title="Return to Home"
          >
            <Home className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            <span className="font-semibold text-slate-800 group-hover:text-indigo-600">Home</span>
          </button>
        </div>

        {/* Right: Role Portal Indicator Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Role Portal Indicator Badge */}
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
              
              {/* Back to Home button on top corner of the card */}
              <div className="absolute top-4 left-4 z-10">
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/90 border border-slate-200/70 transition shadow-2xs cursor-pointer group"
                  title="Return to Home"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Home</span>
                </button>
              </div>

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
                  {mode === 'forgot' && (resetCode ? 'Set New Password 🔐' : 'Reset Password 🔑')}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {mode === 'login' && (isHost 
                    ? 'Sign in to manage your campus festivals, ticket sales & scanner.'
                    : 'Sign in to view your festival passes, tickets and gate QR codes.')}
                  {mode === 'register' && (isHost
                    ? 'Register your college council or club to publish and manage events.'
                    : 'Register your student profile to book passes and enter college fests.')}
                  {mode === 'forgot' && (resetCode
                    ? 'Enter and confirm your new account password.'
                    : 'Enter your registered email and we will send a password reset link to it.')}
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
                      setConfirmRegisterPassword('');
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
                      setConfirmRegisterPassword('');
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

              {/* MODE FORGOT: Email Sent Confirmation View */}
              {mode === 'forgot' && resetEmailSent && !resetCode ? (
                <div className="py-4 text-center space-y-4 animate-fadeIn">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <Mail className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900">Check Your Email! 📩</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      A secure password reset link has been dispatched to:
                    </p>
                    <div className="mt-2 inline-block px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs">
                      {email.trim().toLowerCase()}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>Open the password reset email in your inbox.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>Click the <strong>Reset Password</strong> link inside the email.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                      <span>Enter and save your new password to complete the change.</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Didn't receive the email? Check your <strong>Spam / Junk</strong> folder or click resend.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmailSent(false);
                        setMode('login');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                    >
                      &larr; Back to Sign In
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setError('');
                        setLoading(true);
                        const res = await sendPasswordResetLink(email.trim().toLowerCase(), role);
                        setLoading(false);
                        if (res.success) {
                          setSuccessMsg('Check email, reset link sent successfully');
                        } else {
                          setError(res.error || 'Failed to resend link.');
                        }
                      }}
                      disabled={loading}
                      className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200 cursor-pointer"
                    >
                      {loading ? 'Sending...' : 'Resend Link'}
                    </button>
                  </div>

                  {generatedResetLink && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-indigo-600" />
                          Official Dispatched Reset Link:
                        </span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                          Active (1 Hr)
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-left font-mono text-[11px] text-slate-600 flex items-center justify-between gap-2">
                        <span className="truncate flex-1">{generatedResetLink}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedResetLink);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2500);
                          }}
                          className="shrink-0 p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 transition shadow-2xs cursor-pointer flex items-center gap-1 text-[10px] font-sans font-bold"
                          title="Copy Link"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = generatedResetLink;
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Open Reset Link (Simulate Opening Email Link)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Form Elements (NO Role Select Inside Form) */
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* Forgot Mode Guidance Notice */}
                  {mode === 'forgot' && !resetCode && (
                    <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
                      <Send className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        Enter your registered {isHost ? 'Host / Organizer' : 'Student'} email address. We will verify your registration and dispatch a secure password reset link to your email inbox.
                      </span>
                    </div>
                  )}

                  {/* Reset Code Verified Notice */}
                  {mode === 'forgot' && resetCode && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Email Reset Link Verified!</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Account: <strong className="font-mono">{email}</strong> ({isHost ? 'Host Portal' : 'Student Portal'})
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        Please enter and confirm your new password below to update your credentials.
                      </p>
                    </div>
                  )}
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
                {/* Email / Mobile Address */}
                {(mode !== 'forgot' || !resetCode) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {mode === 'forgot'
                        ? 'Enter Your Registered Email Address'
                        : mode === 'login'
                        ? (isHost ? 'Host Email Address or 10-Digit Mobile' : 'Student Email Address or 10-Digit Mobile')
                        : (isHost ? 'Host / Official Email Address' : 'Student Email Address')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder={
                          mode === 'forgot'
                            ? 'Enter email to receive reset link'
                            : mode === 'login'
                            ? (isHost ? 'council@college.edu or 9876543210' : 'student@college.edu or 9876543210')
                            : (isHost ? 'council@college.edu' : 'student@college.edu')
                        }
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Host Organization & Mobile OR Student Mobile (Register only) */}
                {mode === 'register' && (
                  isHost ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Host Council / Club
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            <School className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            placeholder="Event Committee"
                            value={college}
                            onChange={(e) => setCollege(e.target.value)}
                            className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Contact Mobile * <span className="text-[10px] text-indigo-600 font-semibold">(10 Digits)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="tel"
                            required
                            placeholder="9876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Mobile * <span className="text-[10px] text-indigo-600 font-semibold">(10 Digits Required)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9876543210 (10-digit mobile number)"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                      </div>
                    </div>
                  )
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

                {/* Confirm Password (Register mode only: verify password is typed correctly) */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmRegisterPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-enter your password to confirm"
                        value={confirmRegisterPassword}
                        onChange={(e) => setConfirmRegisterPassword(e.target.value)}
                        className={`w-full pl-9 pr-9 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition ${
                          confirmRegisterPassword
                            ? password === confirmRegisterPassword
                              ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
                              : 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                            : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmRegisterPassword(!showConfirmRegisterPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showConfirmRegisterPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {confirmRegisterPassword && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
                        {password === confirmRegisterPassword ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-500" /> Passwords do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* New Password and Confirm Password fields (ONLY in forgot mode when resetCode is present) */}
                {mode === 'forgot' && resetCode && (
                  <div className="space-y-3">
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

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showConfirmNewPassword ? 'text' : 'password'}
                          required
                          placeholder="Re-enter new password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
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
                        {mode === 'forgot' && (resetCode ? 'Save New Password & Sign In' : 'Send Password Reset Link')}
                      </span>
                      {mode === 'forgot' && !resetCode ? (
                        <Send className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                    </>
                  )}
                </button>
              </form>
            )}

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
