import React, { useState } from 'react';
import { CollegeEvent, Ticket } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Heart,
  Share2,
  Ticket as TicketIcon,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users
} from 'lucide-react';

interface EventDetailPageProps {
  event: CollegeEvent;
  onBack: () => void;
  onTicketPurchased: (ticket: Ticket) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({ event, onBack, onTicketPurchased }) => {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const percentBooked = Math.round((event.ticketsSold / event.capacity) * 100);
  const isSoldOut = event.status === 'sold_out' || event.availableTickets <= 0;
  const isCancelled = event.status === 'cancelled';

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: event.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Google Calendar Link generator
  const getGoogleCalendarUrl = () => {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`${event.description}\n\nHost: ${event.hostName}`);
    const location = encodeURIComponent(`${event.venue}, ${event.location}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
  };

  return (
    <div className="pb-32 max-w-6xl mx-auto min-h-screen bg-slate-50 text-slate-900 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Top Header Card */}
      <div className="relative pt-4 px-4 sm:px-6 pb-6 bg-white border border-slate-200/80 rounded-3xl mb-6 shadow-xs">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-200 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shadow-2xs flex items-center justify-center transition ${
                isLiked ? 'text-rose-500' : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Bookmark"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition relative"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
              {copiedLink && (
                <span className="absolute -bottom-7 right-0 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap">
                  Copied!
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Event Cover Image */}
        <div className="rounded-3xl overflow-hidden shadow-md mb-6 border border-slate-200/90 h-64 sm:h-80 lg:h-96 relative bg-slate-900">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-600/90 text-white shadow-xs backdrop-blur-sm">
                {event.category} Fest
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/30">
                {event.availableTickets} Seats Available
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black leading-tight drop-shadow-sm">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium mt-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-300" />
              <span>Hosted by <strong className="text-white">{event.hostName}</strong> ({event.location})</span>
            </p>
          </div>
        </div>

        {/* Two-Column Responsive Grid on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Quick Details Grid */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Timing</span>
                    <p className="text-sm font-black text-slate-900">{event.date}</p>
                    <p className="text-xs text-slate-500 font-medium">{event.startTime} - {event.endTime}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue & Campus</span>
                    <p className="text-sm font-black text-slate-900">{event.venue}</p>
                    <p className="text-xs text-slate-500 font-medium">{event.location}</p>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-500 font-medium">Add to your device calendar</span>
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-200 px-3.5 py-1.5 rounded-xl transition shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Google Calendar</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* About This Event */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs">
              <h2 className="text-base font-black text-slate-900 mb-2">About this event</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </div>

            {/* Good To Know Checklist */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs">
              <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Good to know</span>
              </h2>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bring a valid college student ID card</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Entry gates close 30 minutes after scheduled start</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Anti-counterfeit digital QR pass issued upon booking</span>
                </li>
                {event.rules?.filter(r => !r.toLowerCase().includes('id card') && !r.toLowerCase().includes('entry closes')).map((rule, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Pass Booking & Capacity Sidebar */}
          <div className="space-y-5">
            {/* Pass Booking Box (Always visible on desktop!) */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-2xs sticky top-24">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black text-slate-900">Pass Availability</span>
                <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  {event.availableTickets} left
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, percentBooked)}%` }}
                />
              </div>

              <p className="text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>{percentBooked}% booked</span>
                <span>Total: {event.capacity} seats</span>
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-xs text-slate-500 font-medium">Ticket Price</span>
                  <span className="text-3xl font-black text-slate-900">
                    {event.price === 0 ? 'FREE' : `₹${event.price}`}
                  </span>
                </div>

                {isCancelled ? (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-2xl bg-slate-200 text-slate-400 font-black text-xs cursor-not-allowed uppercase"
                  >
                    Event Cancelled
                  </button>
                ) : isSoldOut ? (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs cursor-not-allowed uppercase"
                  >
                    Sold Out
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition transform active:scale-95 cursor-pointer"
                  >
                    <TicketIcon className="w-4 h-4" />
                    <span>Book Pass Now</span>
                    <span className="text-xs text-indigo-200 font-bold ml-0.5">→</span>
                  </button>
                )}

                <div className="mt-4 pt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Instant UPI & QR issuance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Booking Bar on Mobile ONLY (md:hidden) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {event.price === 0 ? 'Entry' : 'Pass Price'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {event.price === 0 ? 'FREE' : `₹${event.price}`}
              </span>
              {event.availableTickets > 0 && !isSoldOut && !isCancelled && (
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {event.availableTickets} left
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {isCancelled ? (
              <button
                disabled
                className="py-3 px-6 rounded-2xl bg-slate-200 text-slate-400 font-black text-xs cursor-not-allowed uppercase"
              >
                Event Cancelled
              </button>
            ) : isSoldOut ? (
              <button
                disabled
                className="py-3 px-6 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs cursor-not-allowed uppercase"
              >
                Sold Out
              </button>
            ) : (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition transform active:scale-95 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>Book Now</span>
                <span className="text-xs text-indigo-200 font-bold ml-0.5">→</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment & Attendee Registration Modal */}
      <PaymentModal
        event={event}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={(newTicket) => {
          onTicketPurchased(newTicket);
        }}
      />
    </div>
  );
};
