import React, { useState, useEffect } from 'react';
import { PaymentService } from '../services/paymentService';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  CreditCard,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Info
} from 'lucide-react';

interface RazorpaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const RazorpaySettingsModal: React.FC<RazorpaySettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [testResult, setTestResult] = useState<{
    success: boolean;
    mode?: string;
    message?: string;
    error?: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen]);

  const loadCurrentConfig = async () => {
    setIsLoading(true);
    setTestResult(null);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const cfg = await PaymentService.getRazorpayGatewayConfig();
      setKeyId(cfg.keyId || '');
      // If server provides masked account number, show placeholder
      if (cfg.accountNumber) {
        setAccountNumber(cfg.accountNumber);
      }
    } catch (e) {
      console.warn('Could not load razorpay config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isLiveMode = keyId.trim().startsWith('rzp_live_');
  const isTestMode = keyId.trim().startsWith('rzp_test_');

  const handleTestConnection = async () => {
    if (!keyId.trim()) {
      setTestResult({
        success: false,
        error: 'Please enter a Razorpay Key ID (starting with rzp_test_ or rzp_live_).',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await PaymentService.testGatewayConnection({
        keyId: keyId.trim(),
        keySecret: keySecret.trim() || undefined,
      });

      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Connection test failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!keyId.trim()) {
      setSaveError('Razorpay Key ID cannot be empty.');
      return;
    }

    if (!keyId.trim().startsWith('rzp_test_') && !keyId.trim().startsWith('rzp_live_')) {
      setSaveError('Invalid Key ID format. Razorpay Key ID must start with "rzp_test_" or "rzp_live_".');
      return;
    }

    setIsSaving(true);

    try {
      const res = await PaymentService.updateRazorpayGatewayConfig({
        keyId: keyId.trim(),
        keySecret: keySecret.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });

      if (res.success) {
        setSaveSuccess('Saved successfully');
        if (onConfigSaved) onConfigSaved();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setSaveError(res.error || 'Failed to save Razorpay configuration.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col text-slate-900">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-20 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pr-8 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
              <Zap className="w-3 h-3 text-indigo-600" /> Payment & Payout Infrastructure
            </span>
            {isLiveMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Production
              </span>
            )}
            {isTestMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Test Sandbox
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Razorpay Gateway Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure live payment receipt for student passes and instant revenue settlement for event organizers.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="py-4 space-y-4 flex-1 overflow-y-auto pr-1">
          {saveError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* Key ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span>Razorpay Key ID</span>
                <span className="text-rose-500">*</span>
              </label>
              <a
                href="https://dashboard.razorpay.com/app/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              required
              placeholder="rzp_test_... or rzp_live_..."
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Use <code className="font-mono text-slate-600">rzp_test_...</code> for Sandbox testing or <code className="font-mono text-slate-600">rzp_live_...</code> for real UPI & card payments.
            </p>
          </div>

          {/* Key Secret Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Razorpay Key Secret</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showSecret ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                placeholder="Enter your secret key"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Required for HMAC SHA-256 signature verification and authentic order generation.
            </p>
          </div>

          {/* RazorpayX Account Number (Settlements) */}
          <div>
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>RazorpayX Account Number (Optional for Payouts)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 7878780080316316"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Used for automated RazorpayX IMPS & UPI payouts to organizers. Leave blank to use automated settlement ledger.
            </p>
          </div>

          {/* Test Connection Button & Indicator */}
          <div className="pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !keyId.trim()}
                className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    <span>Verifying with Razorpay...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Test Gateway Connection</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className={`mt-2.5 p-3 rounded-2xl text-xs flex items-start gap-2 ${
                testResult.success 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-bold">
                    {testResult.success ? 'Gateway Verified ✓' : 'Gateway Connection Error'}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {testResult.message || testResult.error}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feature Highlights Grid */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] space-y-2 text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>Industrial Payment Highlights:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li><strong>Student Pass Checkout:</strong> Razorpay Standard modal with UPI (GPay, PhonePe, Paytm, BHIM), NetBanking, Credit/Debit cards & Wallets.</li>
              <li><strong>HMAC SHA-256 Verification:</strong> Server-side cryptographic tampering protection for every payment.</li>
              <li><strong>Host Revenue Settlements:</strong> Instant direct settlement to host's registered UPI VPA or Bank Account via IMPS.</li>
              <li><strong>Automatic Fallback:</strong> If no live keys are configured yet, the app runs smoothly in Sandbox mode for testing.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Configuration...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Save & Activate Gateway</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
