import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Ticket as TicketIcon, 
  User, 
  LayoutDashboard, 
  QrCode, 
  Users, 
  CalendarDays,
  BarChart3
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  ticketCount?: number;
  onOpenScanner?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  currentTab, 
  onSelectTab, 
  ticketCount = 0,
  onOpenScanner
}) => {
  const { role } = useAuth();

  if (role === 'host') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 backdrop-blur-lg border-t border-slate-200/90 px-2 pb-safe shadow-lg flex items-center">
        <div className="max-w-md w-full mx-auto flex items-center justify-around">
          <button
            onClick={() => onSelectTab('host-dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'host-dashboard' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px]">Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('host-events')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'host-events' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px]">Events</span>
          </button>

          {/* Central Highlighted Scanner Button */}
          <button
            onClick={() => onOpenScanner ? onOpenScanner() : onSelectTab('host-scanner')}
            className="flex flex-col items-center -mt-5 group"
          >
            <div className="w-13 h-13 p-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-md flex items-center justify-center transform group-hover:scale-105 transition active:scale-95">
              <QrCode className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold text-amber-700 mt-1">Scan Gate</span>
          </button>

          <button
            onClick={() => onSelectTab('host-attendees')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'host-attendees' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Attendees</span>
          </button>

          <button
            onClick={() => onSelectTab('host-analytics')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'host-analytics' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px]">Revenue</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 backdrop-blur-lg border-t border-slate-200/90 px-3 pb-safe shadow-lg flex items-center">
      <div className="max-w-md w-full mx-auto flex items-center justify-around">
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            currentTab === 'home' ? 'text-indigo-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => onSelectTab('my-tickets')}
          className={`relative flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            currentTab === 'my-tickets' ? 'text-indigo-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <TicketIcon className="w-5 h-5" />
            {ticketCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center ring-2 ring-white">
                {ticketCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">My Tickets</span>
        </button>

        <button
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            currentTab === 'profile' ? 'text-indigo-600 font-black' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </nav>
  );
};
