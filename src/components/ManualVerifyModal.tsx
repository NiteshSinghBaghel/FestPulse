import React, { useState } from 'react';
import { Ticket, ScannerScanResult } from '../types';
import { StorageService } from '../services/storageService';
import { 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Ticket as TicketIcon, 
  User, 
  GraduationCap, 
  Building, 
  Clock, 
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ManualVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedSuccess: (ticket: Ticket) => void;
  hostId?: string;
}

export const ManualVerifyModal: React.FC<ManualVerifyModalProps> = ({
  isOpen,
  onClose,
  onVerifiedSuccess,
  hostId = '',
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [result, setResult] = useState<ScannerScanResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recentEnteredTickets, setRecentEnteredTickets] = useState<Ticket[]>(() => {
    return StorageService.getTickets().filter(t => t.entryStatus === 'entered').slice(0, 5);
  });

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setIsVerifying(true);
    setResult(null);

    setTimeout(() => {
      const scanResult = StorageService.verifyAndProcessScan(token, hostId, 'entry');
      setResult(scanResult);
      setIsVerifying(false);

      if (scanResult.success && scanResult.ticket) {
        onVerifiedSuccess(scanResult.ticket);
        setRecentEnteredTickets(prev => [scanResult.ticket!, ...prev.filter(t => t.ticketId !== scanResult.ticket!.ticketId)].slice(0, 5));
      }
    }, 300);
  };

  const handleQuickFill = (id: string) => {
    setTokenInput(id);
    setResult(null);
  };

  const handleReset = () => {
    setTokenInput('');
    setResult(null);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col text-slate-900 cursor-default"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <TicketIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Manual Ticket Verification</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Gate Tool
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify entry passes directly using Ticket ID or QR Hash Token
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition shadow-2xs"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Form */}
        <div className="p-5 sm:p-6 space-y-4">
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                Enter Ticket ID or QR Token:
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. TKT-ABC12345 or paste pass token..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition shadow-2xs"
                  />
                  {tokenInput && (
                    <button
                      type="button"
                      onClick={() => setTokenInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <span>{isVerifying ? 'Checking...' : 'Verify Pass'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Verification Result Display */}
          {result && (
            <div className={`p-4 rounded-2xl border transition-all animate-scale-in ${
              result.success 
                ? 'bg-emerald-50 border-emerald-200' 
                : result.code === 'ALREADY_ENTERED'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-rose-50 border-rose-200'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  result.success 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : result.code === 'ALREADY_ENTERED'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}>
                  {result.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      result.success 
                        ? 'bg-emerald-200/60 text-emerald-900' 
                        : result.code === 'ALREADY_ENTERED'
                        ? 'bg-amber-200/60 text-amber-900'
                        : 'bg-rose-200/60 text-rose-900'
                    }`}>
                      {result.success 
                        ? '✓ ENTRY GRANTED' 
                        : result.code === 'ALREADY_ENTERED'
                        ? '⚠️ ALREADY CHECKED IN'
                        : '✕ INVALID TICKET'}
                    </span>

                    {result.ticket && (
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {result.ticket.ticketId}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-800 mt-1.5">
                    {result.message}
                  </p>

                  {/* Pass Details on Valid Entry */}
                  {result.ticket && (
                    <div className="mt-3 p-3 bg-white/90 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          {result.ticket.userName}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {result.ticket.quantity || 1} {(result.ticket.quantity || 1) > 1 ? 'Visitors' : 'Visitor'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-[11px] pt-1">
                        {result.ticket.rollNo && (
                          <span className="flex items-center gap-1 font-mono">
                            <GraduationCap className="w-3 h-3 text-indigo-600" />
                            Roll: {result.ticket.rollNo}
                          </span>
                        )}
                        {result.ticket.college && (
                          <span className="flex items-center gap-1 truncate">
                            <Building className="w-3 h-3 text-slate-400" />
                            {result.ticket.college}
                          </span>
                        )}
                        {result.ticket.entryTime && (
                          <span className="flex items-center gap-1 text-emerald-700 font-mono font-bold">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            {result.ticket.entryTime}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Helper Tips */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Gate Entrance Advice:</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Use manual verification if an attendee's phone screen is cracked, dim, or experiencing camera glare. Ticket ID is printed right below the attendee's digital pass QR code.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            Clear Input
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
};
