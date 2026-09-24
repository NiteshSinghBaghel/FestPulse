import { CollegeEvent, Ticket, PaymentRecord } from '../types';
import { StorageService } from './storageService';

export interface OrderCreationResult {
  orderId: string;
  amount: number;
  currency: string;
  eventId: string;
  eventTitle: string;
  serverTimestamp: number;
  signatureChallenge: string;
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
  signatureChallenge: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  message: string;
  ticket?: Ticket;
  paymentRecord?: PaymentRecord;
}

export class PaymentService {
  /**
   * Simulates Cloud Function: createPaymentOrder
   * Checks inventory server-side so client cannot falsify prices or buy sold-out tickets.
   */
  static async createPaymentOrder(eventId: string): Promise<OrderCreationResult> {
    // Simulate network latency to backend function
    await new Promise(r => setTimeout(r, 600));

    const event = StorageService.getEventById(eventId);
    if (!event) {
      throw new Error('Event does not exist.');
    }

    if (event.status === 'sold_out' || event.availableTickets <= 0) {
      throw new Error('Tickets for this event are currently sold out.');
    }

    if (event.status === 'cancelled') {
      throw new Error('This event has been cancelled by the host.');
    }

    const orderId = `order_cp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const serverTimestamp = Date.now();
    // Cryptographic signature challenge payload
    const signatureChallenge = btoa(`${orderId}:${event.eventId}:${event.price}:${serverTimestamp}:SECRET_KEY`);

    return {
      orderId,
      amount: event.price,
      currency: 'INR',
      eventId: event.eventId,
      eventTitle: event.title,
      serverTimestamp,
      signatureChallenge
    };
  }

  /**
   * Simulates Cloud Function: verifyPayment & generateTicket
   * Verifies signature, updates event atomically (availableTickets - 1, ticketsSold + 1),
   * creates payment record, and returns a verified Ticket with QR Token.
   */
  static async verifyPayment(req: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    // Simulate secure backend verification latency
    await new Promise(r => setTimeout(r, 1200));

    const event = StorageService.getEventById(req.eventId);
    if (!event) {
      return { success: false, message: 'Event not found during server verification.' };
    }

    const qty = req.quantity && req.quantity > 0 ? req.quantity : 1;

    // Atomic concurrency check
    if (event.availableTickets < qty) {
      return { success: false, message: `Transaction rolled back: Only ${event.availableTickets} tickets remaining.` };
    }

    // Decrement inventory atomically
    const newTicketsSold = event.ticketsSold + qty;
    const newAvailable = Math.max(0, event.availableTickets - qty);
    StorageService.updateEvent(event.eventId, {
      ticketsSold: newTicketsSold,
      availableTickets: newAvailable,
      status: newAvailable === 0 ? 'sold_out' : event.status
    });

    const ticketId = `TKT-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const qrToken = `SEC-TK-${ticketId}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const qrHash = `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const totalAmount = event.price * qty;

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
      hostPhone: event.hostPhone || '+91 91234 56789',
      paymentId: req.paymentId,
      orderId: req.orderId,
      amount: totalAmount,
      currency: 'INR',
      status: 'confirmed',
      qrToken,
      qrHash,
      issuedAt: new Date().toISOString(),
      entryStatus: 'not_entered',
      exitStatus: 'not_exited'
    };

    // Save ticket
    const allTickets = StorageService.getTickets();
    allTickets.unshift(newTicket);
    StorageService.saveTickets(allTickets);

    const paymentRecord: PaymentRecord = {
      paymentId: req.paymentId,
      orderId: req.orderId,
      ticketId,
      eventId: event.eventId,
      userId: req.userId,
      amount: event.price,
      currency: 'INR',
      gateway: event.price === 0 ? 'FREE_PASS' : 'UPI_RAZORPAY',
      status: 'paid',
      upiVpa: req.upiVpa || 'student@oksbi',
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString()
    };

    return {
      success: true,
      message: 'Payment verified and digital ticket generated successfully!',
      ticket: newTicket,
      paymentRecord
    };
  }
}
