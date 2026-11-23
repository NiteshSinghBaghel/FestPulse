import type { Ticket, PaymentRecord, PayoutRecord } from '../types';
import { StorageService } from './storageService';
import { FirebaseDbService } from './firebaseDbService';

const envKeyId = ((import.meta as any).env?.VITE_RAZORPAY_KEY_ID as string) || '';

// Public Razorpay Gateway metadata (Secrets stay strictly server-side)
export const RAZORPAY_CONFIG = {
  keyId: envKeyId,
  merchantName: 'Fest-Plus',
  themeColor: '#4f46e5',
  isLive: envKeyId.startsWith('rzp_live_'),
};

export interface HostPayoutRequest {
  hostId: string;
  hostName: string;
  amount: number;
  method: 'UPI' | 'BANK_TRANSFER';
  destination: string; // UPI ID or Bank Account Number
  accountHolderName: string;
  bankName?: string;
  ifscCode?: string;
  notes?: string;
}

export interface HostPayoutResponse {
  success: boolean;
  message: string;
  payout?: PayoutRecord;
  utr?: string;
  gatewayPayoutId?: string;
}

export interface OrderCreationResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  isLive: boolean;
  eventId: string;
  eventTitle: string;
  serverTimestamp: number;
}

export interface PaymentVerificationRequest {
  orderId: string;
  paymentId: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone?: string;
  college?: string;
  rollNo?: string;
  quantity?: number;
  upiVpa?: string;
  razorpaySignature?: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  message: string;
  ticket?: Ticket;
  paymentRecord?: PaymentRecord;
}

export interface RazorpayGatewayConfigStatus {
  keyId: string;
  isConfigured: boolean;
  isLive: boolean;
  hasSecret: boolean;
  hasValidPayoutAccount: boolean;
  accountNumber?: string;
  webhookConfigured: boolean;
  source?: string;
  merchantName: string;
}

