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
  Download,
  Calendar,
  MapPin,
  RefreshCw
} from 'lucide-react';

interface PaymentModalProps {
  event: CollegeEvent;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticket: Ticket) => void;
}

type StepType = 'form' | 'processing' | 'verifying' | 'success' | 'failed';

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

  // Canvas for dynamic Pass QR rendering on success
  const ticketQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Pass QR on Success Screen
  useEffect(() => {
    if (step === 'success' && generatedTicket && ticketQrCanvasRef.current) {
      QRCode.toCanvas(
        ticketQrCanvasRef.current,
        generatedTicket.qrToken,
        {
          width: 120,
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

  // Free pass issuance (price = 0)
  const handleFreePassIssuance = async () => {
    if (!currentUser) {
      alert('Please log in first to get passes.');
      return;
    }
    if (!validateForm()) {
      return;
    }

    try {
      setStep('verifying');
      setErrorMessage('');

      const order = await PaymentService.createPaymentOrder(event.eventId);
      const freePaymentId = `free_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const verification = await PaymentService.verifyPayment({
        orderId: order.orderId,
        paymentId: freePaymentId,
        eventId: event.eventId,
        userId: currentUser.uid,
        userName: fullName.trim(),
        userEmail: email.trim(),
        phone: phone.trim(),
        college: collegeName.trim(),
        rollNo: rollNo.trim(),
        quantity: ticketQuantity,
        upiVpa: 'FREE_EVENT',
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
        setErrorMessage(verification.message || 'Pass generation failed.');
        setStep('failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Pass could not be issued.');
      setStep('failed');
    }
  };

  // Direct redirection to Razorpay Payment Gateway
  const handleRazorpayGatewayRedirect = async () => {
    if (!currentUser) {
      alert('Please log in first to purchase tickets.');
      return;
    }
    if (!validateForm()) {
      return;
    }

    if (totalAmount === 0) {
      handleFreePassIssuance();
      return;
    }

    try {
      setStep('processing');
      setErrorMessage('');

      // Step 1: Validate stock atomically and generate live Razorpay order
      const order = await PaymentService.createPaymentOrder(event.eventId, {
        amountInRupees: totalAmount,
        studentName: fullName.trim(),
        studentEmail: email.trim(),
        studentPhone: phone.trim(),
        quantity: ticketQuantity,
      });

      // Step 2: Directly open the Razorpay Standard Live Payment Gateway
      await PaymentService.openRazorpayCheckout({
        amountInRupees: totalAmount,
        eventName: event.title,
        eventId: event.eventId,
        studentName: fullName.trim(),
        studentEmail: email.trim(),
        studentPhone: phone.trim(),
        quantity: ticketQuantity,
        orderId: order.orderId,
        onSuccess: async (paymentId: string, orderId?: string, signature?: string) => {
          try {
            // Step 3: Payment received and confirmed by gateway -> generate pass immediately!
            setStep('verifying');
            const verification = await PaymentService.verifyPayment({
              orderId: orderId || order.orderId,
              paymentId: paymentId,
              eventId: event.eventId,
              userId: currentUser.uid,
              userName: fullName.trim(),
              userEmail: email.trim(),
              phone: phone.trim(),
              college: collegeName.trim(),
              rollNo: rollNo.trim(),
              quantity: ticketQuantity,
              upiVpa: `${phone.replace(/\D/g, '')}@upi`,
              signatureChallenge: order.signatureChallenge,
              razorpaySignature: signature
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
            setErrorMessage(err.message || 'Error completing payment verification.');
            setStep('failed');
          }
        },
        onDismiss: () => {
          // If student dismisses Razorpay checkout without paying, return to booking form
          setStep('form');
        },
        onError: (err: any) => {
          console.error('Razorpay payment error:', err);
          const desc = typeof err === 'string' ? err : err?.description || err?.message || 'Payment was cancelled or failed.';
          setErrorMessage(desc);
          setStep('failed');
        }
      });
    } catch (err: any) {
      console.error('Failed to open payment gateway:', err);
      setErrorMessage(err.message || 'Could not redirect to payment gateway.');
      setStep('failed');
    }
  };

  // Primary action click
  const handlePayClick = () => {
    if (totalAmount === 0) {
      handleFreePassIssuance();
    } else {
      handleRazorpayGatewayRedirect();
    }
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
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-20 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 shrink-0 border-b border-slate-100 bg-slate-50/70">
          <div className="pr-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1.5">
              <TicketIcon className="w-3 h-3" /> Event Pass Booking
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {step === 'form' && 'Booking Details'}
              {step === 'processing' && 'Redirecting to Payment Gateway...'}
              {step === 'verifying' && 'Payment Received! Generating Pass...'}
              {step === 'success' && 'Digital Pass Issued! 🎉'}
              {step === 'failed' && 'Transaction Status'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'form' && (totalAmount === 0 ? 'Fill your details to get your free pass instantly.' : 'Fill your details and click Pay to complete checkout.')}
              {step === 'processing' && 'Opening secure payment gateway window. Please complete payment.'}
              {step === 'verifying' && 'Payment confirmed! Minting digital entry pass with verified QR code.'}
              {step === 'success' && 'Your entry pass has been generated and saved to your account.'}
              {step === 'failed' && 'Payment could not be completed. You can try again.'}
            </p>
          </div>

          {/* Simple 2-Step Progress Indicator */}
          <div className="flex items-center justify-center gap-3 mt-3.5">
            {/* Step 1: Booking Details */}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                step === 'form'
                  ? 'bg-indigo-600 text-white shadow-xs ring-4 ring-indigo-100' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {step === 'form' ? '1' : '✓'}
              </div>
              <span className={`text-[11px] font-bold ${
                step === 'form' ? 'text-indigo-600' : 'text-slate-700'
              }`}>
                Fill Details
              </span>
            </div>
            <div className="h-0.5 w-10 sm:w-16 bg-slate-200" />

            {/* Step 2: Payment & Pass Issuance */}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                step === 'processing' || step === 'verifying'
                  ? 'bg-indigo-600 text-white shadow-xs ring-4 ring-indigo-100'
                  : step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-slate-100 text-slate-400'
              }`}>
                {step === 'success' ? '✓' : '2'}
              </div>
              <span className={`text-[11px] font-bold ${
                step === 'success' 
                  ? 'text-emerald-600' 
                  : step === 'processing' || step === 'verifying' 
                  ? 'text-indigo-600' 
                  : 'text-slate-400'
              }`}>
                Pay & Get Pass
              </span>
            </div>
          </div>
        </div>

        {/* ================= STEP 1: ATTENDEE BOOKING DETAILS FORM ================= */}
        {step === 'form' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-white">
              {/* Event Badge Summary */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Event</span>
                  <span className="font-bold text-slate-900 text-sm line-clamp-1">{event.title}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pass Price</span>
                  <span className="font-black text-indigo-700 text-sm">
                    {event.price === 0 ? 'FREE' : `₹${event.price}/pass`}
                  </span>
                </div>
              </div>

              {/* Student Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Student Full Name (On College ID) *</span>
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

              {/* Student Email Address */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Student Email Address (Ticket delivery) *</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. student@college.edu.in"
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

              {/* Mobile Phone Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mobile Number (SMS / WhatsApp Pass Alert) *</span>
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
                    <span>College / Institution *</span>
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
                    <span>Roll No / Student ID *</span>
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
                  <span className="text-sm font-bold text-slate-900 block">Number of Passes</span>
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
                    disabled={ticketQuantity >= maxAvailable}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center font-bold text-lg transition shadow-2xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Calculation Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600 font-medium">
                    Total Payable ({ticketQuantity} {ticketQuantity === 1 ? 'pass' : 'passes'})
                  </span>
                  <span className="text-2xl font-black text-indigo-700">
                    {totalAmount === 0 ? 'FREE' : `₹${totalAmount}`}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Anti-Counterfeit QR Pass issued instantly on confirmation</span>
                </div>
              </div>
            </div>

            {/* Direct Pay Action: Redirect directly to Razorpay Gateway */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0 space-y-2">
              <button
                type="button"
                onClick={handlePayClick}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-md transition transform active:scale-[0.98] cursor-pointer group"
              >
                {totalAmount === 0 ? (
                  <>
                    <TicketIcon className="w-5 h-5" />
                    <span>Confirm/Pay</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition" />
                    <span>Pay ₹{totalAmount}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                  </>
                )}
              </button>

              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-500 pt-0.5 text-center">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Secure Payment Verified
                </span>
                <span>•</span>
                <span>UPI (GPay, PhonePe, Paytm), Cards & NetBanking</span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">Instant Digital Pass</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PROCESSING & GATEWAY REDIRECTION ================= */}
        {(step === 'processing' || step === 'verifying') && (
          <div className="py-16 text-center flex flex-col items-center bg-white px-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-indigo-600">
                <Lock className="w-5 h-5 text-indigo-600" />
              </div>
            </div>

            <h3 className="text-lg font-black text-slate-900 mt-5">
              {step === 'processing' ? 'Connecting to Payment Gateway...' : 'Payment Confirmed! Minting Entry Pass...'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
              {step === 'processing'
                ? 'Opening secure payment gateway window. Complete payment via UPI, Card or NetBanking to receive your pass.'
                : 'Payment confirmed by bank. Cryptographically generating your official digital pass with anti-counterfeit QR code.'}
            </p>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>{step === 'processing' ? 'Redirecting to payment gateway...' : 'Issuing pass, please wait...'}</span>
            </div>
          </div>
        )}

        {/* ================= STEP 3: SUCCESS PASS ISSUANCE ("after payment receive generate pass") ================= */}
        {step === 'success' && generatedTicket && (
          <div className="text-center p-5 sm:p-6 animate-scale-in bg-white overflow-y-auto max-h-[80vh]">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase tracking-wider">
              Payment Received! Booking Confirmed 🎉
            </span>

            <h3 className="text-xl font-black text-slate-900 mt-1.5">
              Official Digital Pass Generated
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Show this QR code at the entry gate for instant verification.
            </p>

            {/* Visual Digital Pass Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-indigo-500/20 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-black block">FEST+ OFFICIAL ENTRY PASS</span>
                  <h4 className="font-black text-base text-white line-clamp-1">{generatedTicket.eventTitle}</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950/60 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    VERIFIED
                  </span>
                </div>
              </div>

              {/* Pass Middle: QR code & details */}
              <div className="flex items-center gap-4 py-2">
                <div className="p-2 bg-white rounded-2xl shadow-md shrink-0 flex items-center justify-center">
                  <canvas ref={ticketQrCanvasRef} className="rounded-lg" />
                </div>

                <div className="space-y-1.5 text-xs text-slate-200 min-w-0">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ATTENDEE</span>
                    <span className="font-bold text-white text-sm truncate block">{generatedTicket.userName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ROLL NO / COLLEGE</span>
                    <span className="text-slate-300 text-[11px] font-mono block truncate">
                      {generatedTicket.rollNo} • {generatedTicket.college}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-1 text-[11px]">
                    <span className="text-emerald-400 font-bold">{(generatedTicket.quantity || 1)} Pass{(generatedTicket.quantity || 1) > 1 ? 'es' : ''}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-300">ID: {generatedTicket.ticketId.slice(0, 10)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Anti-Counterfeit Secure Token
                </span>
                <span>Txn: {generatedTicket.paymentId.slice(0, 16)}</span>
              </div>
            </div>

            {/* Commercial Payment Receipt Breakdown */}
            <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1 font-mono">
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>PAYMENT REFERENCE:</span>
                <span className="font-bold text-slate-800">{generatedTicket.paymentId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>ORDER ID:</span>
                <span className="text-slate-700">{generatedTicket.orderId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>GATEWAY STATUS:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Razorpay Confirmed
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px] pt-1.5 border-t border-slate-200">
                <span className="font-sans font-medium text-slate-600">Total Settled:</span>
                <span className="font-sans font-black text-slate-900 text-sm">
                  {generatedTicket.amount === 0 ? 'FREE PASS' : `₹${generatedTicket.amount}`}
                </span>
              </div>
            </div>

            {/* Action Buttons to open and view the pass */}
            <div className="mt-4 space-y-2">
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

        {/* ================= STEP 4: TRANSACTION FAILED OR CANCELLED ================= */}
        {step === 'failed' && (
          <div className="text-center p-6 bg-white">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Payment Incomplete</h3>
            <p className="text-xs text-rose-600 mt-2 max-w-sm mx-auto leading-relaxed">
              {errorMessage || 'Payment was cancelled or could not be completed. No money was deducted.'}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={handlePayClick}
                className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Payment</span>
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-200 cursor-pointer"
              >
                <span>Edit Booking Details</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
