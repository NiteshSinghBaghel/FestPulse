import React, { useState } from 'react';
import { Ticket } from '../types';
import { DigitalTicket } from '../components/DigitalTicket';
import { StorageService } from '../services/storageService';
import { 
  Ticket as TicketIcon, 
  Calendar, 
  Clock, 
  MapPin, 
  QrCode, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  Compass,
  AlertOctagon,
  Ban
} from 'lucide-react';

interface MyTicketsPageProps {
  tickets: Ticket[];
  onExplore: () => void;
  onTicketsUpdated?: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ tickets, onExplore, onTicketsUpdated }) => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<Ticket | null>(null);

  const upcomingTickets = tickets.filter(t => t.status !== 'cancelled' && (t.entryStatus !== 'entered' || t.exitStatus !== 'exited'));
  const pastTickets = tickets.filter(t => t.status === 'cancelled' || (t.entryStatus === 'entered' && t.exitStatus === 'exited'));

  const displayedTickets = tab === 'upcoming' ? upcomingTickets : pastTickets;

  const handleConfirmCancelPass = () => {
    if (!ticketToCancel) return;
    const res = StorageService.cancelTicket(ticketToCancel.ticketId);
    if (res.success) {
      if (onTicketsUpdated) onTicketsUpdated();
      setTicketToCancel(null);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="pb-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">My E-Tickets</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Digital entrance passes with cryptographically signed anti-counterfeit QR tokens
          </p>
        </div>

        {/* Tabs */}
        <div className="p-1 bg-slate-100 rounded-2xl border border-slate-200 flex gap-1 shrink-0">
          <button
            onClick={() => setTab('upcoming')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              tab === 'upcoming'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Active & Upcoming</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {upcomingTickets.length}
            </span>
          </button>

          <button
            onClick={() => setTab('past')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              tab === 'past'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Past Passes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {pastTickets.length}
            </span>
          </button>
        </div>
      </div>

      {/* Ticket List (Grid on tablet/desktop) */}
      {displayedTickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedTickets.map((t) => {
            const isEntered = t.entryStatus === 'entered';
            const isExited = t.exitStatus === 'exited';

            return (
              <div
                key={t.ticketId}
                className="relative bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs transition hover:border-slate-300"
              >
                <div className="p-4 flex gap-3.5 items-start">
                  <img
                    src={t.eventImageUrl}
                    alt={t.eventTitle}
                    className="w-20 h-24 rounded-2xl object-cover shrink-0 bg-slate-100"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Ticket Number & Status in one clean single line */}
                    <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400">TICKET ID:</span>
                        <span className="font-mono text-xs font-black text-indigo-600 whitespace-nowrap">
                          {t.ticketId}
                        </span>
                      </div>
                      {t.status === 'cancelled' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          CANCELLED
                        </span>
                      ) : isEntered && !isExited ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          CHECKED IN
                        </span>
                      ) : isExited ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          CONFIRMED
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900 truncate">
                      {t.eventTitle}
                    </h3>

                    <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t.eventDate} • {t.eventTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{t.eventVenue}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Perforated Divider */}
                <div className="relative border-t-2 border-dashed border-slate-200 px-4 py-2.5 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Attendee: <b className="text-slate-800">{t.userName}</b></span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Student cancel option for active, non-entered tickets */}
                    {t.status !== 'cancelled' && t.entryStatus !== 'entered' && (
                      <button
                        onClick={() => setTicketToCancel(t)}
                        className="py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs flex items-center gap-1 transition shadow-2xs"
                        title="Cancel this pass"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel Pass</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>View QR Pass</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <TicketIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No {tab} tickets</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {tab === 'upcoming'
              ? 'You have not registered for any upcoming events yet. Discover exciting fests on campus!'
              : 'You have no past event history recorded yet.'}
          </p>
          <button
            onClick={onExplore}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
          >
            Browse College Events
          </button>
        </div>
      )}

      {/* Digital Ticket Modal */}
      {selectedTicket && (
        <div 
          onClick={() => setSelectedTicket(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm my-auto cursor-default"
          >
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="absolute -top-11 right-0 py-1.5 px-3 rounded-full bg-white/95 hover:bg-white border border-slate-200 text-slate-800 font-bold text-xs shadow-md flex items-center gap-1.5 transition z-10 active:scale-95"
            >
              <X className="w-4 h-4 text-slate-600" />
              <span>Cut / Close</span>
            </button>
            <DigitalTicket
              ticket={selectedTicket}
              onClose={() => setSelectedTicket(null)}
            />
          </div>
        </div>
      )}
      {/* Confirmation Modal: Student Cancel Pass */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">Cancel Your Pass?</h3>
              <p className="text-xs text-slate-600 font-medium">
                Are you sure you want to cancel your pass for{' '}
                <strong className="text-slate-900">"{ticketToCancel.eventTitle}"</strong>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-1 mt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket ID:</span>
                  <span className="font-mono font-bold text-indigo-700">{ticketToCancel.ticketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity:</span>
                  <span className="font-semibold text-slate-800">{ticketToCancel.quantity || 1} pass(es)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Event Date:</span>
                  <span className="font-semibold text-slate-800">{ticketToCancel.eventDate}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 mt-2 text-left">
                ⚠️ Once cancelled, this QR pass is permanently revoked. You will not be permitted entry through the gate scanner.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTicketToCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition"
              >
                No, Keep Pass
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPass}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow-sm"
              >
                Yes, Cancel Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
