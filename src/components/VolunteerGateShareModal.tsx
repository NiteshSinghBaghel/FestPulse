import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CollegeEvent } from '../types';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound,
  Copy,
  Check,
  X,
  Calendar,
  MapPin,
  QrCode,
  Download,
  Share2,
  RefreshCw,
  Scan,
  ShieldCheck,
} from 'lucide-react';

interface VolunteerGateShareModalProps {
  event: CollegeEvent;
  isOpen: boolean;
  onClose: () => void;
  onOpenVolunteerScanner?: (gatePin?: string) => void;
  onEventUpdated?: (updatedEvent: CollegeEvent) => void;
}

export const VolunteerGateShareModal: React.FC<VolunteerGateShareModalProps> = ({
  event,
  isOpen,
  onClose,
  onOpenVolunteerScanner,
  onEventUpdated,
}) => {
  const { currentUser } = useAuth();
  const [activePin, setActivePin] = useState<string>(
    event?.gatePin && /^\d{6}$/.test(String(event.gatePin).trim()) ? String(event.gatePin).trim() : ''
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharedInvite, setSharedInvite] = useState(false);
  const [isRotatingPin, setIsRotatingPin] = useState(false);

  // Sync or auto-assign a valid 6-digit Gate PIN when opened
  useEffect(() => {
    if (!isOpen || !event) return;
    const validExisting =
      event.gatePin && /^\d{6}$/.test(String(event.gatePin).trim())
        ? String(event.gatePin).trim()
        : '';

    if (validExisting) {
      setActivePin(validExisting);
      return;
    }

    let mounted = true;
    setIsRotatingPin(true);
    StorageService.ensureEventGatePin(event.eventId, currentUser?.uid, currentUser?.email)
      .then((updated) => {
        if (!mounted) return;
        if (updated?.gatePin) {
          setActivePin(updated.gatePin);
          onEventUpdated?.(updated);
        }
      })
      .finally(() => {
        if (mounted) setIsRotatingPin(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, event?.eventId, event?.gatePin]);

  const directLink =
    typeof window !== 'undefined' && activePin
      ? `${window.location.origin}/?gatePin=${activePin}`
      : '';

  // Render high-contrast QR Code for direct volunteer gate access
  useEffect(() => {
    if (!isOpen || !directLink) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(directLink, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, directLink]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!activePin) return;
    navigator.clipboard.writeText(activePin);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!directLink) return;
    navigator.clipboard.writeText(directLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !activePin) return;
    const slug = (event.title || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `volunteer-gate-qr-${slug || event.eventId}-${activePin}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareInvite = async () => {
    if (!activePin || !directLink) return;
    const shareText = [
      `Gate Volunteer Access — ${event.title}`,
      `Date: ${event.date} • Venue: ${event.venue}`,
      `6-Digit Gate PIN: ${activePin}`,
      `Direct Gate Scanner Link: ${directLink}`,
      `(Scan the QR or open the link — no organizer login required)`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Volunteer Gate Access: ${event.title}`,
          text: shareText,
          url: directLink,
        });
        setSharedInvite(true);
        setTimeout(() => setSharedInvite(false), 2000);
        return;
      } catch {
        // Fallback to clipboard copy if user cancels native share or desktop rejects
      }
    }

    navigator.clipboard.writeText(shareText);
    setSharedInvite(true);
    setTimeout(() => setSharedInvite(false), 2500);
  };

  const handleRegeneratePin = async () => {
    if (isRotatingPin) return;
    setIsRotatingPin(true);
    try {
      const updated = await StorageService.regenerateGatePinAsync(
        event.eventId,
        currentUser?.uid,
        currentUser?.email
      );
      if (updated?.gatePin) {
        setActivePin(updated.gatePin);
        onEventUpdated?.(updated);
      }
    } finally {
      setIsRotatingPin(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-amber-500 to-emerald-500 shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-6 pt-4 pb-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Volunteer Gate PIN & QR
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {event.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{event.date}</span>
            </span>
          </div>

          {/* Scannable Volunteer Gate QR Code */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <QrCode className="w-3 h-3" /> Scan to Open Gate Scanner
              </span>
              {qrDataUrl && (
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="text-[11px] font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save QR</span>
                </button>
              )}
            </div>

            <div className="p-3 bg-white rounded-2xl border-2 border-slate-900/10 shadow-sm">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Volunteer Gate Scanner QR for ${event.title}`}
                  className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg"
                />
              ) : (
                <div className="w-44 h-44 sm:w-48 sm:h-48 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Generating Gate QR...</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mt-2.5 max-w-xs leading-relaxed">
              Volunteers can scan this QR with their phone camera to unlock this event&apos;s gate scanner without organizer login.
            </p>
          </div>

          {/* 6-Digit Gate Code */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>6-Digit Gate PIN</span>
              </span>
              <button
                type="button"
                onClick={handleRegeneratePin}
                disabled={isRotatingPin}
                className="text-[11px] font-bold text-slate-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                title="Generate a new 6-digit Gate PIN (invalidates the old PIN)"
              >
                <RefreshCw className={`w-3 h-3 ${isRotatingPin ? 'animate-spin' : ''}`} />
                <span>{isRotatingPin ? 'Updating...' : 'New PIN'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.22em] text-white select-all">
                {activePin || '------'}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={!activePin}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy PIN</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Scanner Link */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Direct Volunteer Scanner Link
            </span>
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <input
                type="text"
                readOnly
                value={directLink}
                className="w-full text-xs font-mono text-indigo-700 bg-transparent outline-none truncate px-1.5"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!directLink}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sandboxed Security Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2 text-[11px] text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              Volunteers using this PIN or QR can only scan tickets for <strong>{event.title}</strong>. Revenue &amp; bank payout controls remain locked.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareInvite}
              disabled={!activePin}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {sharedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Invite Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Invite</span>
                </>
              )}
            </button>

            {onOpenVolunteerScanner && activePin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVolunteerScanner(activePin);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Open Scanner</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
