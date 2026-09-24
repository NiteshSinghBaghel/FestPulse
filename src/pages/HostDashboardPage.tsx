import React, { useState } from 'react';
import { CollegeEvent, Ticket, PayoutRecord } from '../types';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { EditEventModal } from '../components/EditEventModal';
import { HostPayoutModal } from '../components/HostPayoutModal';
import { TicketSalesAnalyticsChart } from '../components/TicketSalesAnalyticsChart';
import { 
  BarChart3, 
  Users, 
  CalendarDays, 
  IndianRupee, 
  Plus, 
  QrCode, 
  CheckCircle2, 
  TrendingUp, 
  Trash2, 
  Edit3, 
  AlertOctagon, 
  ShieldCheck,
  Eye,
  Activity,
  Lock,
  ArrowRight,
  Building2,
  Smartphone,
  FileCheck,
  Clock,
  Ticket as TicketIcon,
  UserCheck
} from 'lucide-react';

interface HostDashboardPageProps {
  events: CollegeEvent[];
  currentTab?: string;
  onChangeTab?: (tab: string) => void;
  onOpenCreateEvent: () => void;
  onOpenScanner: () => void;
  onViewAttendees: (event?: CollegeEvent) => void;
  onSelectEvent: (event: CollegeEvent) => void;
  onEventsUpdated: () => void;
}

