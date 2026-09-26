import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import jsQR from 'jsqr';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { ScannerScanResult, Ticket } from '../types';
import { 
  ArrowLeft,
  Scan, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Users, 
  Clock, 
  Ticket as TicketIcon, 
  GraduationCap, 
  ShieldCheck, 
  RefreshCw,
  Search,
  UserCheck,
  FileCheck
} from 'lucide-react';
import { ManualVerifyModal } from './ManualVerifyModal';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: () => void;
  prefilledTicket?: Ticket | null;
}

type FeedbackType = 'verified' | 'already_entered' | 'invalid' | null;

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  prefilledTicket = null,
}) => {
  const { currentUser } = useAuth();
  
  // Feedback state for the 2-second screen overlay
  const [feedbackState, setFeedbackState] = useState<FeedbackType>(null);
  const [activeScannedTicket, setActiveScannedTicket] = useState<Ticket | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  // Persisted Last Scanned Ticket
  const [lastScannedTicket, setLastScannedTicket] = useState<Ticket | null>(null);

  // Recent Gate Entries List
  const [recentEntries, setRecentEntries] = useState<Ticket[]>([]);

  // Manual Verify Modal Open State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Camera Facing Mode: 'environment' (back) or 'user' (front)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [isProcessing, setIsProcessing] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh recent entries list
  const loadRecentEntries = () => {
    const all = StorageService.getTickets();
    const entered = all.filter(t => t.entryStatus === 'entered');
    // Sort latest entry first
    entered.sort((a, b) => (b.entryTime || b.issuedAt || '').localeCompare(a.entryTime || a.issuedAt || ''));
    setRecentEntries(entered);
  };

  // Sound effects using Web Audio API
  const playSound = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Direct Auto Camera Start on mount
  useEffect(() => {
    if (isOpen) {
      isScanningActiveRef.current = true;
      loadRecentEntries();
      startCamera();

      if (prefilledTicket) {
        processToken(prefilledTicket.qrToken);
      }
    } else {
      stopCamera();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      setFeedbackState(null);
      setManualTokenInput('');
    }

    return () => {
      stopCamera();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [isOpen, prefilledTicket]);

  const startCamera = async (targetFacingMode?: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    const activeFacingMode = targetFacingMode || facingMode;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or connection');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: activeFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        isScanningActiveRef.current = true;
        scanFrame();
      }
    } catch (err: any) {
      console.warn('Camera could not be accessed directly:', err);
      setCameraError(err.message || 'Camera permission denied or camera device unavailable.');
      setCameraActive(false);
    }
  };

  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Live video frame QR code detection loop with jsQR
  const scanFrame = () => {
    if (!videoRef.current || !streamRef.current) return;

    if (
      isScanningActiveRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
    ) {
      const video = videoRef.current;
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim()) {
            isScanningActiveRef.current = false;
            processToken(code.data.trim());
            return;
          }
        } catch {
          // Continue scanning next frame
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Process and verify scanned token
  const processToken = (token: string) => {
    if (!token.trim()) return;
    setIsProcessing(true);

    const hostId = currentUser?.uid || '';
    const result = StorageService.verifyAndProcessScan(token.trim(), hostId);
    setIsProcessing(false);

    // Record last scanned ticket for preview
    if (result.ticket) {
      setLastScannedTicket(result.ticket);
    }

    // Refresh Recent Entries list immediately
    loadRecentEntries();

    if (result.code === 'ALREADY_ENTERED') {
      // 1. Already entered -> Show Red X sign & 'ALREADY ENTER' for 2 seconds
      playSound('error');
      setFeedbackState('already_entered');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(result.message || 'Already Entered! Duplicate entry rejected.');
      isScanningActiveRef.current = false;

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame(); // Automatically resume scanning
      }, 2000);

    } else if (result.success) {
      // 2. New & verified -> Show Green Correct sign & 'VERIFIED' for 2 seconds
      playSound('success');
      setFeedbackState('verified');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage('Verified! Entry Granted • Welcome to the Event.');
      isScanningActiveRef.current = false;

      if (onScanSuccess) {
        onScanSuccess();
      }

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame(); // Automatically resume scanning
      }, 2000);

    } else {
      // Invalid ticket
      playSound('error');
      setFeedbackState('invalid');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(result.message || 'Invalid Ticket QR Token.');
      isScanningActiveRef.current = false;

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame(); // Automatically resume scanning
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 text-slate-900 flex flex-col w-full h-full overflow-hidden animate-fade-in font-sans">
      
      {/* ================= TOP FULL-PAGE HEADER (LIGHT THEME) ================= */}
      <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 border border-slate-200 shadow-2xs shrink-0"
            aria-label="Exit scanner"
            title="Exit scanner"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-black text-slate-900 flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="truncate">Gate Entry Scanner</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden md:block truncate">
              High-speed automatic camera gate check-in with 2-second turnaround
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Dedicated Manual Ticket Verify Button */}
          <button
            type="button"
            onClick={() => {
              setIsManualModalOpen(true);
            }}
            className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5 shadow-2xs transition active:scale-95"
            title="Manual Ticket Verification: Click to enter ticket ID"
          >
            <FileCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="hidden sm:inline">Manual Verify</span>
            <span className="sm:hidden text-[11px]">Verify</span>
          </button>

          <div className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-right shadow-2xs">
            <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Total</span>
            <span className="text-xs sm:text-sm font-black text-emerald-600 whitespace-nowrap">{recentEntries.length} In</span>
          </div>
        </div>
      </header>

      {/* ================= MAIN TWO-TIER FULL-PAGE CONTENT (LIGHT THEME) ================= */}
      <div className="flex-1 overflow-y-auto flex flex-col p-3 sm:p-5 max-w-4xl mx-auto w-full gap-4">
        
        {/* ================= TOP: DIRECT CAMERA SCANNER VIEWPORT ================= */}
        <div className="relative rounded-3xl bg-black border-2 border-slate-300 overflow-hidden min-h-[260px] sm:min-h-[300px] max-h-[340px] flex items-center justify-center shadow-xl shrink-0">
          
          {/* Switch Camera Button: Circular Arrow Icon Only (No Text) */}
          <button
            type="button"
            onClick={toggleCamera}
            className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center border border-white/30 shadow-lg backdrop-blur-md active:scale-90 active:rotate-180 transition-all duration-300"
            title="Switch Camera (Front / Back)"
            aria-label="Switch Camera"
          >
            <RefreshCw className="w-5 h-5 text-white" />
          </button>

          {/* Live Camera Stream */}
          <video 
            ref={videoRef} 
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            playsInline
            muted
          />

          {/* Scanning Reticle & Laser Beam (Active when scanning) */}
          {cameraActive && !feedbackState && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-indigo-400/90 rounded-3xl relative">
                {/* Corner Marks */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />
                
                {/* Animated Horizontal Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_rgba(99,102,241,1)] animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
              
              <div className="absolute bottom-3 py-1 px-3.5 rounded-full bg-slate-900/90 border border-slate-700 text-white text-[11px] font-semibold tracking-wide backdrop-blur-xs">
                Align QR Code inside square to scan directly
              </div>
            </div>
          )}

          {/* Camera Loading / Retry View */}
          {!cameraActive && !feedbackState && (
            <div className="text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Camera className="w-7 h-7 text-indigo-400 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white">Starting Live Camera Scanner...</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {cameraError || 'Accessing camera. Please ensure camera permissions are allowed on your device.'}
              </p>
              <button
                onClick={() => startCamera()}
                className="py-2.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
              </button>
            </div>
          )}

          {/* ================= 2-SECOND FEEDBACK OVERLAYS ================= */}
          {/* 1. ALREADY ENTERED (Red X Sign for 2 seconds) */}
          {feedbackState === 'already_entered' && (
            <div className="absolute inset-0 bg-[#380b12]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-4 border-rose-500 text-rose-500 flex items-center justify-center shadow-2xl mb-2 animate-bounce">
                <span className="text-4xl font-black leading-none pb-1">✕</span>
              </div>

              <h2 className="text-2xl font-black text-rose-400 tracking-tight">
                ALREADY ENTERED
              </h2>
              
              <p className="text-xs font-semibold text-rose-200 mt-0.5">
                Ticket already checked in! Duplicate entry rejected.
              </p>

              {activeScannedTicket && (
                <div className="mt-3 px-4 py-2 rounded-2xl bg-black/50 border border-rose-500/30 text-xs text-rose-100 max-w-sm w-full text-left space-y-1">
                  <div className="flex items-center justify-between pb-1 border-b border-rose-500/20">
                    <span className="font-bold flex items-center gap-1 text-rose-200">
                      <Users className="w-3.5 h-3.5 text-rose-400" />
                      Visitors:
                    </span>
                    <span className="font-black px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 text-[11px]">
                      {(activeScannedTicket.quantity || 1)} {(activeScannedTicket.quantity || 1) > 1 ? 'Visitors' : 'Visitor'}
                    </span>
                  </div>
                  <p className="truncate"><b>Attendee:</b> {activeScannedTicket.userName}</p>
                  <p className="font-mono text-[11px] text-rose-300"><b>ID:</b> {activeScannedTicket.ticketId}</p>
                  <p className="text-[11px] text-rose-300"><b>First Entry:</b> {activeScannedTicket.entryTime || 'Earlier'}</p>
                </div>
              )}

              <div className="mt-3 w-40 h-1.5 bg-rose-950 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full animate-pulse" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] text-rose-300 mt-1 font-medium">
                Resuming camera in 2 seconds...
              </span>
            </div>
          )}

          {/* 2. VERIFIED (Green Correct Checkmark for 2 seconds) */}
          {feedbackState === 'verified' && (
            <div className="absolute inset-0 bg-[#062916]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-4 border-emerald-400 text-emerald-400 flex items-center justify-center shadow-2xl mb-2 animate-bounce">
                <span className="text-4xl font-black leading-none pb-1">✓</span>
              </div>

              {activeScannedTicket && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider mb-1 shadow-md">
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>ADMIT {(activeScannedTicket.quantity || 1)} {(activeScannedTicket.quantity || 1) > 1 ? 'VISITORS' : 'VISITOR'}</span>
                </div>
              )}

              <h2 className="text-2xl font-black text-emerald-400 tracking-tight">
                VERIFIED & GRANTED
              </h2>

              <p className="text-xs font-semibold text-emerald-200 mt-0.5">
                Gate clearance approved • Welcome to the Event!
              </p>

              {activeScannedTicket && (
                <div className="mt-3 px-4 py-2 rounded-2xl bg-black/50 border border-emerald-500/30 text-xs text-emerald-100 max-w-sm w-full text-left space-y-1">
                  <p className="truncate"><b>Attendee:</b> {activeScannedTicket.userName} ({activeScannedTicket.rollNo || 'Student'})</p>
                  <p className="font-mono text-[11px] text-emerald-300"><b>Ticket ID:</b> {activeScannedTicket.ticketId}</p>
                  <p className="text-[11px] text-emerald-300"><b>Checked In:</b> {activeScannedTicket.entryTime || 'Just now'}</p>
                </div>
              )}

              <div className="mt-3 w-40 h-1.5 bg-emerald-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full animate-pulse" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] text-emerald-300 mt-1 font-medium">
                Next scan starting in 2 seconds...
              </span>
            </div>
          )}

          {/* 3. INVALID TOKEN (Red X for 2 seconds) */}
          {feedbackState === 'invalid' && (
            <div className="absolute inset-0 bg-[#380b12]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-4 border-rose-500 text-rose-500 flex items-center justify-center shadow-2xl mb-2">
                <span className="text-4xl font-black leading-none pb-1">✕</span>
              </div>

              <h2 className="text-2xl font-black text-rose-400 tracking-tight">
                INVALID PASS
              </h2>
              <p className="text-xs text-rose-200 mt-1 max-w-xs">
                {feedbackMessage}
              </p>

              <div className="mt-3 w-40 h-1.5 bg-rose-950 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full animate-pulse" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] text-rose-300 mt-1 font-medium">
                Resuming camera in 2 seconds...
              </span>
            </div>
          )}
        </div>

        {/* ================= QUICK MANUAL VERIFY ROW (LIGHT THEME) ================= */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-tight">Manual Verification Fallback</p>
              <p className="text-[11px] text-slate-500">For phone screens with low brightness or camera glare</p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-1 w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Enter Ticket ID (e.g. TKT-...) or QR token..."
              value={manualTokenInput}
              onChange={(e) => setManualTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') processToken(manualTokenInput);
              }}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition shadow-2xs"
            />
            <button
              type="button"
              onClick={() => processToken(manualTokenInput)}
              disabled={isProcessing || !manualTokenInput.trim()}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-xs whitespace-nowrap active:scale-95 shrink-0"
            >
              Verify Pass
            </button>
          </div>
        </div>

        {/* ================= BOTTOM: RECENT ENTRIES LIST (LIGHT THEME) ================= */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex-1 flex flex-col min-h-[220px] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Recent Gate Entries
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              {recentEntries.length} Verified
            </span>
          </div>

          {/* List of Recently Scanned / Entered Passes */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {recentEntries.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <TicketIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-bold text-slate-600">No gate entries yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Point the camera at attendee ticket QR codes to see real-time check-ins here.
                </p>
              </div>
            ) : (
              recentEntries.map((ticket, index) => (
                <div 
                  key={ticket.ticketId || index}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition flex items-center justify-between gap-3 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black shrink-0">
                      ✓
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate text-xs">{ticket.userName}</span>
                        {ticket.rollNo && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 font-mono font-medium">
                            {ticket.rollNo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 truncate">
                        <span className="font-mono text-indigo-600 font-semibold">{ticket.ticketId}</span>
                        <span>•</span>
                        <span className="truncate">{ticket.college || 'College'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Users className="w-3 h-3" />
                      <span>{ticket.quantity || 1} {(ticket.quantity || 1) > 1 ? 'Visitors' : 'Visitor'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-1 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{ticket.entryTime || 'Checked in'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Systematic Manual Ticket Verification Dialog */}
      <ManualVerifyModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        hostId={currentUser?.uid || ''}
        onVerifiedSuccess={(ticket) => {
          loadRecentEntries();
          onScanSuccess?.();
          playSound('success');
        }}
      />
    </div>
  );
};
