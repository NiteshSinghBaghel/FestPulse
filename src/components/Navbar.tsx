import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  UserCheck, 
  Search, 
  Home, 
  Ticket as TicketIcon, 
  User, 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  BarChart3, 
  QrCode,
  Plus
} from 'lucide-react';

interface NavbarProps {
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  onOpenScanner?: () => void;
  onOpenCreateEvent?: () => void;
  ticketCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenSearch, 
  activeTab = 'home', 
  onNavigate,
  onOpenScanner,
  onOpenCreateEvent,
  ticketCount = 0
}) => {
  const { currentUser, role } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Title */}
        <div 
          onClick={() => onNavigate && onNavigate(role === 'host' ? 'host-dashboard' : 'home')}
          className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center shadow-sm text-white font-black text-xl tracking-tight transition-transform group-hover:scale-105">
            CP
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-slate-900">
                CampusPass
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Fest '26
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden md:block">
              {role === 'host' ? '⚡ Council & Organizer Portal' : '🎓 Discover Inter-College Passes'}
            </p>
          </div>
        </div>

        {/* Center: Desktop Website Navigation Links (Visible on Tablet/Desktop md+) */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
          {role === 'user' ? (
            <>
              <button
                onClick={() => onNavigate && onNavigate('home')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'home'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Explore Events</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('my-tickets')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                  activeTab === 'my-tickets'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <TicketIcon className="w-4 h-4" />
                <span>My Tickets</span>
                {ticketCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                    {ticketCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate && onNavigate('host-dashboard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'host-dashboard'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-amber-600" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('host-events')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'host-events'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <span>Events</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('host-attendees')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'host-attendees'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Users className="w-4 h-4 text-teal-600" />
                <span>Attendees Ledger</span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('host-analytics')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'host-analytics'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Revenue</span>
              </button>
            </>
          )}
        </nav>

        {/* Right: Actions, Host Tools, Search & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Host Quick Actions in Navbar on Desktop */}
          {role === 'host' && (
            <div className="flex items-center gap-2">
              {onOpenCreateEvent && (
                <button
                  type="button"
                  onClick={onOpenCreateEvent}
                  className="p-2.5 sm:px-3 sm:py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
                  title="Add New Event"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Add Event</span>
                </button>
              )}

              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="relative p-2.5 sm:px-3 sm:py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs transition active:scale-95 group overflow-hidden"
                  title="Scan passes with Gate QR Scanner"
                >
                  {/* Subtle animated scan sweep line */}
                  <span className="absolute inset-x-0 h-0.5 bg-white/70 shadow-[0_0_8px_white] animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] top-1"></span>
                  <div className="relative">
                    <QrCode className="w-4 h-4 animate-bounce group-hover:scale-110 transition duration-300" />
                  </div>
                  <span className="hidden sm:inline font-black tracking-tight">Gate Scan</span>
                </button>
              )}
            </div>
          )}

          {/* Search Trigger */}
          {role === 'user' && onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-medium flex items-center gap-2 transition"
              aria-label="Search events"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Search events...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-400 border border-slate-200">
                /
              </kbd>
            </button>
          )}

          {/* Role Indicator Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-2xs select-none ${
              role === 'host'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            {role === 'host' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Organizer</span>
                <span className="sm:hidden">Host</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Student</span>
              </>
            )}
          </div>

          {/* Profile Button */}
          <button
            onClick={() => onNavigate && onNavigate('profile')}
            className={`flex items-center gap-2 p-1 pl-1.5 rounded-full border transition ${
              activeTab === 'profile'
                ? 'bg-indigo-50 border-indigo-400'
                : 'bg-white hover:bg-slate-50 border-slate-200'
            }`}
            title={currentUser?.name}
          >
            <span className="hidden lg:inline text-xs font-bold text-slate-700 max-w-[100px] truncate">
              {currentUser?.name?.split(' ')[0]}
            </span>
            <div className="w-8 h-8 rounded-full ring-2 ring-indigo-500/30 overflow-hidden shrink-0">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          </button>

        </div>
      </div>
    </header>
  );
};
