import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import jsQR from 'jsqr';
import { StorageService } from '../services/storageService';
import { CollegeEvent, ScannerScanResult, Ticket } from '../types';
import { 
  ArrowLeft,
  Scan, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Users, 
  Clock, 
  Ticket as TicketIcon, 
  ShieldCheck, 
  RefreshCw,
  Search,
  UserCheck,
  KeyRound,
  Lock,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  MapPin,
  Calendar,
  Copy,
  Check,
  ShieldAlert,
  Smartphone
} from 'lucide-react';

interface VolunteerGateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGatePin?: string;
  onScanSuccess?: () => void;
}

type FeedbackType = 'verified' | 'already_entered' | 'wrong_event' | 'invalid' | null;

export const VolunteerGateScannerModal: React.FC<VolunteerGateScannerModalProps> = ({
  isOpen,
  onClose,
  initialGatePin = '',
  onScanSuccess,
}) => {
  // Gate PIN state
  const [gatePinInput, setGatePinInput] = useState<string>(initialGatePin);
  const [activeEvent, setActiveEvent] = useState<CollegeEvent | null>(null);
  const [pinError, setPinError] = useState<string>('');

  // Scanning & Feedback state
  const [feedbackState, setFeedbackState] = useState<FeedbackType>(null);
  const [activeScannedTicket, setActiveScannedTicket] = useState<Ticket | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [lastScannedTicket, setLastScannedTicket] = useState<Ticket | null>(null);

  // Sound effects toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual token input state
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualVerify, setShowManualVerify] = useState(false);

  // Camera state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Recent Gate Entries for this specific event
  const [recentGateEntries, setRecentGateEntries] = useState<Ticket[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-fill initial PIN if passed
  useEffect(() => {
    if (initialGatePin && initialGatePin.trim().length === 6) {
      setGatePinInput(initialGatePin.trim());
      handleValidatePin(initialGatePin.trim());
    }
  }, [initialGatePin, isOpen]);

  // Load recent entries for the active event
  const loadEventEntries = (eventId: string) => {
    const all = StorageService.getTickets();
    const eventEntries = all
      .filter(t => t.eventId === eventId && t.entryStatus === 'entered')
      .sort((a, b) => {
        const timeB = b.entryTimestamp ? new Date(b.entryTimestamp).getTime() : 0;
        const timeA = a.entryTimestamp ? new Date(a.entryTimestamp).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.entryTime || '').localeCompare(a.entryTime || '');
      });
    setRecentGateEntries(eventEntries);
  };

  // Listen to background sync updates
  useEffect(() => {
    if (activeEvent) {
      loadEventEntries(activeEvent.eventId);
    }
    const handleUpdate = () => {
      if (activeEvent) {
        loadEventEntries(activeEvent.eventId);
      }
    };
    window.addEventListener('campuspass_data_updated', handleUpdate);
    return () => window.removeEventListener('campuspass_data_updated', handleUpdate);
  }, [activeEvent]);

  // Sound effects
  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
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
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  // Validate the entered 6-digit gate PIN
  const handleValidatePin = (pinToTest?: string) => {
    setPinError('');
    const target = (pinToTest || gatePinInput).trim();
    if (target.length !== 6) {
      setPinError('Please enter a valid 6-digit numeric Gate PIN');
      return;
    }

    const matchedEvent = StorageService.validateVolunteerGatePin(target);
    if (!matchedEvent) {
      setPinError('Invalid or inactive Gate PIN. Please ask your organizer for the active 6-digit code.');
      setActiveEvent(null);
      return;
    }

    setActiveEvent(matchedEvent);
    setPinError('');
    loadEventEntries(matchedEvent.eventId);
  };

  // Start camera when activeEvent is established and modal is open
  useEffect(() => {
    if (isOpen && activeEvent) {
      isScanningActiveRef.current = true;
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [isOpen, activeEvent, facingMode]);

  const startCamera = async (targetFacingMode?: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    const activeFacing = targetFacingMode || facingMode;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or connection');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: activeFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        isScanningActiveRef.current = true;
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Volunteer Scanner camera start failed:', err);
      setCameraActive(false);
      setCameraError('Unable to access camera. Please allow camera permissions or use manual verification below.');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

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

  // Process the QR token or ticket ID through volunteer gate logic
  const processToken = (token: string) => {
    if (!token.trim() || !activeEvent) return;
    setIsProcessing(true);

    const result: ScannerScanResult = StorageService.verifyVolunteerScan(
      token.trim(),
      activeEvent.gatePin || gatePinInput,
      activeEvent.eventId
    );
    setIsProcessing(false);

    if (result.ticket) {
      setLastScannedTicket(result.ticket);
    }

    // Refresh event entries
    loadEventEntries(activeEvent.eventId);

    if (result.code === 'WRONG_HOST_OR_EVENT') {
      playSound('error');
      setFeedbackState('wrong_event');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(result.message || 'Pass belongs to a different event! Gate entry denied.');
      isScanningActiveRef.current = false;
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame();
      }, 3000);
    } else if (result.code === 'ALREADY_ENTERED') {
      playSound('error');
      setFeedbackState('already_entered');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(result.message || 'Already entered earlier today! Duplicate check-in rejected.');
      isScanningActiveRef.current = false;
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame();
      }, 2500);
    } else if (result.success) {
      playSound('success');
      setFeedbackState('verified');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(`Entry Allowed • Welcome ${result.ticket?.userName || 'Attendee'}`);
      isScanningActiveRef.current = false;

      if (onScanSuccess) {
        onScanSuccess();
      }

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame();
      }, 2000);
    } else {
      playSound('error');
      setFeedbackState('invalid');
      setActiveScannedTicket(result.ticket || null);
      setFeedbackMessage(result.message || 'Invalid Ticket QR Token.');
      isScanningActiveRef.current = false;
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackState(null);
        isScanningActiveRef.current = true;
        scanFrame();
      }, 2200);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenInput.trim()) return;
    processToken(manualTokenInput.trim());
    setManualTokenInput('');
    setShowManualVerify(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        
        {/* ================= STAGE 1: GATE PIN AUTHORIZATION SCREEN ================= */}
        {!activeEvent ? (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
              <KeyRound className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Volunteer Gate Scanner
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
              Enter the 6-digit Event Gate Passcode provided by your event organizer to start verifying student passes.
            </p>

            <div className="my-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left w-full flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900">
                <span className="font-bold">Sandboxed Volunteer Mode:</span> You can verify attendee QR passes at the entrance. Organizer financial revenue and bank account settings are securely protected.
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleValidatePin();
              }}
              className="w-full space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  6-Digit Event Passcode
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={gatePinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setGatePinInput(val);
                      setPinError('');
                      if (val.length === 6) {
                        handleValidatePin(val);
                      }
                    }}
                    placeholder="e.g. 482910"
                    className="w-full py-3.5 px-4 text-center text-2xl sm:text-3xl font-mono font-black tracking-widest rounded-2xl border-2 border-slate-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 outline-none transition uppercase"
                    autoFocus
                  />
                </div>
                {pinError && (
                  <p className="text-xs font-bold text-rose-600 mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              {/* Quick On-Screen Number Keypad for Tablets/Mobiles at Gates */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2">
                {['1','2','3','4','5','6','7','8','9','C','0','✓'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'C') {
                        setGatePinInput('');
                        setPinError('');
                      } else if (key === '✓') {
                        handleValidatePin();
                      } else {
                        if (gatePinInput.length < 6) {
                          const next = gatePinInput + key;
                          setGatePinInput(next);
                          if (next.length === 6) {
                            handleValidatePin(next);
                          }
                        }
                      }
                    }}
                    className={`py-2.5 rounded-xl text-base font-bold transition select-none active:scale-95 ${
                      key === '✓'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : key === 'C'
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={gatePinInput.length !== 6}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Unlock Gate Scanner</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================= STAGE 2: ACTIVE VOLUNTEER GATE SCANNER ================= */
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Header: Event Identity & Protection Badge */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Gate Volunteer</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    PIN: {activeEvent.gatePin || gatePinInput}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black truncate mt-1">
                  {activeEvent.title}
                </h3>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{activeEvent.venue}</span>
                  <span>•</span>
                  <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{activeEvent.date}</span>
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
                  title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                </button>
                <button
                  onClick={() => {
                    setActiveEvent(null);
                    setGatePinInput('');
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-bold flex items-center gap-1"
                  title="Lock Scanner"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Lock</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Counter Bar */}
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-700" />
                <span>Total Checked In: <strong className="font-black text-amber-950">{recentGateEntries.length}</strong></span>
              </div>
              <div className="text-[11px] text-amber-700 font-mono">
                Capacity: {activeEvent.capacity || 'Unlimited'}
              </div>
            </div>

            {/* Camera Viewport & Overlay */}
            <div className="relative bg-black flex-1 min-h-[260px] max-h-[360px] flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-52 h-52 sm:w-60 sm:h-60 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Glowing Laser Scan Bar */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
                  
                  {/* Corner Target Accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br" />

                  <div className="absolute -bottom-7 inset-x-0 text-center">
                    <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                      Align Student QR Pass
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls floating on camera */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={toggleCamera}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition"
                  title="Switch Camera (Front/Back)"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Camera Error Banner */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 p-6 flex flex-col items-center justify-center text-center text-white">
                  <Camera className="w-10 h-10 text-rose-400 mb-2" />
                  <p className="text-xs font-bold text-rose-300 max-w-xs">{cameraError}</p>
                  <button
                    onClick={() => startCamera()}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {/* ================= HIGH VISIBILITY 2-SECOND FULL FEEDBACK OVERLAY ================= */}
              {feedbackState && (
                <div
                  className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center text-white backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
                    feedbackState === 'verified'
                      ? 'bg-emerald-600/95'
                      : feedbackState === 'already_entered'
                      ? 'bg-rose-600/95'
                      : feedbackState === 'wrong_event'
                      ? 'bg-amber-600/95'
                      : 'bg-rose-700/95'
                  }`}
                >
                  {feedbackState === 'verified' && (
                    <>
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-bounce">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                        ENTRY ALLOWED
                      </h2>
                      <p className="text-base font-bold text-emerald-100 mt-1">
                        Welcome, {activeScannedTicket?.userName || 'Attendee'}!
                      </p>
                      <div className="mt-3 px-3 py-1 rounded-full bg-black/30 font-mono text-xs">
                        Pass ID: {activeScannedTicket?.ticketId} • Qty: {activeScannedTicket?.quantity || 1}
                      </div>
                    </>
                  )}

                  {feedbackState === 'already_entered' && (
                    <>
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-shake">
                        <X className="w-12 h-12 text-white" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                        ALREADY ENTERED!
                      </h2>
                      <p className="text-sm font-bold text-rose-100 mt-1 max-w-xs">
                        This pass was already scanned at {activeScannedTicket?.entryTime || 'earlier today'}.
                      </p>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-300 mt-2">
                        DO NOT ADMIT (DUPLICATE PASS)
                      </p>
                    </>
                  )}

                  {feedbackState === 'wrong_event' && (
                    <>
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3">
                        <ShieldAlert className="w-12 h-12 text-white" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                        WRONG EVENT!
                      </h2>
                      <p className="text-sm font-bold text-amber-100 mt-1 max-w-xs">
                        This pass is for "{activeScannedTicket?.eventTitle || 'Another Event'}", not for this gate!
                      </p>
                    </>
                  )}

                  {feedbackState === 'invalid' && (
                    <>
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3">
                        <AlertCircle className="w-12 h-12 text-white" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider">
                        INVALID PASS
                      </h2>
                      <p className="text-xs font-bold text-rose-200 mt-1">
                        {feedbackMessage}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Manual Entry Option & Recent Check-ins */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Manual Code Verification
                </span>
                <button
                  onClick={() => setShowManualVerify(!showManualVerify)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 transition"
                >
                  {showManualVerify ? 'Hide Keypad' : 'Type Ticket ID'}
                </button>
              </div>

              {showManualVerify && (
                <form onSubmit={handleManualSubmit} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="Enter Ticket ID (e.g. tkt-xxx)"
                    className="flex-1 py-2 px-3 text-xs font-mono rounded-xl border border-slate-300 focus:border-amber-500 outline-none uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!manualTokenInput.trim() || isProcessing}
                    className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50"
                  >
                    Verify Pass
                  </button>
                </form>
              )}

              {/* Recent Gate Entries Mini Stream (Newest Top) */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  <span>Recent Gate Entries (This Event)</span>
                  <span className="text-amber-700">{recentGateEntries.length} In</span>
                </div>

                {recentGateEntries.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2 text-center bg-slate-50 rounded-xl">
                    No attendees scanned at this gate yet. Ready to scan!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {recentGateEntries.slice(0, 5).map((t, idx) => (
                      <div
                        key={t.ticketId}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${
                          idx === 0
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {idx === 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white">
                              JUST NOW
                            </span>
                          )}
                          <span className="font-bold truncate">{t.userName}</span>
                          <span className="font-mono text-[10px] text-slate-500 truncate">({t.ticketId})</span>
                        </div>
                        <span className="font-mono text-[10px] text-emerald-700 shrink-0">
                          {t.entryTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
