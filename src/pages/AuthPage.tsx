import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  School, 
  Phone,
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  X
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, loginWithGoogle, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Google Login Dialog State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'login') {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
      const res = login(cleanEmail, password, role);
      if (!res.success) {
        setError(res.error || 'Failed to login. Please verify credentials.');
        return;
      }
      onSuccess();
    } else if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      const res = register(
        name.trim(), 
        cleanEmail, 
        password, 
        role, 
        college.trim() || (role === 'host' ? 'Campus Event Council' : 'College University'), 
        phone.trim()
      );
      if (!res.success) {
        setError(res.error || 'Registration failed.');
        return;
      }
      onSuccess();
    } else if (mode === 'forgot') {
      setForgotSent(true);
    }
  };

  const handleOpenGoogle = () => {
    setError('');
    // Pre-populate if user already typed an email
    if (email && email.includes('@')) {
      setGoogleEmail(email);
      setGoogleName(name || email.split('@')[0]);
    } else {
      setGoogleEmail(role === 'host' ? 'events.lead@campus.edu' : 'student@campus.edu');
      setGoogleName(role === 'host' ? 'Campus Event Lead' : 'Campus Student');
    }
    setShowGoogleModal(true);
  };

  const handleConfirmGoogleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail || !googleEmail.includes('@')) {
      setError('Please provide a valid Google account email.');
      return;
    }
    const cleanEmail = googleEmail.trim().toLowerCase();
    const cleanName = googleName.trim() || cleanEmail.split('@')[0];
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;

    loginWithGoogle(cleanName, cleanEmail, role, avatar);
    setShowGoogleModal(false);
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl">
        {/* Logo and Greeting */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 mx-auto flex items-center justify-center text-white text-2xl font-black shadow-md mb-3">
            CP
          </div>
          <h1 className="text-2xl font-black text-slate-900">CampusPass</h1>
          <p className="text-xs text-slate-500 mt-1">
            College Events & Digital Pass Ticketing Platform
          </p>
        </div>

        {/* Role Selection Tabs: Student vs Host */}
        <div className="mb-2">
          <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wider">
            Select Account Role for Login:
          </label>
          <div className="p-1 bg-slate-100 rounded-2xl border border-slate-200 flex gap-1">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                role === 'user'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎓 Student</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('host')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                role === 'host'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚡ Event Host</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-center">
            * Note: Role cannot be changed after login without logging out.
          </p>
        </div>

        {/* Form Title */}
        <div className="mt-4 mb-4">
          <h2 className="text-lg font-black text-slate-900">
            {mode === 'login'
              ? 'Sign In to CampusPass'
              : mode === 'register'
              ? 'Create New Account'
              : 'Reset Password'}
          </h2>
          <p className="text-xs text-slate-500">
            {mode === 'login'
              ? `Entering as ${role === 'host' ? 'Event Organizer / Host' : 'College Student'}`
              : mode === 'register'
              ? `Register as ${role === 'host' ? 'Event Host' : 'Student'} with email & password`
              : 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {mode === 'login' && error.includes('Create Account') && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('register');
                  }}
                  className="block mt-1 font-bold underline text-rose-800"
                >
                  Click here to register with this email
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {forgotSent ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-bold">Password Reset Link Dispatched</p>
            <p className="text-slate-600 mt-1">Please check your inbox at {email}.</p>
            <button
              onClick={() => {
                setForgotSent(false);
                setMode('login');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'register' && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder={role === 'host' ? 'e.g. Innovators Club Lead' : 'e.g. Rohan Verma'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">College / University</label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. IIT Delhi / Delhi University"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>
              </>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">Password *</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                {mode === 'register' && (
                  <p className="text-[10px] text-slate-400 mt-1">Minimum 6 characters</p>
                )}
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition mt-2 shadow-xs ${
                role === 'host'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <span>{mode === 'login' ? `Login as ${role === 'host' ? 'Host' : 'Student'}` : mode === 'register' ? `Register & Sign In` : 'Send Reset Link'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Divider */}
        {mode !== 'forgot' && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">OR</span>
              </div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleOpenGoogle}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-2xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google ({role === 'host' ? 'Host' : 'Student'})</span>
            </button>
          </>
        )}

        {/* Toggle Login / Register */}
        <div className="mt-5 text-center text-xs text-slate-500">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('register');
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Create Account (Sign Up)
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('login');
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Google Sign-in Interactive Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span className="font-bold text-slate-900 text-sm">Sign in with Google</span>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmGoogleAuth} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-500">
                Authenticate with your Google profile as a <strong>{role === 'host' ? 'Host' : 'Student'}</strong>:
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Alex Morgan"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Google Email</label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                  placeholder="alex@gmail.com"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs"
                >
                  Authorize Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