export class PaymentService {
  /**
   * Razorpay Checkout SDK loader helper
   */
  static async loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existingScript) {
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          if ((window as any).Razorpay) {
            clearInterval(interval);
            resolve(true);
          } else if (checks > 30) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  /**
   * Launch Razorpay Standard Hosted Checkout with a real server-created order_id
   */
  static async openRazorpayCheckout(params: {
    amountInRupees: number;
    eventName: string;
    eventId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    quantity: number;
    orderId: string;
    keyId?: string;
    onSuccess: (paymentId: string, orderId: string, signature: string) => void;
    onDismiss?: () => void;
    onError?: (error: any) => void;
  }): Promise<void> {
    const activeKeyId = (params.keyId || RAZORPAY_CONFIG.keyId || '').trim();
    if (!activeKeyId || (!activeKeyId.startsWith('rzp_live_') && !activeKeyId.startsWith('rzp_test_'))) {
      throw new Error('Razorpay Key ID is not configured. Please add your Razorpay credentials in Gateway Settings or Secrets.');
    }

    if (!params.orderId || !params.orderId.startsWith('order_') || params.orderId.length <= 12) {
      throw new Error('A valid Razorpay server order_id is required to launch checkout.');
    }

    const isLoaded = await this.loadRazorpayScript();
    if (!isLoaded || !(window as any).Razorpay) {
      throw new Error('Razorpay Checkout SDK failed to load. Please check your internet connection and try again.');
    }

    const amountInPaise = Math.round(params.amountInRupees * 100);
    const cleanPhone = params.studentPhone ? params.studentPhone.replace(/\D/g, '').slice(-10) : '';

    const options = {
      key: activeKeyId,
      amount: amountInPaise,
      currency: 'INR',
      name: RAZORPAY_CONFIG.merchantName,
      description: `Pass for ${params.eventName}`.substring(0, 60),
      order_id: params.orderId,
      handler: function (response: any) {
        if (!response?.razorpay_payment_id || !response?.razorpay_signature) {
          if (params.onError) {
            params.onError('Incomplete payment response received from Razorpay.');
          }
          return;
        }
        params.onSuccess(
          response.razorpay_payment_id,
          response.razorpay_order_id || params.orderId,
          response.razorpay_signature
        );
      },
      prefill: {
        name: params.studentName || 'Student',
        email: params.studentEmail || undefined,
        contact: cleanPhone.length === 10 ? cleanPhone : undefined,
      },
      notes: {
        eventId: params.eventId,
        ticketQuantity: String(params.quantity),
        studentName: params.studentName,
      },
      theme: {
        color: RAZORPAY_CONFIG.themeColor,
      },
      modal: {
        ondismiss: () => {
          if (params.onDismiss) params.onDismiss();
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on('payment.failed', function (response: any) {
      const errObj = response?.error;
      const desc = errObj?.description || errObj?.reason || 'Payment could not be completed on Razorpay gateway.';
      if (params.onError) {
        params.onError(desc);
      }
    });

    try {
      rzp.open();
    } catch (err: any) {
      if (params.onError) params.onError(err);
      throw err;
    }
  }

  /**
   * Creates a real Razorpay Order via the backend server after checking inventory.
   * Throws an explicit error if the gateway is unconfigured or order creation fails.
   */
  static async createPaymentOrder(
    eventId: string,
    details?: {
      amountInRupees?: number;
      studentName?: string;
      studentEmail?: string;
      studentPhone?: string;
      quantity?: number;
    }
  ): Promise<OrderCreationResult> {
    const event = StorageService.getEventById(eventId);
    if (!event) {
      throw new Error('Event does not exist.');
    }

    if (event.status === 'cancelled') {
      throw new Error('This event has been cancelled by the organizer.');
    }

    const qty = Math.max(1, Math.floor(Number(details?.quantity) || 1));
    if (event.status === 'sold_out' || event.availableTickets < qty) {
      throw new Error(
        event.availableTickets <= 0
          ? 'Tickets for this event are currently sold out.'
          : `Only ${event.availableTickets} ticket(s) remaining for this event.`
      );
    }

    const authoritativeAmount = Number(event.price) * qty;

    if (authoritativeAmount === 0) {
      return {
        orderId: `free_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: 0,
        currency: 'INR',
        keyId: '',
        isLive: false,
        eventId: event.eventId,
        eventTitle: event.title,
        serverTimestamp: Date.now(),
      };
    }

    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(authoritativeAmount * 100),
        currency: 'INR',
        receipt: `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        eventId: event.eventId,
        eventTitle: event.title,
        studentName: details?.studentName,
        studentEmail: details?.studentEmail,
        studentPhone: details?.studentPhone,
        quantity: qty,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !(data.order_id || data.orderId)) {
      throw new Error(data?.error || 'Could not create Razorpay payment order. Please check gateway configuration.');
    }

    const orderId = data.order_id || data.orderId;
    const keyId = data.key_id || data.keyId || RAZORPAY_CONFIG.keyId;
    const isLive = typeof data.isLive === 'boolean' ? data.isLive : Boolean(keyId?.startsWith('rzp_live_'));

    if (keyId) {
      RAZORPAY_CONFIG.keyId = keyId;
      RAZORPAY_CONFIG.isLive = isLive;
    }

    return {
      orderId,
      amount: authoritativeAmount,
      currency: data.currency || 'INR',
      keyId,
      isLive,
      eventId: event.eventId,
      eventTitle: event.title,
      serverTimestamp: Date.now(),
    };
  }

  /**
   * Verifies Razorpay HMAC signature & capture state on the server BEFORE updating inventory or issuing a pass.
   */
  static async verifyPayment(req: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    const event = StorageService.getEventById(req.eventId);
    if (!event) {
      return { success: false, message: 'Event not found during verification.' };
    }

    if (event.status === 'cancelled') {
      return { success: false, message: 'This event has been cancelled.' };
    }

    const qty = req.quantity && req.quantity > 0 ? Math.floor(req.quantity) : 1;
    if (event.availableTickets < qty) {
      return { success: false, message: `Only ${event.availableTickets} ticket(s) remaining.` };
    }

    const totalAmount = Number(event.price) * qty;

    // Paid passes MUST pass server-side HMAC-SHA256 + Razorpay capture verification first
    if (totalAmount > 0) {
      if (!req.orderId || !req.paymentId || !req.razorpaySignature) {
        return {
          success: false,
          message: 'Missing Razorpay payment signature or transaction reference. Pass was not issued.',
        };
      }

      try {
        const verifyRes = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: req.orderId,
            razorpay_payment_id: req.paymentId,
            razorpay_signature: req.razorpaySignature,
            amount: totalAmount,
            eventId: event.eventId,
            userId: req.userId,
            userName: req.userName,
            userEmail: req.userEmail,
          }),
        });

        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyData.success || !verifyData.verified) {
          return {
            success: false,
            message: verifyData.error || 'Server payment verification failed. Pass was not issued.',
          };
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Unable to verify payment with server. Please contact support with your Payment ID.',
        };
      }
    }

    // Decrement event capacity only after server payment verification passes (or free pass)
    const newTicketsSold = event.ticketsSold + qty;
    const newAvailable = Math.max(0, event.availableTickets - qty);
    StorageService.updateEvent(event.eventId, {
      ticketsSold: newTicketsSold,
      availableTickets: newAvailable,
      status: newAvailable === 0 ? 'sold_out' : event.status,
    });

    const ticketId = `TKT-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const qrToken = `SEC-TK-${ticketId}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const qrHash = `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;

    const newTicket: Ticket = {
      ticketId,
      eventId: event.eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.startTime,
      eventVenue: `${event.venue}, ${event.location}`,
      eventImageUrl: event.imageUrl,
      userId: req.userId,
      userName: req.userName,
      userEmail: req.userEmail,
      phone: req.phone,
      college: req.college,
      rollNo: req.rollNo,
      quantity: qty,
      hostId: event.hostId,
      hostPhone: event.hostPhone || '',
      paymentId: req.paymentId,
      orderId: req.orderId,
      amount: totalAmount,
      currency: 'INR',
      status: 'confirmed',
      qrToken,
      qrHash,
      issuedAt: new Date().toISOString(),
      entryStatus: 'not_entered',
      exitStatus: 'not_exited',
    };

    StorageService.saveNewTicket(newTicket);

    const paymentRecord: PaymentRecord = {
      paymentId: req.paymentId,
      orderId: req.orderId,
      ticketId,
      eventId: event.eventId,
      userId: req.userId,
      amount: totalAmount,
      currency: 'INR',
      gateway: totalAmount === 0 ? 'FREE_PASS' : 'UPI_RAZORPAY',
      status: 'paid',
      upiVpa: req.upiVpa || (totalAmount === 0 ? 'FREE_EVENT' : 'razorpay@checkout'),
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };

    StorageService.saveNewPayment(paymentRecord);
    FirebaseDbService.savePayment(paymentRecord).catch((e) => console.warn('Cloud savePayment error:', e));

    return {
      success: true,
      message:
        totalAmount === 0
          ? 'Free digital pass issued successfully!'
          : 'Razorpay payment verified on server and digital pass issued successfully!',
      ticket: newTicket,
      paymentRecord,
    };
  }

  /**
   * Executes a genuine server-side RazorpayX payout to the host's UPI VPA or Bank Account.
   * Never creates fake local/demo payout confirmations if RazorpayX rejects or isn't configured.
   */
  static async processHostPayout(req: HostPayoutRequest): Promise<HostPayoutResponse> {
    if (req.amount <= 0) {
      throw new Error('Settlement amount must be greater than ₹0.');
    }

    if (req.method === 'UPI') {
      if (!req.destination.trim() || !req.destination.includes('@')) {
        throw new Error('Please enter a valid UPI VPA (e.g. name@okhdfcbank or mobile@upi).');
      }
    } else {
      if (!req.destination.trim() || req.destination.trim().length < 8) {
        throw new Error('Please enter a valid bank account number (min 8 digits).');
      }
      if (!req.ifscCode?.trim() || req.ifscCode.trim().length < 5) {
        throw new Error('Please enter a valid bank IFSC code.');
      }
    }

    const res = await fetch('/api/razorpay/create-payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: req.amount,
        method: req.method,
        destination: req.destination.trim(),
        accountHolderName: req.accountHolderName.trim(),
        bankName: req.bankName?.trim(),
        ifscCode: req.ifscCode?.trim().toUpperCase(),
        hostId: req.hostId,
        hostName: req.hostName,
        notes: req.notes,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.payout) {
      throw new Error(
        data?.error ||
          data?.message ||
          'RazorpayX payout request failed. Please verify your RazorpayX Account Number in Gateway Settings.'
      );
    }

    StorageService.savePayoutRecord(data.payout);
    await FirebaseDbService.savePayout(data.payout).catch((e) => console.warn('Cloud savePayout error:', e));

    return {
      success: true,
      message: data.message || `₹${req.amount.toLocaleString()} dispatched via RazorpayX Payout Gateway.`,
      payout: data.payout,
      utr: data.utr,
      gatewayPayoutId: data.gatewayPayoutId,
    };
  }

  /**
   * Fetch current Razorpay gateway status from backend (public fields only)
   */
  static async getRazorpayGatewayConfig(): Promise<RazorpayGatewayConfigStatus> {
    try {
      const res = await fetch('/api/razorpay/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.keyId) {
          RAZORPAY_CONFIG.keyId = cfg.keyId;
          RAZORPAY_CONFIG.isLive = Boolean(cfg.isLive);
        }
        return cfg;
      }
    } catch (e) {
      console.warn('Failed to fetch razorpay config:', e);
    }
    return {
      keyId: RAZORPAY_CONFIG.keyId,
      isConfigured: false,
      isLive: RAZORPAY_CONFIG.isLive,
      hasSecret: false,
      hasValidPayoutAccount: false,
      webhookConfigured: false,
      merchantName: RAZORPAY_CONFIG.merchantName,
    };
  }

  /**
   * Update Razorpay credentials on the server
   */
  static async updateRazorpayGatewayConfig(config: {
    keyId: string;
    keySecret?: string;
    accountNumber?: string;
    webhookSecret?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; isLive?: boolean }> {
    try {
      const res = await fetch('/api/razorpay/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        RAZORPAY_CONFIG.keyId = config.keyId;
        RAZORPAY_CONFIG.isLive = Boolean(data.isLive ?? config.keyId.startsWith('rzp_live_'));
        return data;
      }
      return { success: false, error: data.error || 'Failed to update credentials' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating credentials' };
    }
  }

  /**
   * Test live credentials connection against Razorpay API via backend
   */
  static async testGatewayConnection(credentials?: {
    keyId?: string;
    keySecret?: string;
  }): Promise<{ success: boolean; isLive?: boolean; mode?: string; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/razorpay/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials || {}),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection test failed' };
    }
  }
}