export const HostDashboardPage: React.FC<HostDashboardPageProps> = ({
  events,
  currentTab = 'host-dashboard',
  onChangeTab,
  onOpenCreateEvent,
  onOpenScanner,
  onViewAttendees,
  onSelectEvent,
  onEventsUpdated,
}) => {
  const { currentUser } = useAuth();
  
  // Synchronized with active navigation tab (Overview, My Events, Revenue Breakdown)
  const activeSubTab: 'overview' | 'events' | 'revenue' = 
    currentTab === 'host-events' ? 'events' : 
    currentTab === 'host-analytics' ? 'revenue' : 'overview';
  const [editingEvent, setEditingEvent] = useState<CollegeEvent | null>(null);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutsVersion, setPayoutsVersion] = useState(0);

  // Filter events for this host
  const hostEvents = events.filter(
    (e) => e.hostId === currentUser?.uid
  );

  const allTickets = StorageService.getTickets();
  const hostTickets = allTickets.filter(
    (t) => t.hostId === currentUser?.uid || hostEvents.some(e => e.eventId === t.eventId)
  );

  // Compute Statistics
  const totalEvents = hostEvents.length;
  const totalTicketsSold = hostEvents.reduce((acc, e) => acc + e.ticketsSold, 0);
  const totalRevenue = hostEvents.reduce((acc, e) => acc + (e.ticketsSold * e.price), 0);
  const totalCheckedIn = hostTickets.filter(t => t.entryStatus === 'entered').length;

  // Payouts & Revenue Transfers
  const hostPayouts = StorageService.getPayouts(currentUser?.uid === 'host-council-101' ? undefined : currentUser?.uid);
  const totalTransferred = hostPayouts.reduce((acc, p) => acc + p.amount, 0);
  const availableBalance = Math.max(0, totalRevenue - totalTransferred);

  // Cancellation Confirmation Modal State
  const [eventToCancel, setEventToCancel] = useState<CollegeEvent | null>(null);

  const confirmCancelEvent = () => {
    if (!eventToCancel) return;
    StorageService.updateEvent(eventToCancel.eventId, { status: 'cancelled' });
    onEventsUpdated();
    setEventToCancel(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      StorageService.deleteEvent(eventId);
      onEventsUpdated();
    }
  };

  return (
    <div className="pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              Host Administration
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{currentUser?.name}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mt-1">
            Good Day, Host 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time event ticketing, gate access scanner, attendance velocity, and financial ledger
          </p>
        </div>

        <button
          onClick={onOpenCreateEvent}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add Event</span>
        </button>
      </div>

      {/* Metric Cards Grid (Section 20) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Events</span>
            <CalendarDays className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalEvents}</p>
          <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-1 font-semibold">
            <TrendingUp className="w-3 h-3" /> Published fests
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tickets Sold</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalTicketsSold}</p>
          <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">
            Across all events
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
            <IndianRupee className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-amber-700 flex items-center gap-1 mt-1 font-semibold">
            <ShieldCheck className="w-3 h-3" /> Verified UPI settled
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Checked In</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalCheckedIn}</p>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
            Gate verified scans
          </span>
        </div>
      </div>

      {/* Host Quick Action Buttons (Add Event, Gate Scanner with animated QR scan, and Attendees Ledger) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* 1. Add Event Button */}
        <button
          onClick={onOpenCreateEvent}
          className="p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-3.5 shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition text-white">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>Add Event</span>
              <span className="text-indigo-200 text-xs font-bold">+</span>
            </div>
            <p className="text-[11px] text-indigo-100/90 truncate mt-0.5">Publish new fest, workshop or pass</p>
          </div>
        </button>

        {/* 2. Gate Scanner Button with Animated QR Scan Icon */}
        <button
          onClick={onOpenScanner}
          className="relative p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 flex items-center gap-3.5 shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] text-left group overflow-hidden"
        >
          {/* Subtle animated scan beam across card */}
          <span className="absolute inset-x-0 h-0.5 bg-white/60 shadow-[0_0_10px_white] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] top-0.5"></span>
          
          <div className="relative w-12 h-12 rounded-xl bg-slate-950/15 flex items-center justify-center text-slate-950 shrink-0 group-hover:scale-110 transition">
            <QrCode className="w-6 h-6 stroke-[2.5] animate-bounce" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>Scan Gate Passes</span>
              <span className="text-amber-950 text-xs">⚡</span>
            </div>
            <p className="text-[11px] text-amber-950/80 truncate mt-0.5">Instant camera & manual token pass verify</p>
          </div>
        </button>

        {/* 3. Attendees Ledger Button */}
        <button
          onClick={() => onViewAttendees()}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 flex items-center gap-3.5 shadow-xs hover:shadow-md transition-all transform active:scale-[0.98] text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>Registered Attendees</span>
              <span className="text-teal-600 text-xs font-bold">→</span>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">View guests & verified attendance records</p>
          </div>
        </button>
      </div>

      {/* Active Section Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pt-1 border-t border-slate-200/80">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-900">
            {activeSubTab === 'overview' && 'Live Performance & Overview'}
            {activeSubTab === 'events' && `My Organized Events (${hostEvents.length})`}
            {activeSubTab === 'revenue' && 'Revenue Breakdown & Payouts'}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            {activeSubTab === 'overview' ? 'Overview' : activeSubTab === 'events' ? 'My Events' : 'Revenue'}
          </span>
        </div>

        {onChangeTab && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
            <button
              onClick={() => onChangeTab('host-dashboard')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeSubTab === 'overview' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => onChangeTab('host-events')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeSubTab === 'events' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              My Events
            </button>
            <button
              onClick={() => onChangeTab('host-analytics')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                activeSubTab === 'revenue' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Revenue
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Real-time Recharts Analytics Card: Visualizes Ticket Sales Data Over Time */}
          <TicketSalesAnalyticsChart 
            tickets={hostTickets} 
            events={hostEvents} 
          />

          {/* Charts Row: Side-by-side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real-time Attendance & Gate Activity */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900">Live Gate Entrance Velocity</h3>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Live Gate Active
                  </span>
                </div>

                {/* Attendance Progress comparison */}
                <div className="space-y-3">
                  {hostEvents.slice(0, 3).map((e) => {
                    const checkedForThis = hostTickets.filter(t => t.eventId === e.eventId && t.entryStatus === 'entered').length;
                    const pct = e.ticketsSold > 0 ? Math.round((checkedForThis / e.ticketsSold) * 100) : 0;

                    return (
                      <div key={e.eventId} className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-bold text-slate-800 truncate max-w-[200px]">{e.title}</span>
                          <span className="text-slate-500 font-semibold">{checkedForThis} / {e.ticketsSold} scanned ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Ticket Sales Bar Chart Visualizer */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Event Ticket Distribution</h3>
                    <p className="text-[11px] text-slate-500">Sold tickets vs Available capacity</p>
                  </div>
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>

                <div className="space-y-3">
                  {hostEvents.map((evt) => {
                    const percent = Math.min(100, Math.round((evt.ticketsSold / evt.capacity) * 100));
                    return (
                      <div key={evt.eventId} className="text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-700 font-medium truncate max-w-[200px]">{evt.title}</span>
                          <span className="text-slate-500 font-mono">
                            {evt.ticketsSold} / {evt.capacity} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC & RESPONSIVE: Recent Gate Entries (User requested mobile-optimized fix) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Recent Gate Check-in Entries</h3>
                  <p className="text-[11px] text-slate-500">Live stream of student pass entries at physical entrance</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {hostTickets.filter(t => t.entryStatus === 'entered').length} Verified Entries
                </span>
                <button
                  onClick={() => onViewAttendees()}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition flex items-center gap-1"
                >
                  <span>Full Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Responsive List / Cards: Perfect fit on both mobile screens and desktops */}
            {(() => {
              const enteredTickets = hostTickets
                .filter(t => t.entryStatus === 'entered')
                .sort((a, b) => (b.entryTime || '').localeCompare(a.entryTime || ''));

              if (enteredTickets.length === 0) {
                return (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No gate check-ins recorded yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Use the "Gate Scanner" button above to verify student QR passes at the entrance.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {enteredTickets.slice(0, 10).map((ticket) => (
                    <div
                      key={ticket.ticketId}
                      className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {ticket.userName?.charAt(0) || 'S'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {ticket.userName}
                            </h4>
                            <span className="font-mono text-[10px] font-black text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {ticket.ticketId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {ticket.userEmail} {ticket.rollNo ? `• Roll: ${ticket.rollNo}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Users className="w-3 h-3" />
                          <span>{ticket.quantity || 1} {(ticket.quantity || 1) > 1 ? 'Visitors' : 'Visitor'}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{ticket.entryTime || 'Verified'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: MY EVENTS (Section 21) */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 font-medium">Manage passes, live check-ins, edits & cancellations</p>
            <button
              onClick={onOpenCreateEvent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Event</span>
            </button>
          </div>

          {hostEvents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <CalendarDays className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No events published yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create your first college fest, workshop or cultural show to start selling tickets and tracking gate entries.
              </p>
              <button
                onClick={onOpenCreateEvent}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Event Now</span>
              </button>
            </div>
          ) : (
            hostEvents.map((evt) => (
            <div
              key={evt.eventId}
              className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
            >
              <div className="flex gap-3.5 items-center min-w-0">
                <img
                  src={evt.imageUrl}
                  alt={evt.title}
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-slate-100"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {evt.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      evt.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {evt.status.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 truncate">{evt.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {evt.date} • {evt.ticketsSold}/{evt.capacity} Sold • ₹{evt.price * evt.ticketsSold} Rev
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                {/* USER MANDATE: Only the host who created the event can edit it */}
                {((evt.hostId === currentUser?.uid) || (evt.hostId === 'host-council-101' && currentUser?.uid === 'host-council-101')) ? (
                  <button
                    onClick={() => setEditingEvent(evt)}
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition"
                    title="Edit Event (Creator Only)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <span
                    className="p-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold flex items-center gap-1 cursor-not-allowed"
                    title="Only the original creator host can edit this event"
                  >
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Locked</span>
                  </span>
                )}

                <button
                  onClick={() => onSelectEvent(evt)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                  title="View Public Event Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>

                <button
                  onClick={() => onViewAttendees(evt)}
                  className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1 transition"
                  title="Manage Attendees & Entry List"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Attendees</span>
                </button>

                {evt.status !== 'cancelled' && (
                  <button
                    onClick={() => setEventToCancel(evt)}
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition"
                    title="Cancel Event"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}

                <button
                  onClick={() => handleDeleteEvent(evt.eventId)}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition"
                  title="Delete Event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: HOST REVENUE & ACCOUNT TRANSFER (User Request) */}
      {activeSubTab === 'revenue' && (
        <div className="space-y-5">
          {/* Revenue Transfer Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-indigo-800 text-white shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-wider">
                  Host Payout System
                </span>
                <h3 className="text-xl sm:text-2xl font-black mt-1">Transfer Earnings to Your Account</h3>
                <p className="text-xs text-emerald-100 max-w-md mt-0.5">
                  Direct instant settlement via UPI (GPay/PhonePe/Paytm) or Bank IMPS account transfer with zero fee.
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-xs text-emerald-200 font-medium block">Available to Transfer</span>
                <span className="text-3xl font-black text-white">₹{availableBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Verified host payout clearance • Instant bank settlement</span>
              </div>

              <button
                disabled={availableBalance <= 0}
                onClick={() => setIsPayoutModalOpen(true)}
                className="py-3 px-5 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-900 font-black text-xs transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IndianRupee className="w-4 h-4 text-emerald-700" />
                <span>Transfer Revenue to Account</span>
                <ArrowRight className="w-4 h-4 text-emerald-700" />
              </button>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Total Gross Revenue</span>
              <span className="text-2xl font-black text-slate-900 mt-0.5 block">₹{totalRevenue.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400 mt-1">{totalTicketsSold} tickets sold across all events</p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Transferred to Bank/UPI</span>
              <span className="text-2xl font-black text-indigo-600 mt-0.5 block">₹{totalTransferred.toLocaleString()}</span>
              <p className="text-[10px] text-slate-400 mt-1">{hostPayouts.length} payout transfers processed</p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] text-emerald-700 block uppercase font-bold">Pending Withdrawal</span>
              <span className="text-2xl font-black text-emerald-600 mt-0.5 block">₹{availableBalance.toLocaleString()}</span>
              <p className="text-[10px] text-emerald-600/80 mt-1">Ready for instant transfer anytime</p>
            </div>
          </div>

          {/* Real-time Recharts Analytics Card: Sales & Revenue Over Time */}
          <TicketSalesAnalyticsChart 
            tickets={hostTickets} 
            events={hostEvents} 
          />

          {/* Transfer / Payout History */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">Transfer & Payout History</h4>
                <p className="text-[11px] text-slate-500">Log of all revenue sent to your Bank or UPI</p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {hostPayouts.length} {hostPayouts.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>

            {hostPayouts.length > 0 ? (
              <div className="space-y-2">
                {hostPayouts.map((payout) => (
                  <div
                    key={payout.payoutId}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        {payout.method === 'UPI' ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{payout.destination}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                            ✓ {payout.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ref: <span className="font-mono text-slate-600">{payout.referenceId}</span> • {new Date(payout.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-base font-black text-emerald-700">₹{payout.amount.toLocaleString()}</span>
                      <p className="text-[10px] text-slate-400 font-mono">{payout.payoutId}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No revenue transfers yet. Click "Transfer Revenue to Account" above to withdraw your earnings.
              </div>
            )}
          </div>

          {/* Breakdown By Event */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
              Revenue Breakdown By Event
            </h4>
            <div className="space-y-2">
              {hostEvents.map((evt) => {
                const rev = evt.ticketsSold * evt.price;
                return (
                  <div
                    key={evt.eventId}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{evt.title}</p>
                      <p className="text-[11px] text-slate-500">{evt.ticketsSold} tickets × ₹{evt.price}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-amber-700 text-sm">₹{rev.toLocaleString()}</p>
                      <span className="text-[10px] text-emerald-600 font-semibold">100% Verified</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal (Creator Only) */}
      <EditEventModal
        isOpen={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onEventUpdated={(updated) => {
          onEventsUpdated();
          setEditingEvent(null);
        }}
      />

      {/* Host Revenue Payout / Transfer Modal */}
      <HostPayoutModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        availableBalance={availableBalance}
        onPayoutSuccess={(newPayout) => {
          setPayoutsVersion((v) => v + 1);
          onEventsUpdated();
        }}
      />

      {/* Confirmation Modal: Cancel Event */}
      {eventToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">Cancel Event?</h3>
              <p className="text-xs text-slate-600 font-medium">
                Are you sure you want to cancel <strong className="text-slate-900">"{eventToCancel.title}"</strong>?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 text-left">
                ⚠️ Once cancelled, all registered student passes will be marked as invalid at gate scanners and registrations will be halted.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEventToCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition"
              >
                No, Keep Event
              </button>
              <button
                type="button"
                onClick={confirmCancelEvent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow-sm"
              >
                Yes, Cancel Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
