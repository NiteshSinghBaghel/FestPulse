import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { CollegeEvent, Ticket } from '../types';
import { PaymentService } from '../services/paymentService';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Ticket as TicketIcon,
  User,
  Mail,
  Phone,
  GraduationCap,
  Hash,
  Lock,
  Smartphone,
  CreditCard,
  Building2,
  QrCode,
  ArrowLeft,
  Shield,
  Check,
  Clock,
  Sparkles
} from 'lucide-react';

interface PaymentModalProps {
  event: CollegeEvent;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticket: Ticket) => void;
}

type StepType = 'form' | 'gateway' | 'processing' | 'verifying' | 'success' | 'failed';

export const PaymentModal: React.FC<PaymentModalProps> = ({ event, isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();

  // Booking Form State - Initialized with student details
  const isHost = currentUser?.role === 'host';
  const defaultStudentName = isHost || !currentUser?.name || currentUser.name.includes('Club') || currentUser.name.includes('Council')
    ? 'Aarav Mehta'
    : currentUser.name;
  const defaultStudentEmail = isHost || !currentUser?.email || currentUser.email.includes('nexus') || currentUser.email.includes('host')
    ? 'aarav@iitd.ac.in'
    : currentUser.email;

  const [fullName, setFullName] = useState(defaultStudentName);
  const [email, setEmail] = useState(defaultStudentEmail);
  const [phone, setPhone] = useState(currentUser?.phone || '9876543210');
  const [collegeName, setCollegeName] = useState(currentUser?.college || 'IIT Delhi');
  const [rollNo, setRollNo] = useState('CS23B041');
  const [ticketQuantity, setTicketQuantity] = useState(1);

  // Form validation errors
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Payment State
  const [step, setStep] = useState<StepType>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedTicket, setGeneratedTicket] = useState<Ticket | null>(null);

  // Gateway Checkout States (only inside dedicated Payment Gateway screen)
  const [gatewayMethod, setGatewayMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [gatewayUpiId, setGatewayUpiId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('gpay');
  const [cardNumber, setCardNumber] = useState('4532 8921 4410 9024');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('872');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [timeLeft, setTimeLeft] = useState(599); // 9 mins 59 secs

  // Canvases for dynamic QR rendering
  const upiQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const ticketQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Countdown timer for Payment Gateway
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'gateway') {
      interval = setInterval(() => {
        setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // Render UPI QR in Gateway screen
  useEffect(() => {
    if (step === 'gateway' && upiQrCanvasRef.current) {
      const upiUrl = `upi://pay?pa=campuspass@icici&pn=CampusPass&am=${event.price * ticketQuantity}&cu=INR&tn=Pass_${event.eventId}`;
      QRCode.toCanvas(
        upiQrCanvasRef.current,
        upiUrl,
        {
          width: 140,
          margin: 1,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('Error generating UPI QR code', err);
        }
      );
    }
  }, [step, gatewayMethod, event.price, ticketQuantity]);

  // Render Pass QR on Success Screen
  useEffect(() => {
    if (step === 'success' && generatedTicket && ticketQrCanvasRef.current) {
      QRCode.toCanvas(
        ticketQrCanvasRef.current,
        generatedTicket.qrToken,
        {
          width: 100,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('Error generating Pass QR code', err);
        }
      );
    }
  }, [step, generatedTicket]);

  if (!isOpen) return null;

  const maxAvailable = Math.min(5, event.availableTickets);
  const totalAmount = event.price * ticketQuantity;

  const handleIncrement = () => {
    if (ticketQuantity < maxAvailable) {
      setTicketQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (ticketQuantity > 1) {
      setTicketQuantity(prev => prev - 1);
    }
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Please enter your full name.';
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = 'Please enter a valid student email address.';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Please enter a 10-digit mobile number.';
    }
    if (!collegeName.trim()) {
      errors.collegeName = 'Please enter your college/institution name.';
    }
    if (!rollNo.trim()) {
      errors.rollNo = 'Please enter your student Roll No / ID.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Direct Pay button click: Redirects user straight to Payment Gateway (or creates free pass if ₹0)
  const handleDirectPayClick = () => {
    if (!validateForm()) {
      return;
    }

    if (totalAmount === 0) {
      // Free pass -> instant mint without payment gateway
      handleExecutePayment('FREE_PASS');
    } else {
      // Redirect to Payment Gateway
      setStep('gateway');
    }
  };

  // Execute payment from inside Payment Gateway
  const handleExecutePayment = async (overrideVpa?: string) => {
    if (!currentUser) {
      alert('Please log in first to purchase tickets.');
      return;
    }

    try {
      setStep('processing');
      setErrorMessage('');

      // Step 1: Server-side order creation (validates stock atomically)
      const order = await PaymentService.createPaymentOrder(event.eventId);

      // Step 2: Payment Gateway Simulation
      setStep('verifying');
      const dummyPaymentId = `pay_gw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const vpaAddress = overrideVpa || gatewayUpiId.trim() || `${phone}@upi`;

      // Step 3: Server verifies payment signature, decrements stock by quantity, and mints ticket
      const verification = await PaymentService.verifyPayment({
        orderId: order.orderId,
        paymentId: dummyPaymentId,
        eventId: event.eventId,
        userId: currentUser.uid,
        userName: fullName.trim(),
        userEmail: email.trim(),
        phone: phone.trim(),
        college: collegeName.trim(),
        rollNo: rollNo.trim(),
        quantity: ticketQuantity,
        upiVpa: vpaAddress,
        signatureChallenge: order.signatureChallenge
      });

      if (verification.success && verification.ticket) {
        setGeneratedTicket(verification.ticket);
        setStep('success');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
        onSuccess(verification.ticket);
      } else {
        setErrorMessage(verification.message || 'Payment verification failed.');
        setStep('failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment could not be processed.');
      setStep('failed');
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={() => {
        if (step !== 'processing' && step !== 'verifying') {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900 cursor-default"
      >
        {/* Close Button */}
        {step !== 'processing' && step !== 'verifying' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-3 shrink-0 border-b border-slate-100 bg-slate-50/70">
          <div className="pr-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1.5">
              <TicketIcon className="w-3 h-3" /> Event Pass Booking Form
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {step === 'form' && 'Enter Booking Details'}
              {step === 'gateway' && 'Payment Gateway Checkout'}
              {(step === 'processing' || step === 'verifying') && 'Processing Payment...'}
              {step === 'success' && 'Pass Issued Successfully!'}
              {step === 'failed' && 'Transaction Status'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'form' && 'Fill details below and click Pay to redirect to secure payment gateway.'}
              {step === 'gateway' && 'Redirected to secure gateway. Complete payment to receive your digital pass.'}
              {(step === 'processing' || step === 'verifying') && 'Authorizing transaction with bank and minting entry pass.'}
              {step === 'success' && 'Payment verified! Your official digital pass is ready for gate entry.'}
              {step === 'failed' && 'Unable to complete transaction. Please retry or contact support.'}
            </p>
          </div>

          {/* 3-Step Indicator */}
          <div className="flex items-center justify-center gap-3 mt-3">
            {/* Step 1: Details */}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                step === 'form'
                  ? 'bg-indigo-600 text-white shadow-xs ring-4 ring-indigo-100' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {step === 'form' ? '1' : '✓'}
              </div>
              <span className={`text-[11px] font-bold hidden sm:inline ${
                step === 'form' ? 'text-indigo-600' : 'text-slate-700'
              }`}>
                Details
              </span>
            </div>
            <div className="h-0.5 w-8 sm:w-12 bg-slate-200" />

            {/* Step 2: Payment Gateway */}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                step === 'gateway' || step === 'processing' || step === 'verifying'
                  ? 'bg-indigo-600 text-white shadow-xs ring-4 ring-indigo-100'
                  : step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-slate-100 text-slate-400'
              }`}>
                {step === 'success' ? '✓' : '2'}
              </div>
              <span className={`text-[11px] font-bold hidden sm:inline ${
                step === 'gateway' || step === 'processing' || step === 'verifying' ? 'text-indigo-600' : 'text-slate-700'
              }`}>
                Payment Gateway
              </span>
            </div>
            <div className="h-0.5 w-8 sm:w-12 bg-slate-200" />

            {/* Step 3: Get Pass */}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                step === 'success'
                  ? 'bg-emerald-600 text-white shadow-xs ring-4 ring-emerald-100'
                  : 'border border-slate-200 bg-slate-100 text-slate-400'
              }`}>
                {step === 'success' ? '✓' : '3'}
              </div>
              <span className={`text-[11px] font-bold hidden sm:inline ${
                step === 'success' ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                Get Pass
              </span>
            </div>
          </div>
        </div>

        {/* ================= STEP 1: ATTENDEE BOOKING FORM (No Payment Gateway Option Here) ================= */}
        {step === 'form' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-white">
              {/* Event Badge Summary */}
              <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Booking For</span>
                  <span className="font-bold text-slate-900">{event.title}</span>
                </div>
                <span className="font-black text-indigo-700 text-sm">
                  {event.price === 0 ? 'FREE' : `₹${event.price}/pass`}
                </span>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Full name (as on Student ID) *</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Mehta"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border ${
                    formErrors.fullName ? 'border-rose-500' : 'border-slate-200'
                  } text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition`}
                />
                {formErrors.fullName && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.fullName}</p>
                )}
              </div>

              {/* College Email */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>College email address (for pass delivery) *</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. aarav@iitd.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border ${
                    formErrors.email ? 'border-rose-500' : 'border-slate-200'
                  } text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition`}
                />
                {formErrors.email && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Mobile / WhatsApp */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mobile number (WhatsApp notifications) *</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border ${
                    formErrors.phone ? 'border-rose-500' : 'border-slate-200'
                  } text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition font-mono`}
                />
                {formErrors.phone && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.phone}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* College / University */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>College / University *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Delhi"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border ${
                      formErrors.collegeName ? 'border-rose-500' : 'border-slate-200'
                    } text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition`}
                  />
                  {formErrors.collegeName && (
                    <p className="text-[11px] text-rose-500 mt-1">{formErrors.collegeName}</p>
                  )}
                </div>

                {/* Student Roll Number */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Student Roll No / ID *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS23B041"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border ${
                      formErrors.rollNo ? 'border-rose-500' : 'border-slate-200'
                    } text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition font-mono`}
                  />
                  {formErrors.rollNo && (
                    <p className="text-[11px] text-rose-500 mt-1">{formErrors.rollNo}</p>
                  )}
                </div>
              </div>

              {/* Number of passes */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Number of passes</span>
                  <span className="text-xs text-slate-500">Max 5 passes per student</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={ticketQuantity <= 1}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center font-bold text-lg transition shadow-2xs cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-black text-base text-slate-900 w-6 text-center">
                    {ticketQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={ticketQuantity >= Math.min(5, event.availableTickets)}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center font-bold text-lg transition shadow-2xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Pass Total Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-medium">
                    Total Amount ({ticketQuantity} {ticketQuantity === 1 ? 'pass' : 'passes'})
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {totalAmount === 0 ? 'FREE' : `₹${totalAmount}`}
                  </span>
                </div>
                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Booking fee waived • Instant Pass Generation
                </div>
              </div>
            </div>

            {/* Direct Pay Button: User directly clicks Pay and redirects to Payment Gateway */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0 space-y-2">
              <button
                type="button"
                onClick={handleDirectPayClick}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-md transition transform active:scale-[0.98] cursor-pointer"
              >
                {totalAmount === 0 ? (
                  <>
                    <TicketIcon className="w-5 h-5" />
                    <span>Confirm Details & Get Free Pass 🎉</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-emerald-300" />
                    <span>Pay ₹{totalAmount}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Redirects to secure payment gateway • Pass issued instantly</span>
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 2: DEDICATED PAYMENT GATEWAY REDIRECT SCREEN ================= */}
        {step === 'gateway' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/60">
            {/* Payment Gateway Header & Order Summary */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold tracking-wide">CampusPass Secure Gateway</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                  <Clock className="w-3 h-3 text-amber-300" />
                  <span>Expires: {formatTimer(timeLeft)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Total Payable</span>
                  <span className="text-2xl font-black text-white">₹{totalAmount}</span>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <span className="block font-bold text-white line-clamp-1">{event.title}</span>
                  <span>{ticketQuantity} {ticketQuantity === 1 ? 'ticket' : 'tickets'} • {fullName}</span>
                </div>
              </div>
            </div>

            {/* Gateway Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white">
              {/* Payment Gateway Channel Tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGatewayMethod('upi')}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition cursor-pointer ${
                    gatewayMethod === 'upi'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Instant UPI</span>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-full">
                    Fastest
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGatewayMethod('card')}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition cursor-pointer ${
                    gatewayMethod === 'card'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Cards</span>
                  <span className="text-[9px] text-slate-400 font-normal">Visa / RuPay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGatewayMethod('netbanking')}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition cursor-pointer ${
                    gatewayMethod === 'netbanking'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Net Banking</span>
                  <span className="text-[9px] text-slate-400 font-normal">All Banks</span>
                </button>
              </div>

              {/* METHOD 1: UPI & QR SCANNER */}
              {gatewayMethod === 'upi' && (
                <div className="space-y-3.5 animate-fade-in">
                  {/* Dynamic QR Scan Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0 flex flex-col items-center">
                      <canvas ref={upiQrCanvasRef} className="rounded" />
                      <span className="text-[9px] font-mono font-bold text-slate-500 mt-1">SCAN ANY UPI</span>
                    </div>

                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        <Check className="w-3 h-3" /> Auto-Verification Active
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Scan & Pay ₹{totalAmount} with any UPI App</h4>
                      <p className="text-xs text-slate-500">
                        Scan with Google Pay, PhonePe, Paytm, or CRED to approve ₹{totalAmount}.
                      </p>
                    </div>
                  </div>

                  {/* Fast UPI Apps Buttons */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">Or Pay via Installed UPI App:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'gpay', name: 'Google Pay', color: 'text-blue-600' },
                        { id: 'phonepe', name: 'PhonePe', color: 'text-purple-600' },
                        { id: 'paytm', name: 'Paytm UPI', color: 'text-cyan-600' }
                      ].map((app) => (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => setSelectedUpiApp(app.id)}
                          className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedUpiApp === app.id
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-black'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${app.id === selectedUpiApp ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                          <span>{app.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UPI VPA input fallback */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-medium">Or enter VPA / UPI ID:</span>
                      <span className="text-emerald-700 font-bold font-mono">Verified Gateway</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or student@oksbi"
                      value={gatewayUpiId}
                      onChange={(e) => setGatewayUpiId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* METHOD 2: DEBIT / CREDIT CARD */}
              {gatewayMethod === 'card' && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Valid Thru (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Cards secured by PCI-DSS Level 1 compliance
                  </p>
                </div>
              )}

              {/* METHOD 3: NET BANKING */}
              {gatewayMethod === 'netbanking' && (
                <div className="space-y-2.5 animate-fade-in">
                  <label className="text-xs font-bold text-slate-700 block">Select Your Bank</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'Punjab National'].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex items-center gap-2 cursor-pointer ${
                          selectedBank === bank
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">{bank}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Gateway Actions */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0 space-y-2">
              <button
                type="button"
                onClick={() => handleExecutePayment()}
                className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition transform active:scale-[0.98] cursor-pointer"
              >
                <Lock className="w-4 h-4 text-emerald-200" />
                <span>Authorize & Pay ₹{totalAmount} Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel & Return to Booking Details</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: GATEWAY PROCESSING ANIMATION ================= */}
        {(step === 'processing' || step === 'verifying') && (
          <div className="py-14 text-center flex flex-col items-center bg-white px-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-indigo-600">
                PAY
              </div>
            </div>

            <h3 className="text-lg font-black text-slate-900 mt-5">
              {step === 'processing' ? 'Connecting to Bank & Payment Gateway...' : 'Minting Entry Pass with QR...'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
              {step === 'processing'
                ? 'Securing order inventory lock and confirming transaction'
                : 'Payment confirmed! Generating digital ticket pass with anti-counterfeit QR code'}
            </p>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Processing payment, please wait...
            </div>
          </div>
        )}

        {/* ================= STEP 4: SUCCESS PASS ISSUANCE ("after payment done he will get pass") ================= */}
        {step === 'success' && generatedTicket && (
          <div className="text-center p-6 animate-scale-in bg-white">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider">
              Payment Done! Booking Confirmed 🎉
            </span>

            <h3 className="text-xl font-black text-slate-900 mt-2">
              Pass Issued Successfully!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Your official college event pass has been issued and stored in My Tickets.
            </p>

            {/* Official Pass Preview Card with Real QR */}
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left relative overflow-hidden shadow-xs">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">
                    CampusPass Official Pass
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{generatedTicket.eventTitle}</h4>
                  <p className="text-xs text-slate-500">{generatedTicket.eventDate} • {generatedTicket.eventVenue}</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {generatedTicket.ticketId}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs space-y-0.5">
                  <p className="text-slate-800 font-bold">{generatedTicket.userName}</p>
                  {generatedTicket.rollNo && (
                    <p className="text-slate-500 text-[11px]">Roll No: {generatedTicket.rollNo}</p>
                  )}
                  <p className="text-emerald-600 text-[11px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Entry-Only Verified Pass
                  </p>
                </div>

                {/* Real Rendered QR Code */}
                <div className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 flex flex-col items-center shrink-0 shadow-2xs">
                  <canvas ref={ticketQrCanvasRef} className="rounded" />
                  <span className="text-[8px] font-mono font-bold text-slate-600 mt-0.5">SCAN AT GATE</span>
                </div>
              </div>
            </div>

            {/* Action Buttons to open and take the pass */}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSuccess(generatedTicket);
                  onClose();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>Open & Take My Digital Pass 🎟️</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: FAILED ================= */}
        {step === 'failed' && (
          <div className="text-center p-6 bg-white">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Booking Failed</h3>
            <p className="text-xs text-rose-600 mt-2 max-w-xs mx-auto">
              {errorMessage || 'Unable to complete payment transaction. Please try again.'}
            </p>

            <button
              onClick={() => setStep('form')}
              className="mt-5 py-2.5 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-200 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
