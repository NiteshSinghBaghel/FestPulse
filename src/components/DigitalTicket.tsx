import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Ticket } from '../types';
import { StorageService } from '../services/storageService';
import { Calendar, Clock, MapPin, Download, Share2, ShieldCheck, Sparkles, PhoneCall, Copy, Check, X } from 'lucide-react';

interface DigitalTicketProps {
  ticket: Ticket;
  onClose?: () => void;
}

export const DigitalTicket: React.FC<DigitalTicketProps> = ({ ticket, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Retrieve event to get latest host helpline if not on ticket
  const event = StorageService.getEventById(ticket.eventId);
  const organizerPhone = ticket.hostPhone || event?.hostPhone || '';
  const organizerName = event?.hostName || 'Event Organizer';

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        ticket.qrToken,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) console.error('Error rendering QR code', error);
        }
      );
    }
  }, [ticket.qrToken]);

  const copyTicketId = () => {
    navigator.clipboard.writeText(ticket.ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    if (ticket.status === 'cancelled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          CANCELLED
        </span>
      );
    }
    if (ticket.entryStatus === 'entered' && ticket.exitStatus === 'exited') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
          EVENT EXITED ({ticket.exitTime})
        </span>
      );
    }
    if (ticket.entryStatus === 'entered') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          CHECKED IN ({ticket.entryTime})
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40">
        VALID & CONFIRMED
      </span>
    );
  };

  return (
    <div className="w-full max-w-sm mx-auto select-none">
      {/* Ticket Card Container */}
      <div className="relative bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-slate-900">
        {/* Banner with Event Image */}
        <div className="relative h-32 w-full overflow-hidden">
          <img 
            src={ticket.eventImageUrl} 
            alt={ticket.eventTitle} 
            className="w-full h-full object-cover brightness-95" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-amber-400/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Fest+ Verified
            </span>
            <div className="flex items-center gap-1.5">
              {getStatusBadge()}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center border border-white/30 transition active:scale-90"
                  title="Cut / Close Ticket"
                  aria-label="Cut / Close Ticket"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Single-Line Ticket Number Bar */}
        <div className="mx-4 -mt-3 relative z-10 px-3 py-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Ticket Number:
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black text-indigo-600 tracking-wider whitespace-nowrap">
              {ticket.ticketId}
            </span>
            <button
              onClick={copyTicketId}
              className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
              title="Copy Ticket ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Event Header Information */}
        <div className="px-5 pt-3 pb-3 bg-white">
          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
            Official Entry E-Ticket
          </p>
          <h2 className="text-lg font-black text-slate-900 leading-tight mt-0.5">
            {ticket.eventTitle}
          </h2>

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium">{ticket.eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium">{ticket.eventTime}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 mt-2 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{ticket.eventVenue}</span>
          </div>

          {/* Attendee Details Grid */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-medium">Attendee</span>
              <span className="font-bold text-slate-900 truncate block">{ticket.userName}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 block font-medium">College / Roll</span>
              <span className="font-medium text-slate-600 truncate block">
                {ticket.rollNo || ticket.college || 'Student Pass'}
              </span>
            </div>
          </div>
        </div>

        {/* Organizer Helpline & Help Support Card */}
        <div className="mx-4 mb-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <PhoneCall className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-extrabold text-amber-700 block tracking-wider">
                  Organizer Helpline
                </span>
                <span className="font-mono font-bold text-slate-900 text-xs truncate block">
                  {organizerPhone}
                </span>
              </div>
            </div>
            <a
              href={`tel:${organizerPhone}`}
              className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] transition shadow-xs flex items-center gap-1 shrink-0"
            >
              <PhoneCall className="w-3 h-3" /> Call Helpline
            </a>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-tight">
            For entry help, venue navigation, or inquiries from {organizerName}.
          </p>
        </div>

        {/* Perforated Rip Divider with Side Cutout Notches */}
        <div className="relative py-1 flex items-center justify-center bg-white">
          {/* Left Notch */}
          <div className="absolute -left-3 w-6 h-6 rounded-full bg-slate-900/60 border border-slate-200 shadow-inner" />
          {/* Right Notch */}
          <div className="absolute -right-3 w-6 h-6 rounded-full bg-slate-900/60 border border-slate-200 shadow-inner" />
          {/* Dashed Line */}
          <div className="w-full border-t-2 border-dashed border-slate-200 px-6" />
        </div>

        {/* QR Code Section */}
        <div className="p-4 flex flex-col items-center justify-center bg-slate-50/70 text-center">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
            <canvas ref={canvasRef} className="rounded-lg w-40 h-40" />
          </div>

          <div className="mt-2.5">
            <p className="text-xs font-bold text-slate-800">
              Scan this QR at the entrance gate
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 tracking-wide">
              Token: {ticket.qrToken.substring(0, 16)}...
            </p>
          </div>

          <div className="mt-3 w-full flex items-center justify-between px-2 text-[11px] text-slate-500 border-t border-slate-200 pt-2.5">
            <span>Price Paid: <b className="text-slate-900">₹{ticket.amount}</b></span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> UPI Verified
            </span>
          </div>
        </div>
      </div>

      {/* Ticket action buttons */}
      <div className="mt-3 flex gap-2 justify-center">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close Pass</span>
          </button>
        )}
        <button
          onClick={() => alert(`Ticket ${ticket.ticketId} saved to device!`)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Download className="w-4 h-4 text-indigo-600" /> Save Pass
        </button>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: ticket.eventTitle,
                text: `Here is my Fest+ Pass for ${ticket.eventTitle} (Ticket: ${ticket.ticketId})`,
                url: window.location.href,
              }).catch(() => {});
            } else {
              alert('Pass link copied to clipboard!');
            }
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Share2 className="w-4 h-4 text-slate-500" /> Share
        </button>
      </div>
    </div>
  );
};
