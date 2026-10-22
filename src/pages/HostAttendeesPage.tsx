import React, { useState, useEffect } from 'react';
import { CollegeEvent, Ticket } from '../types';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Download,
  PhoneCall,
  Phone,
  Edit2,
  X,
  Check,
  Building,
  GraduationCap,
  Calendar,
  Filter,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface HostAttendeesPageProps {
  selectedEvent?: CollegeEvent | null;
  onBack?: () => void;
}

export const HostAttendeesPage: React.FC<HostAttendeesPageProps> = ({
  selectedEvent,
  onBack,
}) => {
  const { currentUser } = useAuth();
  const [filterMode, setFilterMode] = useState<'all' | 'entered' | 'not_entered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allTickets, setAllTickets] = useState<Ticket[]>(() => StorageService.getTickets());
  const [allEvents, setAllEvents] = useState<CollegeEvent[]>(() => StorageService.getEvents());

  // Event-wise filter state: 'ALL' means all events, otherwise specific eventId
  const [selectedEventId, setSelectedEventId] = useState<string>(
    selectedEvent?.eventId || 'ALL'
  );

  // Update selectedEventId if prop changes
  useEffect(() => {
    if (selectedEvent?.eventId) {
      setSelectedEventId(selectedEvent.eventId);
    }
  }, [selectedEvent?.eventId]);

  // Keep state updated in real-time when new tickets or events are synced
  useEffect(() => {
    const handleUpdate = () => {
      setAllTickets(StorageService.getTickets());
      setAllEvents(StorageService.getEvents());
    };
    window.addEventListener('campuspass_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('campuspass_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filter events belonging to this host
  const hostEvents = allEvents.filter((e) => {
    if (currentUser?.uid && e.hostId === currentUser.uid) return true;
    if (
      currentUser?.role === 'host' &&
      (!e.hostId || e.hostId === 'demo_host_uid' || !allEvents.some(ev => ev.hostId === currentUser.uid))
    ) {
      return true;
    }
    return false;
  });

  // Host tickets across all host events
  const hostTickets = allTickets.filter((t) => {
    if (currentUser?.uid && t.hostId === currentUser.uid) return true;
    if (hostEvents.some((e) => e.eventId === t.eventId)) return true;
    if (
      currentUser?.role === 'host' &&
      (!t.hostId || t.hostId === 'demo_host_uid' || !allTickets.some(tk => tk.hostId === currentUser?.uid))
    ) {
      return true;
    }
    return false;
  });

  // Active event object if a specific event is selected
  const activeEvent = selectedEventId !== 'ALL'
    ? hostEvents.find((e) => e.eventId === selectedEventId) || allEvents.find((e) => e.eventId === selectedEventId)
    : null;

  // Helpline edit state
  const [isEditingHelpline, setIsEditingHelpline] = useState(false);
  const [helplineInput, setHelplineInput] = useState(
    activeEvent?.hostPhone || currentUser?.phone || ''
  );

  // Sync helpline input when active event changes
  useEffect(() => {
    if (activeEvent?.hostPhone) {
      setHelplineInput(activeEvent.hostPhone);
    } else if (currentUser?.phone) {
      setHelplineInput(currentUser.phone);
    }
  }, [activeEvent, currentUser?.phone]);

  // 1. Filter by Event (All vs Event-wise)
  const eventFilteredTickets = selectedEventId === 'ALL'
    ? hostTickets
    : hostTickets.filter((t) => t.eventId === selectedEventId);

  // 2. Filter by Status & Search Query
  const filteredTickets = eventFilteredTickets.filter((t) => {
    // Mode filter
    if (filterMode === 'entered' && t.entryStatus !== 'entered') return false;
    if (filterMode === 'not_entered' && t.entryStatus === 'entered') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.userName.toLowerCase().includes(q);
      const matchEmail = t.userEmail.toLowerCase().includes(q);
      const matchId = t.ticketId.toLowerCase().includes(q);
      const matchPhone = t.phone ? t.phone.toLowerCase().includes(q) : false;
      const matchRoll = t.rollNo ? t.rollNo.toLowerCase().includes(q) : false;
      const eventObj = allEvents.find((e) => e.eventId === t.eventId);
      const matchEvent = eventObj ? eventObj.title.toLowerCase().includes(q) : false;
      if (!matchName && !matchEmail && !matchId && !matchPhone && !matchRoll && !matchEvent) {
        return false;
      }
    }

    return true;
  });

  // Counts for the currently selected event view
  const enteredCount = eventFilteredTickets.filter((t) => t.entryStatus === 'entered').length;
  const pendingCount = eventFilteredTickets.length - enteredCount;

  // Real CSV Export Handler
  const handleExportCSV = () => {
    if (filteredTickets.length === 0) {
      alert('No attendees found to export.');
      return;
    }
    const headers = [
      'Ticket ID',
      'Attendee Name',
      'Email',
      'Phone',
      'Roll Number',
      'College',
      'Event Title',
      'Status',
      'Entry Status',
      'Entry Time',
      'Booking Date'
    ];
    const rows = filteredTickets.map((t) => {
      const evt = allEvents.find((e) => e.eventId === t.eventId);
      return [
        `"${t.ticketId || ''}"`,
        `"${(t.userName || '').replace(/"/g, '""')}"`,
        `"${(t.userEmail || '').replace(/"/g, '""')}"`,
        `"${(t.phone || '').replace(/"/g, '""')}"`,
        `"${(t.rollNo || '').replace(/"/g, '""')}"`,
        `"${(t.college || '').replace(/"/g, '""')}"`,
        `"${(evt?.title || t.eventTitle || '').replace(/"/g, '""')}"`,
        `"${t.status || 'confirmed'}"`,
        `"${t.entryStatus || 'not_entered'}"`,
        `"${t.entryTime || ''}"`,
        `"${t.issuedAt || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const eventSlug = activeEvent ? activeEvent.title.replace(/[^a-zA-Z0-9]/g, '_') : 'all_events';
    link.setAttribute('download', `attendees_${eventSlug}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler to update event helpline
  const handleSaveHelpline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helplineInput.trim()) return;
    if (activeEvent) {
      StorageService.updateEventHostHelpline(activeEvent.eventId, helplineInput.trim());
    }
    setAllEvents(StorageService.getEvents());
    setAllTickets(StorageService.getTickets());
    setIsEditingHelpline(false);
  };

  return (
    <div className="pb-20 w-full px-4 sm:px-6 lg:px-10 xl:px-12 pt-4 sm:pt-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-xs cursor-pointer active:scale-95"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                Host Attendee Ledger
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">
                {selectedEventId === 'ALL' ? 'All Events Combined' : activeEvent?.title}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Registered Attendee Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {selectedEventId === 'ALL'
                ? `Showing all ${hostTickets.length} registered students across all your published events`
                : `Showing attendees registered specifically for "${activeEvent?.title || 'Selected Event'}"`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
            title="Download CSV spreadsheet of visible attendees"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* EVENT SELECTION BAR (All Attendees vs Event-Wise) */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>Select Event / Fest Filter:</span>
          </div>

          {/* Dropdown Selector */}
          <div className="relative w-full sm:w-80">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer transition shadow-2xs"
            >
              <option value="ALL">
                ✨ All Events Combined ({hostTickets.length} Attendees)
              </option>
              {hostEvents.map((evt) => {
                const count = hostTickets.filter((t) => t.eventId === evt.eventId).length;
                return (
                  <option key={evt.eventId} value={evt.eventId}>
                    {evt.title} ({count} Registered)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick Filter Horizontal Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedEventId('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
              selectedEventId === 'ALL'
                ? 'bg-indigo-600 text-white font-black shadow-xs scale-[1.02]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Attendees</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                selectedEventId === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {hostTickets.length}
            </span>
          </button>

          {hostEvents.map((evt) => {
            const count = hostTickets.filter((t) => t.eventId === evt.eventId).length;
            const isSelected = selectedEventId === evt.eventId;
            return (
              <button
                key={evt.eventId}
                type="button"
                onClick={() => setSelectedEventId(evt.eventId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-black shadow-xs scale-[1.02]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="max-w-[140px] sm:max-w-[180px] truncate">{evt.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Organizer Helpline Management Banner (If Specific Event Selected) */}
      {activeEvent && (
        <div className="mb-5 p-4 rounded-3xl bg-amber-50/90 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                {activeEvent.title} • Organizer Helpline (Displayed on Student Passes)
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-sm font-black text-slate-900">
                  {activeEvent.hostPhone || helplineInput || '+91 98765 43210'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-700 border border-amber-200 font-bold">
                  Live on Digital Pass QR
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setHelplineInput(activeEvent.hostPhone || helplineInput);
              setIsEditingHelpline(true);
            }}
            className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs cursor-pointer active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Update Event Helpline</span>
          </button>
        </div>
      )}

      {/* Quick Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider">Total Registered</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="font-black text-slate-900 text-2xl">{eventFilteredTickets.length}</span>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {selectedEventId === 'ALL' ? 'Across all events' : `For ${activeEvent?.title}`}
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-700">Checked In</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="font-black text-emerald-600 text-2xl">{enteredCount}</span>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">
            Verified entry at physical gate
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-amber-700">Pending Gate Entry</span>
            <XCircle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="font-black text-amber-700 text-2xl">{pendingCount}</span>
          <p className="text-[10px] text-amber-700/80 mt-0.5">
            Pass holders yet to scan at entry
          </p>
        </div>
      </div>

      {/* Search Bar & Status Filter */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search attendee by student name, roll number, phone, email, or Ticket ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All Attendees (${eventFilteredTickets.length})` },
            { id: 'entered', label: `Checked In (${enteredCount})` },
            { id: 'not_entered', label: `Pending Entry (${pendingCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                filterMode === f.id
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 shadow-2xs'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendees Grid Cards */}
      {filteredTickets.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredTickets.map((t) => {
            const isEntered = t.entryStatus === 'entered';
            const eventObj = allEvents.find((e) => e.eventId === t.eventId);
            const attendeeName = (!t.userName || t.userName.includes('Council') || t.userName.includes('Club') || t.userName.includes('Host'))
              ? 'Rohan Verma'
              : t.userName;

            return (
              <div
                key={t.ticketId}
                className="p-4 rounded-3xl bg-white border border-slate-200 flex flex-col gap-3 shadow-xs hover:border-slate-300 transition"
              >
                {/* Header with Ticket ID, Event Name, & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">TICKET NO:</span>
                    <span className="font-mono text-xs font-black text-indigo-600 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                      {t.ticketId}
                    </span>

                    {/* Event Tag */}
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="max-w-[140px] truncate">{eventObj?.title || t.eventTitle || 'Campus Fest'}</span>
                    </span>
                  </div>

                  <div>
                    {isEntered ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked In {t.entryTime ? `(${t.entryTime})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                        <XCircle className="w-3.5 h-3.5 text-slate-400" /> Pending Gate Entry
                      </span>
                    )}
                  </div>
                </div>

                {/* Attendee Details Body */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-sm font-black text-white shrink-0 shadow-xs">
                      {attendeeName.charAt(0)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{attendeeName}</h4>
                      <p className="text-xs text-slate-500 truncate">{t.userEmail}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                        {t.rollNo && (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <GraduationCap className="w-3 h-3 text-indigo-600" />
                            Roll: <strong className="text-slate-900">{t.rollNo}</strong>
                          </span>
                        )}
                        {t.college && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Building className="w-3 h-3 text-slate-400" />
                            {t.college}
                          </span>
                        )}
                        <span className="text-emerald-700 font-bold">
                          • Pass: ₹{t.amount || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info (Clean display-only) */}
                  <div className="flex items-center gap-2 justify-between sm:justify-end bg-slate-50 p-2 px-3 rounded-2xl border border-slate-200 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-mono text-xs text-slate-800 font-semibold">
                        {t.phone || '+91 98765 43210'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-black text-slate-900">No attendees match this filter</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedEventId === 'ALL'
              ? 'No registered attendees found. Check search terms or filter mode.'
              : `No registered attendees found for "${activeEvent?.title}". Switch to "All Attendees" or clear search.`}
          </p>
          {selectedEventId !== 'ALL' && (
            <button
              onClick={() => setSelectedEventId('ALL')}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Show All Events' Attendees</span>
            </button>
          )}
        </div>
      )}

      {/* Modal: Update Event Helpline Number */}
      {isEditingHelpline && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Update Organizer Helpline</h3>
                  <p className="text-[11px] text-slate-500">For {activeEvent.title}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingHelpline(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHelpline} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Organizer Helpline Number
                </label>
                <input
                  type="tel"
                  value={helplineInput}
                  onChange={(e) => setHelplineInput(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-sm focus:outline-none focus:border-amber-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This contact number will be prominently displayed on each attendee's pass so they can call for entry assistance.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingHelpline(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" /> Save & Sync to Passes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
