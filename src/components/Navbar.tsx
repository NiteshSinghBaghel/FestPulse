import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FestLogo } from './FestLogo';
import { 
  ShieldCheck, 
  UserCheck, 
  Home, 
  Ticket as TicketIcon, 
  User, 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  BarChart3, 
  LogOut,
  ChevronDown
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
  const { currentUser, role, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Title */}
        <div 
          onClick={() => onNavigate && onNavigate(role === 'host' ? 'host-dashboard' : 'home')}
          className="cursor-pointer group select-none shrink-0"
        >
          <FestLogo 
            size="md" 
            variant="dark"
            subtitleText={role === 'host' ? '⚡ Council & Organizer Portal' : '🎓 Inter-College Events & Passes'}
          />
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
                className={`px-2.5 lg:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'host-attendees'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Users className="w-4 h-4 text-teal-600" />
                <span>Attendees<span className="hidden xl:inline"> Ledger</span></span>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('host-analytics')}
                className={`px-2.5 lg:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
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
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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

          {/* Profile Dropdown Container */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(prev => !prev)}
              className={`flex items-center gap-2 p-1 pl-1.5 rounded-full border transition cursor-pointer select-none ${
                activeTab === 'profile' || isProfileMenuOpen
                  ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
              title={currentUser?.name}
              aria-label="User profile and menu"
              aria-expanded={isProfileMenuOpen}
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
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 mr-0.5 ${
                isProfileMenuOpen ? 'rotate-180 text-indigo-600' : ''
              }`} />
            </button>

            {/* Profile Menu Dropdown Card */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User info mini header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {currentUser?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {currentUser?.email}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      role === 'host'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    }`}>
                      {role === 'host' ? '⚡ Organizer / Host' : '🎓 Student Pass Holder'}
                    </span>
                  </div>
                </div>

                {/* Dropdown Options */}
                <div className="p-1.5 space-y-1">
                  {/* Option 1: My Profile */}
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      if (onNavigate) {
                        onNavigate('profile');
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="leading-tight">My Profile</div>
                      <div className="text-[10px] font-normal text-slate-400">View & edit account details</div>
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1"></div>

                  {/* Option 2: Logout */}
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition text-left cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="leading-tight">Log Out</div>
                      <div className="text-[10px] font-normal text-rose-400">End your current session</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
