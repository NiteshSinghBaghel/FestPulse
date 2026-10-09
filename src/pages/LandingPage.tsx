import React, { useState, useRef } from 'react';
import { UserRole } from '../types';
import { FestLogo } from '../components/FestLogo';
import { 
  ChevronDown, 
  Ticket, 
  Zap, 
  CheckCircle2, 
  QrCode, 
  Calendar, 
  ShieldCheck, 
  Clock,
  Sparkles,
  RotateCcw,
  Fingerprint,
  Radio,
  MapPin,
  Flame
} from 'lucide-react';

interface LandingPageProps {
  onLogin: (role: UserRole) => void;
  onExploreEvents?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [isLoginMenuOpen, setIsLoginMenuOpen] = useState(false);
  const loginMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 3D Perspective tilt and flip state
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardRotateX, setCardRotateX] = useState(4);
  const [cardRotateY, setCardRotateY] = useState(-6);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isFlipped, setIsFlipped] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((y - centerY) / centerY) * 14;
    const rotateY = ((x - centerX) / centerX) * 14;
    setCardRotateX(rotateX);
    setCardRotateY(rotateY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    });
  };

  const handleMouseEnterCard = () => {
    setIsFlipped(true);
  };

  const handleMouseLeaveCard = () => {
    setCardRotateX(4);
    setCardRotateY(-6);
    setGlarePos({ x: 50, y: 50 });
    setIsFlipped(false);
  };

  // Top-Right Login button hover handlers
  const handleMouseEnterLogin = () => {
    if (loginMenuTimeoutRef.current) {
      clearTimeout(loginMenuTimeoutRef.current);
    }
    setIsLoginMenuOpen(true);
  };

  const handleMouseLeaveLogin = () => {
    loginMenuTimeoutRef.current = setTimeout(() => {
      setIsLoginMenuOpen(false);
    }, 200);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans relative overflow-x-hidden selection:bg-indigo-600 selection:text-white">
      
      {/* ================= ENRICHED MULTI-LAYERED AMBIENT BACKGROUND ================= */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft pastel radiant light orbs */}
        <div className="absolute -top-32 -left-32 w-[42rem] h-[42rem] bg-gradient-to-tr from-indigo-200/50 via-violet-100/40 to-transparent rounded-full blur-[110px] animate-float-particle" />
        <div className="absolute top-1/4 -right-32 w-[38rem] h-[38rem] bg-gradient-to-bl from-rose-200/40 via-purple-100/30 to-transparent rounded-full blur-[120px] animate-float-particle delay-1000" />
        <div className="absolute -bottom-32 left-1/3 w-[46rem] h-[46rem] bg-gradient-to-tr from-sky-200/40 via-teal-100/30 to-amber-100/20 rounded-full blur-[130px] animate-float-particle delay-2000" />
        
        {/* Top ambient spotlight beam */}
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-2xl" />

        {/* Modern technical dot grid */}
        <div 
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px)`,
            backgroundSize: '28px 28px'
          }}
        />

        {/* Subtle geometric crosshairs & corner accents */}
        <div className="absolute top-28 left-16 text-indigo-300/40 text-xs font-mono select-none">+ 01 / LIVE GATE</div>
        <div className="absolute top-28 right-20 text-indigo-300/40 text-xs font-mono select-none hidden lg:block">+ PASS OS 2026</div>
        <div className="absolute bottom-20 left-24 text-slate-300/60 text-xs font-mono select-none hidden sm:block">+ 150+ COLLEGES</div>
        <div className="absolute bottom-20 right-28 text-slate-300/60 text-xs font-mono select-none hidden sm:block">+ 0.8s VERIFY</div>
      </div>

      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/95 border-b border-indigo-100/80 shadow-2xs">
        {/* Subtle Brand Accent Stripe matching Logo */}
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500" />
        
        <div className="w-full px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
          
          {/* Left: Clean Brand Logo pushed to the left edge */}
          <div className="flex items-center gap-2 select-none shrink-0">
            <FestLogo size="md" variant="dark" subtitleText="🎓 Inter-College Event Network" />
          </div>

          {/* ================= TOP-RIGHT: SIMPLE TEXT "Login" PUSHED TO THE FAR RIGHT ================= */}
          <div 
            className="relative shrink-0"
            onMouseEnter={handleMouseEnterLogin}
            onMouseLeave={handleMouseLeaveLogin}
          >
            <button
              onClick={() => setIsLoginMenuOpen(!isLoginMenuOpen)}
              className="py-1 px-1 text-slate-700 hover:text-indigo-600 font-bold text-sm tracking-wide transition-colors flex items-center gap-1 cursor-pointer group"
              aria-haspopup="true"
              aria-expanded={isLoginMenuOpen}
            >
              <span className="group-hover:text-indigo-600">Login</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform duration-200 ${isLoginMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Hover Dropdown with Student Login & Host Login */}
            {isLoginMenuOpen && (
              <div 
                className="absolute right-0 top-full pt-2 w-60 sm:w-64 z-50 animate-fade-in"
                onMouseEnter={handleMouseEnterLogin}
                onMouseLeave={handleMouseLeaveLogin}
              >
                <div className="bg-white/98 backdrop-blur-xl border border-slate-200 rounded-2xl p-1.5 shadow-xl shadow-slate-300/50 text-left space-y-1">
                  
                  {/* Option 1: Student Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginMenuOpen(false);
                      onLogin('user');
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/90 text-left transition flex items-center gap-2.5 group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 block">
                        Student Login
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Browse passes & tickets
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Host Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginMenuOpen(false);
                      onLogin('host');
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-amber-50/90 text-left transition flex items-center gap-2.5 group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-amber-700 block">
                        Host Login
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Publish fests & gate scanner
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= FULL SIZE HERO SECTION WITH 3D FLIP PASS ================= */}
      <main className="relative z-10 flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-16 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Clean & Minimal Headline (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-indigo-200 text-indigo-700 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Inter-College Festival & Pass Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.12]">
              Smart Campus Passes, <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Instant Gate Entry.
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Explore upcoming tech hackathons, cultural pro-shows, and college competitions. Book anti-counterfeit digital QR passes with instant UPI verification and zero platform fees.
            </p>

            {/* Minimal Trust Checklist */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Instant UPI Passes
              </span>
              <span className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Anti-Counterfeit QR
              </span>
              <span className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
                <Zap className="w-4 h-4 text-amber-600" />
                0.8s Gate Check-in
              </span>
            </div>
          </div>

          {/* Right Column: 3D INTERACTIVE FLIP ACCESS PASS (5 Cols) */}
          <div 
            className="lg:col-span-5 flex flex-col items-center justify-center perspective-1000 py-6 select-none"
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnterCard}
            onMouseLeave={handleMouseLeaveCard}
          >
            {/* 3D Perspective Card Wrapper */}
            <div
              ref={cardRef}
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full max-w-[340px] sm:max-w-[360px] h-[490px] cursor-pointer group"
              style={{
                perspective: '1200px'
              }}
            >
              {/* Soft Chromatic Aura Glow behind the card */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/25 via-violet-400/20 to-amber-300/25 rounded-[44px] blur-2xl opacity-70 group-hover:opacity-95 transition-opacity duration-500 animate-pulse-glow" />

              {/* The 3D Flippable Container */}
              <div 
                className="w-full h-full relative transform-style-3d transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                style={{
                  transform: `rotateX(${cardRotateX}deg) rotateY(${cardRotateY + (isFlipped ? 180 : 0)}deg)`,
                  filter: 'drop-shadow(0 30px 45px rgba(99, 102, 241, 0.16))'
                }}
              >
                
                {/* ══════════════════════════════════════════════
                    FRONT FACE: Holographic Digital Access Pass
                    ══════════════════════════════════════════════ */}
                <div className="absolute inset-0 backface-hidden bg-white/90 backdrop-blur-2xl border border-white/90 rounded-[36px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] flex flex-col justify-between overflow-hidden text-slate-900">
                  
                  {/* Dynamic Light Sheen Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.85) 0%, rgba(238, 242, 255, 0.2) 40%, transparent 70%)`
                    }}
                  />

                  {/* Top Accent Stripe */}
                  <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

                  {/* Top Row: Microchip & Live Status Pill */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 relative z-10">
                    <div className="flex items-center gap-2.5">
                      {/* Metallic Golden Microchip */}
                      <div className="w-9 h-7 rounded-lg bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 p-[1.5px] shadow-xs flex items-center justify-center">
                        <div className="w-full h-full bg-amber-50/80 rounded-[6px] border border-amber-400/60 flex items-center justify-center">
                          <div className="w-4 h-3 border-y border-amber-500/50 flex items-center justify-between px-0.5">
                            <span className="w-0.5 h-1.5 bg-amber-500/60 rounded-xs" />
                            <span className="w-0.5 h-1.5 bg-amber-500/60 rounded-xs" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                          FEST+ DIGITAL PASS
                        </span>
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          All-Arena Key <Sparkles className="w-3 h-3 text-amber-500" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-bold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>GATE READY</span>
                    </div>
                  </div>

                  {/* Centerpiece: Orbital QR Laser Scanner */}
                  <div className="my-auto py-2 relative flex flex-col items-center justify-center text-center z-10">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-amber-500/10 rounded-full blur-xl" />
                      <div className="absolute inset-0 rounded-full border border-dashed border-indigo-200 animate-spin-slow" />

                      <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-b from-slate-50 to-indigo-50/60 border border-indigo-100/90 shadow-inner flex items-center justify-center overflow-hidden p-3 group-hover:scale-105 transition-transform duration-300">
                        {/* Animated Laser Scanning Beam */}
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-scan-laser pointer-events-none" />
                        <QrCode className="w-full h-full text-slate-900 stroke-[1.8]" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
                        <span>KEY: 98FC • 2026 PRO PASS</span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Campus Cultural Pro-Night
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        IIT Main Open Arena • Verified Entry
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Equalizer & Security Badge */}
                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] relative z-10">
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-2.5 bg-indigo-500 rounded-full animate-pulse" />
                      <span className="w-1 h-5 bg-indigo-600 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-3.5 bg-purple-500 rounded-full animate-pulse delay-150" />
                      <span className="w-1 h-6 bg-indigo-500 rounded-full animate-pulse delay-300" />
                      <span className="w-1 h-3 bg-violet-400 rounded-full animate-pulse delay-100" />
                      <span className="text-[10px] font-mono text-slate-400 ml-1">ENCRYPTED</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-600 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Anti-Clone Active</span>
                    </div>
                  </div>
                </div>

                {/* ══════════════════════════════════════════════
                    BACK FACE: Minimalist Identity & Security Details
                    ══════════════════════════════════════════════ */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-[36px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] flex flex-col justify-between overflow-hidden text-slate-900">
                  
                  {/* Magnetic Holographic Ribbon Strip */}
                  <div className="space-y-2">
                    <div className="h-8 w-full rounded-xl bg-gradient-to-r from-indigo-700 via-violet-600 to-amber-500 p-0.5 shadow-xs flex items-center justify-between px-3 text-white text-[9px] font-mono tracking-widest font-black">
                      <span>FEST+ CRYPTO-STRIPE</span>
                      <span>SECURE NFC</span>
                    </div>
                    <div className="h-4 w-full rounded-md bg-slate-100 border border-slate-200 flex items-center justify-between px-2 text-[8px] font-mono text-slate-400">
                      <span>SIGNATURE PANEL</span>
                      <span className="text-slate-600 font-bold">VERIFIED #23B0842</span>
                    </div>
                  </div>

                  {/* Student Identity & Gate Allocations */}
                  <div className="my-auto py-3 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-left space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Passholder:</span>
                        <span className="font-bold text-slate-900">Rohan Verma</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Institution:</span>
                        <span className="font-semibold text-indigo-700">IIT Bombay</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Gate Entrance:</span>
                        <span className="font-bold text-emerald-700">Gate 04 (Main Ramp)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Tier Allocation:</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                          VIP Golden Circle
                        </span>
                      </div>
                    </div>

                    {/* Barcode & Hash Key */}
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center space-y-1">
                      {/* Stylized Barcode */}
                      <div className="flex items-center justify-center gap-[2.5px] h-9 py-1 px-4">
                        {[4, 2, 5, 1, 3, 6, 2, 4, 1, 5, 3, 2, 6, 4, 2, 5, 1, 3, 4, 2, 6, 3, 1, 5, 2, 4, 3, 6].map((h, i) => (
                          <span 
                            key={i} 
                            className="bg-slate-900 rounded-xs"
                            style={{ 
                              width: i % 4 === 0 ? '3px' : '1.5px',
                              height: `${h * 4.5}px` 
                            }} 
                          />
                        ))}
                      </div>
                      <div className="text-[9px] font-mono font-bold text-slate-500 tracking-wider">
                        HASH: SHA256-8F24-C026-FEST-VERIFIED
                      </div>
                    </div>
                  </div>

                  {/* Back Terms & Anti-Counterfeit Guarantee */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tamper-Proof
                    </span>
                    <span className="text-indigo-600 font-bold">Flip to QR Access →</span>
                  </div>
                </div>
              </div>

              {/* Floating Companion Satellite 1 (Top-Right) */}
              <div className="absolute -top-3 -right-3 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl py-1.5 px-3 shadow-lg flex items-center gap-1.5 text-xs font-bold text-slate-800 transform translate-z-10 group-hover:scale-105 transition-transform">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>0.8s Gate Radar</span>
              </div>

              {/* Floating Companion Satellite 2 (Bottom-Left) */}
              <div className="absolute -bottom-3 -left-3 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl py-1.5 px-3 shadow-lg flex items-center gap-1.5 text-xs font-bold text-slate-800 transform translate-z-10 group-hover:scale-105 transition-transform">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Zero Fake Pass Guarantee</span>
              </div>
            </div>

            {/* Subtle Flip Hint Indicator below the card */}
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-white/70 backdrop-blur-md px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs">
              <RotateCcw className="w-3 h-3 text-indigo-600" />
              <span>Hover or tap card to flip 3D view</span>
            </div>
          </div>
        </div>
      </main>

      {/* ================= CLEAN MINIMAL FOOTER ================= */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500 border-t border-slate-200/80 bg-white/50">
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Fest+ CampusPass. All rights reserved.</p>
          <div className="flex items-center gap-3 text-slate-500">
            <span>Inter-College Festival Network</span>
            <span>•</span>
            <span className="text-indigo-600 font-semibold">24x7 Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
