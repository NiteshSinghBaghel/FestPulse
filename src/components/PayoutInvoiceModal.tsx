import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { PayoutRecord } from '../types';
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle2, 
  Copy, 
  Check, 
  X, 
  Building2, 
  Smartphone, 
  ShieldCheck, 
  Sparkles,
  Receipt,
  IndianRupee,
  Share2
} from 'lucide-react';

interface PayoutInvoiceModalProps {
  payout: PayoutRecord | null;
  isOpen: boolean;
  onClose: () => void;
  hostCollege?: string;
}

function numberToWordsINR(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (!amount || amount <= 0) return 'Zero Rupees Only';
  
  function convertLessThanOneThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }
  
  let num = Math.floor(amount);
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;
  
  let result = '';
  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanOneThousand(remainder) + ' ';
  
  return (result.trim() || 'Zero') + ' Rupees Only';
}

export async function downloadPayoutInvoice(payout: PayoutRecord, hostCollege: string = 'Inter-College Student Council'): Promise<void> {
  const invoiceNumber = `INV-POUT-${payout.payoutId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}`;
  const formattedDate = new Date(payout.timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = new Date(payout.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let qrDataUrl = '';
  try {
    const qrPayload = JSON.stringify({
      invoiceType: 'PAYOUT_SETTLEMENT',
      payoutId: payout.payoutId,
      utr: payout.referenceId,
      amount: payout.amount,
      beneficiary: payout.accountHolderName,
      destination: payout.destination,
      date: payout.timestamp,
      status: 'VERIFIED_SETTLED'
    });
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (e) {
    console.error('Failed to generate QR for download', e);
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payout Settlement Invoice - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; line-height: 1.5; font-size: 13px; }
    .invoice-card { max-width: 780px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #4f46e5; color: #fff; font-weight: 900; font-size: 16px; padding: 6px 14px; border-radius: 8px; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; }
    .status-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .info-box { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; }
    .info-title { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
    .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    .text-right { text-align: right; }
    .total-row td { font-weight: 900; font-size: 14px; background: #f8fafc; color: #0f172a; border-top: 2px solid #e2e8f0; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #f1f5f9; padding-top: 20px; font-size: 11px; color: #64748b; margin-top: 24px; }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="logo-badge">⚡ FEST+ CAMPUSPASS</div>
        <h1 class="title">Host Revenue Settlement Invoice</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Official Tax & Remittance Advice • Instant Clearing</p>
        <span class="status-badge">✓ SETTLED & REMITTED</span>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #64748b;">INVOICE NO:</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #4f46e5;">${invoiceNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">DATE & TIME:</div>
        <div style="font-weight: 700;">${formattedDate} • ${formattedTime}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-box">
        <div class="info-title">PAYER / SETTLEMENT PLATFORM</div>
        <div class="info-value">Fest+ CampusPass Settlement Gateway Ltd.</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">GSTIN: 29AABCF9876Q1Z2 • CIN: U72900KA2024PTC184920</div>
        <div style="font-size: 11px; color: #64748b;">NPCI / Razorpay Direct Settlement Partner</div>
      </div>

      <div class="info-box">
        <div class="info-title">BENEFICIARY / HOST DETAILS</div>
        <div class="info-value">${payout.accountHolderName}</div>
        <div style="font-size: 12px; font-weight: 600; color: #334155;">Host: ${payout.hostName || 'College Event Organizer'}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Institution: ${hostCollege}</div>
      </div>
    </div>

    <div class="info-box" style="margin-bottom: 24px;">
      <div class="info-title">BANKING & TRANSACTION RECONCILIATION</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 6px;">
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">SETTLEMENT DESTINATION:</span>
          <span style="font-weight: 800; font-family: monospace; color: #0f172a;">${payout.destination}</span>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">BANK UTR / IMPS REF:</span>
          <span style="font-weight: 800; font-family: monospace; color: #4f46e5;">${payout.referenceId}</span>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">SETTLEMENT METHOD:</span>
          <span style="font-weight: 800; color: #059669;">${payout.method === 'UPI' ? 'UPI Instant Transfer (VPA)' : 'Bank IMPS Direct Clearing'}</span>
        </div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Sl.</th>
          <th>Item Description & Line Item Particulars</th>
          <th>SAC Code</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <strong>Host Event Ticket Sales Settlement</strong><br>
            <span style="color: #64748b; font-size: 11px;">Verified digital pass collections cleared for host withdrawal</span>
          </td>
          <td>998313</td>
          <td class="text-right">100%</td>
          <td class="text-right" style="font-weight: 700;">₹${payout.amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td>2</td>
          <td>
            Platform Commission (Fest-Plus College Offer)<br>
            <span style="color: #10b981; font-size: 11px;">100% Promotional Waiver Applied</span>
          </td>
          <td>998314</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #059669; font-weight: 700;">₹0.00</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Payment Gateway Convenience Charges (Zero Deduction)</td>
          <td>997159</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #059669; font-weight: 700;">₹0.00</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Integrated GST / CGST @ 18% on Processing Charges</td>
          <td>GST</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #64748b;">₹0.00</td>
        </tr>
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTAL NET AMOUNT REMITTED TO ACCOUNT:</td>
          <td class="text-right" style="color: #047857; font-size: 16px;">₹${payout.amount.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
      <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">AMOUNT IN WORDS:</span>
      <div style="font-size: 13px; font-weight: 800; color: #1e293b;">${numberToWordsINR(payout.amount)}</div>
    </div>

    <div class="footer">
      <div>
        <strong>Verification Hash:</strong> ${payout.payoutId}<br>
        This is a digitally signed computer-generated settlement advice. No physical signature is required.
      </div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="80" height="80" style="border-radius: 8px;" alt="QR Code" />` : ''}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice_${invoiceNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const PayoutInvoiceModal: React.FC<PayoutInvoiceModalProps> = ({
  payout,
  isOpen,
  onClose,
  hostCollege = 'Inter-College Student Council'
}) => {
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (payout && isOpen) {
      const qrPayload = JSON.stringify({
        invoiceType: 'PAYOUT_SETTLEMENT',
        payoutId: payout.payoutId,
        utr: payout.referenceId,
        amount: payout.amount,
        beneficiary: payout.accountHolderName,
        destination: payout.destination,
        date: payout.timestamp,
        status: 'VERIFIED_SETTLED'
      });

      QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
    }
  }, [payout, isOpen]);

  if (!isOpen || !payout) return null;

  const invoiceNumber = `INV-POUT-${payout.payoutId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}`;
  const formattedDate = new Date(payout.timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = new Date(payout.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleCopyUtr = () => {
    navigator.clipboard.writeText(payout.referenceId);
    setCopiedUtr(true);
    setTimeout(() => setCopiedUtr(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate downloadable standalone formatted HTML tax invoice file
  const handleDownloadInvoiceFile = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payout Settlement Invoice - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; line-height: 1.5; font-size: 13px; }
    .invoice-card { max-width: 780px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #4f46e5; color: #fff; font-weight: 900; font-size: 16px; padding: 6px 14px; border-radius: 8px; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; }
    .status-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .info-box { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; }
    .info-title { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
    .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    .text-right { text-align: right; }
    .total-row td { font-weight: 900; font-size: 14px; background: #f8fafc; color: #0f172a; border-top: 2px solid #e2e8f0; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #f1f5f9; padding-top: 20px; font-size: 11px; color: #64748b; margin-top: 24px; }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="logo-badge">⚡ FEST+ CAMPUSPASS</div>
        <h1 class="title">Host Revenue Settlement Invoice</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Official Tax & Remittance Advice • Instant Clearing</p>
        <span class="status-badge">✓ SETTLED & REMITTED</span>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #64748b;">INVOICE NO:</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #4f46e5;">${invoiceNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">DATE & TIME:</div>
        <div style="font-weight: 700;">${formattedDate} • ${formattedTime}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-box">
        <div class="info-title">PAYER / SETTLEMENT PLATFORM</div>
        <div class="info-value">Fest+ CampusPass Settlement Gateway Ltd.</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">GSTIN: 29AABCF9876Q1Z2 • CIN: U72900KA2024PTC184920</div>
        <div style="font-size: 11px; color: #64748b;">NPCI / Razorpay Direct Settlement Partner</div>
      </div>

      <div class="info-box">
        <div class="info-title">BENEFICIARY / HOST DETAILS</div>
        <div class="info-value">${payout.accountHolderName}</div>
        <div style="font-size: 12px; font-weight: 600; color: #334155;">Host: ${payout.hostName || 'College Event Organizer'}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Institution: ${hostCollege}</div>
      </div>
    </div>

    <div class="info-box" style="margin-bottom: 24px;">
      <div class="info-title">BANKING & TRANSACTION RECONCILIATION</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 6px;">
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">SETTLEMENT DESTINATION:</span>
          <span style="font-weight: 800; font-family: monospace; color: #0f172a;">${payout.destination}</span>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">BANK UTR / IMPS REF:</span>
          <span style="font-weight: 800; font-family: monospace; color: #4f46e5;">${payout.referenceId}</span>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b; display: block;">SETTLEMENT METHOD:</span>
          <span style="font-weight: 800; color: #059669;">${payout.method === 'UPI' ? 'UPI Instant Transfer (VPA)' : 'Bank IMPS Direct Clearing'}</span>
        </div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Sl.</th>
          <th>Item Description & Line Item Particulars</th>
          <th>SAC Code</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <strong>Host Event Ticket Sales Settlement</strong><br>
            <span style="color: #64748b; font-size: 11px;">Verified digital pass collections cleared for host withdrawal</span>
          </td>
          <td>998313</td>
          <td class="text-right">100%</td>
          <td class="text-right" style="font-weight: 700;">₹${payout.amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td>2</td>
          <td>
            Platform Commission (Fest-Plus College Offer)<br>
            <span style="color: #10b981; font-size: 11px;">100% Promotional Waiver Applied</span>
          </td>
          <td>998314</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #059669; font-weight: 700;">₹0.00</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Payment Gateway Convenience Charges (Zero Deduction)</td>
          <td>997159</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #059669; font-weight: 700;">₹0.00</td>
        </tr>
        <tr>
          <td>4</td>
          <td>Integrated GST / CGST @ 18% on Processing Charges</td>
          <td>GST</td>
          <td class="text-right">0.0%</td>
          <td class="text-right" style="color: #64748b;">₹0.00</td>
        </tr>
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTAL NET AMOUNT REMITTED TO ACCOUNT:</td>
          <td class="text-right" style="color: #047857; font-size: 16px;">₹${payout.amount.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
      <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">AMOUNT IN WORDS:</span>
      <div style="font-size: 13px; font-weight: 800; color: #1e293b;">${numberToWordsINR(payout.amount)}</div>
    </div>

    <div class="footer">
      <div>
        <strong>Verification Hash:</strong> ${payout.payoutId}<br>
        This is a digitally signed computer-generated settlement advice. No physical signature is required.
      </div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="80" height="80" style="border-radius: 8px;" alt="QR Code" />` : ''}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col text-slate-900 cursor-default"
      >
        {/* Modal Top Actions Header (No Print) */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Payout Settlement Invoice</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                  ✓ Verified
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">Official tax remittance receipt for host records</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Print Invoice / Save as PDF"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={handleDownloadInvoiceFile}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Download standalone HTML invoice"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Document Container */}
        <div 
          id="printable-payout-invoice"
          className="p-5 sm:p-8 overflow-y-auto space-y-6 text-xs bg-white"
        >
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Fest+ CampusPass Settlement
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Settlement & Remittance Invoice
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Official Settlement Voucher • Direct Host Revenue Payout
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 100% Settled to Destination
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                  FY 2026-27
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Invoice Number</span>
              <span className="text-sm font-black font-mono text-indigo-700">{invoiceNumber}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mt-2 tracking-wider">Settlement Date</span>
              <span className="text-xs font-bold text-slate-800">{formattedDate}</span>
              <span className="text-[11px] text-slate-500 block">{formattedTime}</span>
            </div>
          </div>

          {/* Parties Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Origin Entity */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">
                Dispatched By / Settlement Platform
              </span>
              <p className="font-bold text-slate-900 text-sm">Fest-Plus Inter-College Settlement Ltd.</p>
              <p className="text-[11px] text-slate-500 font-mono">GSTIN: 29AABCF9876Q1Z2</p>
              <p className="text-[11px] text-slate-500">Razorpay Payouts & NPCI IMPS Clearing Channel</p>
              <p className="text-[11px] text-slate-500">Bangalore / New Delhi, India</p>
            </div>

            {/* Recipient / Host Beneficiary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">
                Beneficiary / Event Host
              </span>
              <p className="font-bold text-slate-900 text-sm">{payout.accountHolderName}</p>
              <p className="text-[11px] font-semibold text-indigo-700">{payout.hostName || 'College Event Organizer'}</p>
              <p className="text-[11px] text-slate-600">{hostCollege}</p>
              <p className="text-[10px] text-slate-400 font-mono">Host ID: {payout.hostId.slice(0, 14)}...</p>
            </div>
          </div>

          {/* Settlement Gateway & Banking Particulars Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-emerald-50/40 border border-slate-200 space-y-2">
            <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block">
              Banking & Transaction Particulars
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Bank UTR / Reference No</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-black text-xs text-indigo-700">{payout.referenceId}</span>
                  <button
                    onClick={handleCopyUtr}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                    title="Copy UTR"
                  >
                    {copiedUtr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Payout Method</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-800">
                  {payout.method === 'UPI' ? (
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{payout.method === 'UPI' ? 'UPI VPA Instant' : 'Direct Bank IMPS'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Credited Destination</span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block break-all text-[11px]">
                  {payout.destination}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="p-3">Item & Particulars</th>
                  <th className="p-3 text-center">SAC</th>
                  <th className="p-3 text-center">Rate</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                <tr>
                  <td className="p-3">
                    <p className="font-bold text-slate-900">Event Ticket Sales Settlement</p>
                    <p className="text-[10px] text-slate-500">
                      Disbursed earnings from verified campus festival ticket bookings
                    </p>
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-slate-600">998313</td>
                  <td className="p-3 text-center font-semibold text-slate-700">100%</td>
                  <td className="p-3 text-right font-black text-slate-900 text-sm">
                    ₹{payout.amount.toLocaleString()}
                  </td>
                </tr>

                <tr className="text-slate-600">
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">Platform Convenience & Commission</p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      100% Promotional Zero-Commission Waiver Applied
                    </p>
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-slate-500">998314</td>
                  <td className="p-3 text-center text-slate-500">0.0%</td>
                  <td className="p-3 text-right font-bold text-emerald-600">₹0.00</td>
                </tr>

                <tr className="text-slate-600">
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">Payment Gateway Clearing Charges</p>
                    <p className="text-[10px] text-slate-500">Direct settlement via Razorpay Settlement Network</p>
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-slate-500">997159</td>
                  <td className="p-3 text-center text-slate-500">0.0%</td>
                  <td className="p-3 text-right font-bold text-emerald-600">₹0.00</td>
                </tr>

                <tr className="text-slate-600">
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">Taxes (CGST 9% + SGST 9%)</p>
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-slate-500">GST</td>
                  <td className="p-3 text-center text-slate-500">0.0%</td>
                  <td className="p-3 text-right text-slate-500">₹0.00</td>
                </tr>

                {/* Grand Total */}
                <tr className="bg-emerald-50/60 font-black text-slate-900 text-sm border-t-2 border-emerald-200">
                  <td colSpan={3} className="p-3.5 text-right font-bold uppercase tracking-wider text-xs text-slate-700">
                    Net Amount Remitted to Account:
                  </td>
                  <td className="p-3.5 text-right text-emerald-700 text-base font-black">
                    ₹{payout.amount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount In Words */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Amount in Words
              </span>
              <p className="font-black text-slate-900 text-xs mt-0.5">
                {numberToWordsINR(payout.amount)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Full Settlement Dispatched</span>
            </div>
          </div>

          {/* Bottom Verification & Stamp Seal */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-[11px] space-y-1">
              <div className="flex items-center gap-1 text-slate-700 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Digitally Authenticated Remittance Voucher</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400">
                Audit Hash: {payout.payoutId} • Gateway Ref: {payout.gatewayRef || payout.referenceId}
              </p>
              <p className="text-[10px] text-slate-400">
                This is a system-generated invoice voucher. No physical signature is required.
              </p>
            </div>

            {/* QR Code Seal */}
            {qrDataUrl && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200 shrink-0">
                <img 
                  src={qrDataUrl} 
                  alt="QR Verification" 
                  className="w-16 h-16 rounded-lg border border-slate-200 bg-white" 
                />
                <div className="text-[9px] text-slate-500 leading-tight">
                  <span className="font-bold text-slate-800 block">Scan to Verify</span>
                  <span>Instant NPCI /</span><br/>
                  <span>Bank Clearing Record</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Action Bar (No Print) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 no-print">
          <div className="text-[11px] text-slate-500 font-medium">
            <span>Need billing help? Contact </span>
            <span className="text-indigo-600 font-bold">settlements@festplus.campus</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadInvoiceFile}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Download Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
