import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { PayoutRecord } from '../types';
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
  FileCheck,
  AlertCircle
} from 'lucide-react';

interface HostPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onPayoutSuccess: (payout: PayoutRecord) => void;
}

export const HostPayoutModal: React.FC<HostPayoutModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  onPayoutSuccess,
}) => {
  const { currentUser } = useAuth();

  const [transferMethod, setTransferMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [amount, setAmount] = useState<number>(availableBalance);
  
  // UPI fields
  const [upiId, setUpiId] = useState('organizer@okhdfcbank');
  
  // Bank fields
  const [accountNumber, setAccountNumber] = useState('50100492819201');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('50100492819201');
  const [ifscCode, setIfscCode] = useState('HDFC0000128');
  const [accountHolderName, setAccountHolderName] = useState(currentUser?.name || 'Campus Student Council');
  const [bankName, setBankName] = useState('HDFC Bank - Hauz Khas');

  const [isProcessing, setIsProcessing] = useState(false);
  const [completedPayout, setCompletedPayout] = useState<PayoutRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleTransfer = () => {
    setErrorMessage('');
    if (amount <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than ₹0.');
      return;
    }
    if (amount > availableBalance) {
      setErrorMessage(`Transfer amount exceeds available balance (₹${availableBalance.toLocaleString()}).`);
      return;
    }

    if (transferMethod === 'UPI') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setErrorMessage('Please enter a valid UPI ID (e.g. name@okaxis or name@upi).');
        return;
      }
    } else {
      if (!accountNumber.trim() || accountNumber.length < 8) {
        setErrorMessage('Please enter a valid bank account number.');
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

    // Simulate instant bank clearing / IMPS UPI settlement
    setTimeout(() => {
      try {
        const destination = transferMethod === 'UPI' 
          ? upiId.trim() 
          : `${accountNumber.trim()} (${bankName || 'Bank Account'})`;

        const newPayout = StorageService.createPayout({
          hostId: currentUser?.uid || 'host-council-101',
          hostName: currentUser?.name || 'Campus Organizing Committee',
          amount: Number(amount),
          currency: 'INR',
          method: transferMethod,
          destination,
          accountHolderName: accountHolderName.trim(),
          bankName: transferMethod === 'BANK_TRANSFER' ? bankName.trim() : undefined,
          ifscCode: transferMethod === 'BANK_TRANSFER' ? ifscCode.trim().toUpperCase() : undefined,
        });

        setCompletedPayout(newPayout);
        setIsProcessing(false);
        onPayoutSuccess(newPayout);
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMessage(err.message || 'Transfer failed. Please try again.');
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900">
        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-20"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="pr-8 pb-3 border-b border-slate-100 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-1.5">
            <IndianRupee className="w-3 h-3" /> Host Payout & Revenue Transfer
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {completedPayout ? 'Transfer Successful!' : 'Transfer Revenue to Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedPayout 
              ? 'Funds have been dispatched instantly to your chosen bank/UPI account.' 
              : 'Withdraw verified ticket collections directly to your Bank or UPI.'}
          </p>
        </div>

        {/* SUCCESS RECEIPT STATE */}
        {completedPayout ? (
          <div className="py-5 text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                Settled Amount
              </span>
              <span className="text-3xl font-black text-emerald-600">
                ₹{completedPayout.amount.toLocaleString()}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Transferred via {completedPayout.method === 'UPI' ? 'Instant UPI' : 'IMPS Direct Bank'}
              </p>
            </div>

            {/* Official Settlement Receipt */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Transaction ID:</span>
                <span className="font-mono font-bold text-slate-900">{completedPayout.payoutId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Bank UTR / Ref No:</span>
                <span className="font-mono font-bold text-indigo-600">{completedPayout.referenceId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Beneficiary Name:</span>
                <span className="font-bold text-slate-900">{completedPayout.accountHolderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Account / VPA:</span>
                <span className="font-mono text-slate-700">{completedPayout.destination}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                  COMPLETED • SETTLED
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* TRANSFER FORM */
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 text-xs pr-1">
            {/* Balance Overview Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">
                  Available for Transfer
                </span>
                <span className="text-2xl font-black text-emerald-900">
                  ₹{availableBalance.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  100% verified ticket earnings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAmount(availableBalance)}
                className="py-1.5 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition shadow-2xs"
              >
                Transfer Max
              </button>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Transfer Amount Input */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Enter Amount to Transfer (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min={1}
                  max={availableBalance}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-base focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[0.25, 0.5, 0.75, 1].map((fraction) => {
                  const fractionAmount = Math.round(availableBalance * fraction);
                  return (
                    <button
                      key={fraction}
                      type="button"
                      onClick={() => setAmount(fractionAmount)}
                      className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition"
                    >
                      {fraction * 100}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payout Destination Method Selector */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Select Transfer Destination:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferMethod('UPI')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition ${
                    transferMethod === 'UPI'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600 text-indigo-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-bold text-xs">UPI VPA</p>
                    <p className="text-[10px] text-slate-500">Instant (GPay/PhonePe)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferMethod('BANK_TRANSFER')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition ${
                    transferMethod === 'BANK_TRANSFER'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600 text-indigo-900'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-bold text-xs">Bank Account</p>
                    <p className="text-[10px] text-slate-500">IMPS Direct Transfer</p>
                  </div>
                </button>
              </div>
            </div>

            {/* UPI Form Fields */}
            {transferMethod === 'UPI' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    UPI ID / VPA *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. host@okaxis or campus@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Beneficiary / Account Holder Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Name as registered on UPI"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Bank Transfer Form Fields */}
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
                      placeholder="e.g. HDFC Bank - Hauz Khas"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security Guarantee Notice */}
            <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-2 text-[11px] text-indigo-700">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>Zero deduction payout. Real-time direct transfer settlement.</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isProcessing || availableBalance <= 0 || amount <= 0}
                onClick={handleTransfer}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition transform active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatched to Bank/UPI...</span>
                  </>
                ) : (
                  <>
                    <IndianRupee className="w-4 h-4" />
                    <span>Transfer ₹{amount.toLocaleString()} to {transferMethod}</span>
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
