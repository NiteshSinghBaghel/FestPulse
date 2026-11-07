import React, { useState } from 'react';
import { CollegeEvent } from '../types';
import { 
  KeyRound, 
  Copy, 
  Check, 
  MessageCircle, 
  QrCode, 
  ExternalLink, 
  ShieldCheck, 
  Smartphone, 
  X,
  Share2,
  Calendar,
  MapPin
} from 'lucide-react';

interface VolunteerGateShareModalProps {
  event: CollegeEvent;
  isOpen: boolean;
  onClose: () => void;
  onOpenVolunteerScanner?: (gatePin?: string) => void;
}

export const VolunteerGateShareModal: React.FC<VolunteerGateShareModalProps> = ({
  event,
  isOpen,
  onClose,
  onOpenVolunteerScanner
}) => {
  if (!isOpen) return null;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'qr'>('share');

  const gatePin = event.gatePin || '123456';
  const directLink = `${window.location.origin}?gatePin=${gatePin}`;
  
  const fullInviteMessage = `🎟️ *CampusPass Gate Entry Scanner Access*\n\n` +
    `Event: *${event.title}*\n` +
    `Venue: ${event.venue}\n` +
    `Date: ${event.date}\n\n` +
    `🔑 *6-Digit Gate Code*: *${gatePin}*\n` +
    `📲 *Direct Scanner Link*: ${directLink}\n\n` +
    `_Instructions: Open the link on your smartphone camera or browser to scan and verify student QR tickets at the gate._`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gatePin);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(fullInviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2200);
  };

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullInviteMessage)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-indigo-600 shrink-0" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Volunteer Gate Passcode & Link
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Share access with gate volunteers to scan tickets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Target Event Info Banner */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              Selected Event
            </span>
            <h4 className="text-sm font-black text-slate-900 truncate">{event.title}</h4>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {event.venue}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {event.date}
              </span>
            </div>
          </div>

          {/* Tab Switcher: Share (Code & Link) vs Show QR */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'share'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Gate Code & Link</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'qr'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show On-Screen QR</span>
            </button>
          </div>

          {activeTab === 'share' ? (
            <>
              {/* 1. 6-DIGIT GATE CODE (Highlighted) */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                    1. 6-Digit Gate Code (PIN)
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    No Login Required
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-amber-900 tracking-[0.25em] pl-2">
                    {gatePin}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-amber-800/80 mt-2 font-medium">
                  Volunteers can simply open the website and type this 6-digit code in the <strong>"Gate PIN"</strong> box.
                </p>
              </div>

              {/* 2. DIRECT SCANNER LINK (Highlighted) */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900">
                    2. Direct Volunteer Scanner Link
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Auto-Loads PIN
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-200">
                  <input
                    type="text"
                    readOnly
                    value={directLink}
                    className="w-full text-xs font-mono text-slate-700 bg-transparent outline-none truncate px-1"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-indigo-800/80 mt-2 font-medium">
                  Sending this link directly opens the scanner on the volunteer's phone without asking for any password.
                </p>
              </div>

              {/* 3. SEND BUTTONS: WhatsApp & Message */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Send to Volunteers
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                    <span>Send via WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    {copiedMessage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">Invite Text Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Copy Full Invite Text</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* On-Screen QR Code View */
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 text-center">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(directLink)}`}
                  alt="Volunteer Gate Scanner QR"
                  className="w-44 h-44 object-contain"
                />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Point Phone Camera at this QR Code
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                Your volunteer's phone will immediately open the safe gate scanner with Code <strong>{gatePin}</strong> already verified.
              </p>
            </div>
          )}

          {/* Quick Launch Button if testing on current device */}
          {onOpenVolunteerScanner && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVolunteerScanner(gatePin);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span>Test & Launch Scanner on this Device</span>
              </button>
            </div>
          )}

          {/* 100% Security Guarantee Card */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 leading-relaxed font-medium">
              <strong className="text-emerald-950 block font-bold mb-0.5">🔒 Complete Security Guarantee</strong>
              Volunteers have <strong>zero access</strong> to your revenue earnings, UPI bank accounts, or event management. They can <strong>only scan tickets</strong> for this event!
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
