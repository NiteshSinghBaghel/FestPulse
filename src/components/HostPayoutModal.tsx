import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PayoutRecord } from '../types';
import { PaymentService, RazorpayGatewayConfigStatus } from '../services/paymentService';
import { downloadPayoutInvoice } from './PayoutInvoiceModal';
import { 
  X, 
  IndianRupee, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  Smartphone, 
  ShieldCheck, 
  Loader2, 
  Download, 
  AlertCircle,
  Sparkles,
  Printer
} from 'lucide-react';

interface HostPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  totalRevenue?: number;
  totalTransferred?: number;
  totalTicketsSold?: number;
  onPayoutSuccess: (payout: PayoutRecord) => void;
}

export const HostPayoutModal: React.FC<HostPayoutModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  totalRevenue,
  totalTransferred,
  totalTicketsSold,
  onPayoutSuccess,
}) => {
  const { currentUser } = useAuth();

  const [transferMethod, setTransferMethod] = useState<'UPI' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [amount, setAmount] = useState<number>(availableBalance);
  const [saveBankDetails, setSaveBankDetails] = useState<boolean>(true);
  const [serverBalance, setServerBalance] = useState<number | null>(null);
  const [serverGross, setServerGross] = useState<number | null>(null);
  const [serverTransferred, setServerTransferred] = useState<number | null>(null);
  const [serverTicketsSold, setServerTicketsSold] = useState<number | null>(null);

  // UPI fields (real user data only — no fake defaults)
  const [upiId, setUpiId] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(currentUser?.name || '');

  // Bank fields (user-entered or saved in host's own payout profile)
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Connecting to Central RazorpayX Gateway...');
  const [completedPayout, setCompletedPayout] = useState<PayoutRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState<RazorpayGatewayConfigStatus | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Synchronize amount, gateway config, organizer revenue & saved bank details when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount(availableBalance > 0 ? availableBalance : 0);
      setCompletedPayout(null);
      setErrorMessage('');
      setIsProcessing(false);
      setServerBalance(null);
      setServerGross(null);
      setServerTransferred(null);
      setServerTicketsSold(null);
      if (currentUser?.name) {
        setAccountHolderName((prev) => prev || currentUser.name);
      }
      setIsLoadingConfig(true);
      Promise.all([
        PaymentService.getRazorpayGatewayConfig().catch(() => null),
        currentUser?.uid
          ? PaymentService.getHostRevenueSummary(currentUser.uid, currentUser.email).catch(() => null)
          : Promise.resolve(null),
        currentUser?.uid
          ? PaymentService.getHostPayoutProfile(currentUser.uid).catch(() => null)
          : Promise.resolve(null),
      ])
        .then(([cfg, rev, profile]) => {
          setGatewayConfig(cfg);
          if (rev && rev.success) {
            setServerBalance(rev.availableBalance);
            setServerGross(rev.totalRevenue);
            setServerTransferred(rev.totalTransferred);
            setServerTicketsSold(rev.totalTicketsSold);
            if (rev.availableBalance > 0) {
              setAmount(rev.availableBalance);
            } else if (rev.totalEvents > 0 || rev.totalTransferred > 0) {
              setAmount(0);
            }
          }
          if (profile) {
            if (profile.preferredMethod === 'UPI' || profile.preferredMethod === 'BANK_TRANSFER') {
              setTransferMethod(profile.preferredMethod);
            }
            if (profile.accountHolderName) setAccountHolderName(profile.accountHolderName);
            if (profile.accountNumber) {
              setAccountNumber(profile.accountNumber);
              setConfirmAccountNumber(profile.accountNumber);
            }
            if (profile.ifscCode) setIfscCode(profile.ifscCode);
            if (profile.bankName) setBankName(profile.bankName);
            if (profile.upiId) setUpiId(profile.upiId);
          }
        })
        .finally(() => setIsLoadingConfig(false));
    }
  }, [isOpen, availableBalance, currentUser]);

  if (!isOpen) return null;

  const effectiveAvailableBalance = serverBalance !== null ? serverBalance : availableBalance;
  const effectiveGrossRevenue = serverGross !== null ? serverGross : totalRevenue ?? effectiveAvailableBalance;
  const effectiveTransferred = serverTransferred !== null ? serverTransferred : totalTransferred ?? 0;
  const effectiveTicketsSold = serverTicketsSold !== null ? serverTicketsSold : totalTicketsSold;

  const handleTransfer = async () => {
    setErrorMessage('');
    if (amount <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than ₹0.');
      return;
    }
    if (amount > effectiveAvailableBalance) {
      setErrorMessage(`Demanded amount exceeds available sold-ticket balance (₹${effectiveAvailableBalance.toLocaleString()}).`);
      return;
    }

    if (transferMethod === 'UPI') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setErrorMessage('Please enter a valid UPI VPA (e.g. mobile@upi or name@oksbi).');
        return;
      }
      if (!accountHolderName.trim()) {
        setErrorMessage('Beneficiary name is required.');
        return;
      }
    } else {
      if (!accountNumber.trim() || accountNumber.length < 8) {
        setErrorMessage('Please enter a valid bank account number (min 8 digits).');
        return;
      }
      if (accountNumber !== confirmAccountNumber) {
        setErrorMessage('Account numbers do not match.');
        return;
      }
      if (!ifscCode.trim() || ifscCode.length < 5) {
        setErrorMessage('Please enter a valid 11-character bank IFSC code.');
        return;
      }
      if (!accountHolderName.trim()) {
        setErrorMessage('Account holder name is required.');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStatus(
      `Dispatching ₹${amount.toLocaleString()} from Central Gateway via RazorpayX (${transferMethod === 'UPI' ? 'UPI VPA' : 'Bank IMPS'})...`
    );

    try {
      const result = await PaymentService.processHostPayout({
        hostId: currentUser?.uid || '',
        hostEmail: currentUser?.email || '',
        hostName: currentUser?.name || 'Event Host',
        amount: Number(amount),
        method: transferMethod,
        destination: transferMethod === 'UPI' ? upiId.trim() : accountNumber.trim(),
        accountHolderName: accountHolderName.trim(),
        bankName: transferMethod === 'BANK_TRANSFER' ? bankName.trim() : undefined,
        ifscCode: transferMethod === 'BANK_TRANSFER' ? ifscCode.trim().toUpperCase() : undefined,
        notes: `Organizer sold-ticket settlement via Central Gateway (${transferMethod})`,
        saveBankDetails,
      });

      if (result.success && result.payout) {
        setCompletedPayout(result.payout);
        setIsProcessing(false);
        onPayoutSuccess(result.payout);
      } else {
        setIsProcessing(false);
        setErrorMessage(result.message || 'Transfer failed. Please try again.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Settlement failed. Please try again.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900">
        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-20 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="pr-8 pb-3 border-b border-slate-100 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3 h-3 text-emerald-600" /> Direct Revenue Settlement
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {completedPayout ? 'Settlement Successful! 🎉' : 'Host Revenue Settlement'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedPayout 
              ? 'Funds dispatched directly to your destination account via instant clearing.' 
              : 'Directly transfer your ticket earnings to your UPI ID or Bank Account on demand.'}
          </p>
        </div>

        {/* SUCCESS RECEIPT STATE */}
        {completedPayout ? (
          <div className="py-4 text-center space-y-4 animate-scale-in flex-1 overflow-y-auto pr-1">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                Settled Amount Transferred
              </span>
              <span className="text-3xl font-black text-emerald-600">
                ₹{completedPayout.amount.toLocaleString()}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Dispatched via Instant Settlement Network ({completedPayout.method === 'UPI' ? 'Instant UPI VPA' : 'Bank IMPS Direct'})
              </p>
            </div>

            {/* Official Settlement Receipt Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium font-sans">Payout ID:</span>
                <span className="font-bold text-slate-900">{completedPayout.payoutId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium font-sans">Bank UTR / Ref No:</span>
                <span className="font-bold text-indigo-600">{completedPayout.referenceId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium font-sans">Beneficiary:</span>
                <span className="font-bold text-slate-900">{completedPayout.accountHolderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium font-sans">Destination:</span>
                <span className="text-slate-800 break-all">{completedPayout.destination}</span>
              </div>
              {completedPayout.ifscCode && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium font-sans">Bank IFSC:</span>
                  <span className="text-slate-700">{completedPayout.ifscCode}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-medium font-sans">Gateway Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase flex items-center gap-1 font-sans">
                  <CheckCircle2 className="w-3 h-3" /> SETTLED • DISPATCHED
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => downloadPayoutInvoice(completedPayout, currentUser?.college)}
                className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Tax Invoice</span>
              </button>

              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-slate-200 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* TRANSFER FORM */
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 text-xs pr-1">
            {/* Balance Overview Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">
                    Available Balance to Settle
                  </span>
                  <span className="text-2xl font-black text-emerald-900">
                    ₹{effectiveAvailableBalance.toLocaleString()}
                  </span>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    Collected via Central Gateway{typeof effectiveTicketsSold === 'number' ? ` (${effectiveTicketsSold} tickets sold)` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={effectiveAvailableBalance <= 0}
                  onClick={() => setAmount(effectiveAvailableBalance)}
                  className="py-1.5 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer shrink-0"
                >
                  Settle Full Balance
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/70 text-[11px]">
                <div className="bg-white/70 rounded-xl px-2.5 py-1.5">
                  <span className="text-slate-500 block text-[10px]">Total Sold Collections</span>
                  <span className="font-black text-slate-800">₹{effectiveGrossRevenue.toLocaleString()}</span>
                </div>
                <div className="bg-white/70 rounded-xl px-2.5 py-1.5">
                  <span className="text-slate-500 block text-[10px]">Already Settled</span>
                  <span className="font-black text-indigo-700">₹{effectiveTransferred.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Central Backend Gateway & RazorpayX Payout Status */}
            {!isLoadingConfig && gatewayConfig && (!gatewayConfig.isConfigured || !gatewayConfig.hasValidPayoutAccount) && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs space-y-1">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {!gatewayConfig.isConfigured
                        ? 'Backend Central Gateway Setup Pending'
                        : 'Backend RazorpayX Payout Account Required'}
                    </span>
                    <span className="text-[11px] text-indigo-800 block mt-0.5 leading-relaxed">
                      {!gatewayConfig.isConfigured
                        ? 'Platform Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) must be configured by the backend administrator in .env / Secrets.'
                        : 'Ticket payments are already going into the central backend Razorpay gateway and tracked above. To enable self-serve bank transfers here, the platform administrator must configure a numeric RazorpayX Current/Virtual Account Number (RAZORPAY_ACCOUNT_NUMBER) in backend .env / Secrets.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Zero Balance Notice */}
            {effectiveAvailableBalance <= 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">No Pending Settlement Balance</span>
                  <span className="text-[11px] text-amber-800">
                    Your current available balance is ₹0. When students purchase paid passes for your events, the verified amount is credited to your organizer balance for settlement here.
                  </span>
                </div>
              </div>
            )}

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Transfer Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  Settlement Amount *
                </label>
                <span className="text-[11px] text-slate-400">Min: ₹1 • Max: ₹{effectiveAvailableBalance.toLocaleString()}</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min={1}
                  max={effectiveAvailableBalance}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-base focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Quick Demand Percentage Buttons */}
              <div className="flex gap-2 mt-2">
                {[
                  { label: '25%', frac: 0.25 },
                  { label: '50%', frac: 0.5 },
                  { label: '75%', frac: 0.75 },
                  { label: '100% (All)', frac: 1.0 }
                ].map(({ label, frac }) => {
                  const fractionAmount = Math.round(effectiveAvailableBalance * frac);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAmount(fractionAmount)}
                      className={`flex-1 py-1.5 rounded-lg border font-bold text-[11px] transition cursor-pointer ${
                        amount === fractionAmount
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payout Destination Method Selector */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Select Your Settlement Account:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferMethod('BANK_TRANSFER')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    transferMethod === 'BANK_TRANSFER'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold text-xs">Bank Account</p>
                    <p className="text-[10px] text-slate-500">IMPS / NEFT direct credit</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferMethod('UPI')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    transferMethod === 'UPI'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-bold text-xs">Direct UPI VPA</p>
                    <p className="text-[10px] text-slate-500">Instant GPay / PhonePe / Paytm</p>
                  </div>
                </button>
              </div>
            </div>

            {/* METHOD 1: UPI FORM */}
            {transferMethod === 'UPI' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">
                      Host UPI ID / VPA *
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Instant Settlement
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. host@okaxis or 9876543210@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Supported: Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Beneficiary Name (As on UPI Account) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Campus Student Council"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>
            )}

            {/* METHOD 2: BANK TRANSFER FORM */}
            {transferMethod === 'BANK_TRANSFER' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Campus Student Council"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Bank Account Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 50100492819201"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Confirm Account Number *
                    </label>
                    <input
                      type="text"
                      placeholder="Re-enter Account Number"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Bank IFSC Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0000128"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono uppercase focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Bank Name & Branch
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank - Main Campus"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Bank Details Toggle */}
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={saveBankDetails}
                onChange={(e) => setSaveBankDetails(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Save my Bank / UPI details securely to this organizer login for faster future settlements</span>
            </label>

            {/* Gateway Security Badge */}
            <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-[11px] text-indigo-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Settled from Central Backend Gateway • 24x7 IMPS / UPI</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">24x7 IMPS</span>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={
                  isProcessing ||
                  isLoadingConfig ||
                  effectiveAvailableBalance <= 0 ||
                  amount <= 0 ||
                  Boolean(gatewayConfig && (!gatewayConfig.isConfigured || !gatewayConfig.hasValidPayoutAccount))
                }
                onClick={handleTransfer}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition transform active:scale-95 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{processingStatus}</span>
                  </>
                ) : (
                  <>
                    <IndianRupee className="w-4 h-4 text-emerald-300" />
                    <span>Settle ₹{amount.toLocaleString()} Directly to Host {transferMethod === 'UPI' ? 'UPI' : 'Bank'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
