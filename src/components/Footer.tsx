import React from 'react';
import { 
  ShieldCheck, 
  Globe, 
  MessageSquare,
  Share2
} from 'lucide-react';

interface FooterProps {
  onNavigate?: (tab: string) => void;
  role?: 'user' | 'host';
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3 select-none">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                CP
              </div>
              <div>
                <span className="text-xl font-black text-white tracking-tight">CampusPass</span>
                <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Fest '26
                </span>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
              Official university ticketing and gate verification platform. Instant UPI pass issuance, verifiable cryptographically signed QR tokens, and real-time attendance velocity tracking for college campuses.
            </p>

            <div className="flex items-center gap-3 pt-2 text-slate-400">
              <span className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center transition border border-slate-700/60 cursor-pointer" title="Campus Network">
                <Globe className="w-4 h-4" />
              </span>
              <span className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center transition border border-slate-700/60 cursor-pointer" title="Discussion Forum">
                <MessageSquare className="w-4 h-4" />
              </span>
              <span className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center transition border border-slate-700/60 cursor-pointer" title="Share Portal">
                <Share2 className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Explore Events</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-indigo-400 transition">
                  Campus Fests & Cultural
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-indigo-400 transition">
                  Hackathons & Tech Summits
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-indigo-400 transition">
                  Inter-College Sports Derby
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-indigo-400 transition">
                  Music Concerts & EDM
                </button>
              </li>
            </ul>
          </div>

          {/* Platform & Host */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Host & Councils</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate && onNavigate('host-dashboard')} className="hover:text-amber-400 transition">
                  Organizer Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('host-events')} className="hover:text-amber-400 transition">
                  Manage Published Events
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('host-attendees')} className="hover:text-amber-400 transition">
                  Gate Entrance Ledger
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate && onNavigate('host-analytics')} className="hover:text-amber-400 transition">
                  Revenue & UPI Settlements
                </button>
              </li>
            </ul>
          </div>

          {/* Gate Verification & Security */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Security & Pass Tech</h3>
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero-Forgery Passes</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Every ticket comes with a unique encrypted QR Token verified locally or over gate scanners.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 CampusPass Inc. All rights reserved. Built for Inter-University Events.</p>
          <div className="flex items-center gap-6 text-[11px]">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer">Campus Guidelines</span>
            <span className="flex items-center gap-1 text-slate-400">
              Status: <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> All Systems Normal
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
