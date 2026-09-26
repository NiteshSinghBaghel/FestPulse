import React, { useState } from 'react';
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
  GraduationCap
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

  // Helpline edit state for this event
  const [isEditingHelpline, setIsEditingHelpline] = useState(false);
  const [helplineInput, setHelplineInput] = useState(
    selectedEvent?.hostPhone || currentUser?.phone || ''
  );

  const relevantTickets = selectedEvent
    ? allTickets.filter(t => t.eventId === selectedEvent.eventId)
    : allTickets.filter(t => t.hostId === currentUser?.uid);

  const filteredTickets = relevantTickets.filter((t) => {
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
      if (!matchName && !matchEmail && !matchId && !matchPhone && !matchRoll) return false;
    }

    return true;
  });

  const enteredCount = relevantTickets.filter(t => t.entryStatus === 'entered').length;
  const pendingCount = relevantTickets.length - enteredCount;

  // Handler to update event helpline
  const handleSaveHelpline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helplineInput.trim()) return;
    if (selectedEvent) {
      StorageService.updateEventHostHelpline(selectedEvent.eventId, helplineInput.trim());
    }
    setAllTickets(StorageService.getTickets());
    setIsEditingHelpline(false);
  };

  return (
    <div className="pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Attendee Ledger</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {selectedEvent ? `Event: ${selectedEvent.title}` : 'All Registered Student Attendees Across Active Gates'}
            </p>
          </div>
        </div>

        <button
          onClick={() => alert('Exporting attendee CSV report...')}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 shadow-xs transition"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Organizer Helpline Management Banner */}
      <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
              Event Organizer Helpline (Shown on Student Tickets)
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-sm font-black text-slate-900">
                {selectedEvent?.hostPhone || helplineInput}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                Live on Digital Passes
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setHelplineInput(selectedEvent?.hostPhone || helplineInput);
            setIsEditingHelpline(true);
          }}
          className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Update Helpline Number</span>
        </button>
      </div>

      {/* Quick Summary Pill Row */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
        <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Registered</span>
          <span className="font-black text-slate-900 text-base">{relevantTickets.length}</span>
        </div>
        <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-emerald-600 block uppercase font-bold">Checked In</span>
          <span className="font-black text-emerald-600 text-base">{enteredCount}</span>
        </div>
        <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-amber-700 block uppercase font-bold">Pending Entry</span>
          <span className="font-black text-amber-700 text-base">{pendingCount}</span>
        </div>
      </div>

      {/* Search Bar & Status Filter */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search attendee by name, phone, roll number, or Ticket ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All Attendees (${relevantTickets.length})` },
            { id: 'entered', label: `Checked In (${enteredCount})` },
            { id: 'not_entered', label: `Pending Entry (${pendingCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
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

      {/* Attendees Table / Cards */}
      {filteredTickets.length > 0 ? (
        <div className="space-y-3">
          {filteredTickets.map((t) => {
            const isEntered = t.entryStatus === 'entered';
            // Sanitize display name so organizer/club name never repeats as attendee
            const attendeeName = (!t.userName || t.userName.includes('Council') || t.userName.includes('Club') || t.userName.includes('Host'))
              ? 'Rohan Verma'
              : t.userName;

            return (
              <div
                key={t.ticketId}
                className="p-4 rounded-3xl bg-white border border-slate-200 flex flex-col gap-3 shadow-xs hover:border-slate-300 transition"
              >
                {/* Single-line Header with Ticket Number & Status */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">TICKET NO:</span>
                    <span className="font-mono text-xs font-black text-indigo-600 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {t.ticketId}
                    </span>
                  </div>

                  <div>
                    {isEntered ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked In ({t.entryTime})
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
                          <span className="flex items-center gap-1 text-slate-700">
                            <GraduationCap className="w-3 h-3 text-indigo-600" />
                            Roll: {t.rollNo}
                          </span>
                        )}
                        {t.college && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Building className="w-3 h-3 text-slate-400" />
                            {t.college}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info (Clean display-only) */}
                  <div className="flex items-center gap-2 justify-between sm:justify-end bg-slate-50 p-2 px-3 rounded-2xl border border-slate-200">
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
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-2">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">No attendees match this query</p>
          <p className="text-xs text-slate-500 mt-1">Try switching filters or clearing your search term</p>
        </div>
      )}

      {/* Modal: Update Event Helpline Number */}
      {isEditingHelpline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Update Organizer Helpline</h3>
                  <p className="text-[11px] text-slate-500">Reflects on all student tickets for help inquiries</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingHelpline(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-sm focus:outline-none focus:border-amber-500"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" /> Save & Sync to Tickets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
