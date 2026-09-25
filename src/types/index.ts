export type UserRole = 'user' | 'host';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  phone?: string;
  college?: string;
  authProvider?: 'email' | 'google';
  token?: string; // Signed HMAC-SHA256 JWT bearer token
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredAccount {
  uid: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string; // Cryptographic SHA-256 salted hash
  salt?: string; // Cryptographic salt
  role: UserRole;
  phone?: string;
  college?: string;
  photoURL?: string;
  authProvider: 'email' | 'google';
  createdAt: string;
}

export type EventStatus = 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed';

export interface CollegeEvent {
  eventId: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM"
  endTime: string; // e.g. "04:00 PM"
  location: string; // e.g. "Main Campus, Building A"
  venue: string; // e.g. "Auditorium Hall"
  price: number; // 0 for free, in INR
  currency: string; // "INR"
  capacity: number;
  ticketsSold: number;
  availableTickets: number;
  status: EventStatus;
  category: 'Tech' | 'Cultural' | 'Sports' | 'Hackathon' | 'Workshop' | 'Music' | 'Gaming';
  rules?: string[];
  amenities?: string[];
  hostPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded';
export type EntryStatus = 'not_entered' | 'entered';
export type ExitStatus = 'not_exited' | 'exited';

export interface Ticket {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventImageUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone?: string;
  college?: string;
  rollNo?: string;
  quantity?: number;
  hostId: string;
  hostPhone?: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: TicketStatus;
  qrToken: string;
  qrHash: string;
  issuedAt: string;
  entryStatus: EntryStatus;
  entryTime?: string;
  exitStatus: ExitStatus;
  exitTime?: string;
}

export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  ticketId?: string;
  eventId: string;
  userId: string;
  amount: number;
  currency: string;
  gateway: 'UPI_RAZORPAY' | 'UPI_INTENT' | 'FREE_PASS';
  status: PaymentStatus;
  upiVpa?: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface ScannerScanResult {
  success: boolean;
  message: string;
  ticket?: Ticket;
  code: 'VALID' | 'ALREADY_ENTERED' | 'NOT_ENTERED_YET' | 'ALREADY_EXITED' | 'INVALID_TOKEN' | 'WRONG_HOST_OR_EVENT' | 'TICKET_CANCELLED';
}

export interface PayoutRecord {
  payoutId: string;
  hostId: string;
  hostName: string;
  amount: number;
  currency: string;
  method: 'UPI' | 'BANK_TRANSFER';
  destination: string; // UPI ID (e.g. host@okaxis) or Bank Acct (e.g. 9876543210 - HDFC0001234)
  accountHolderName: string;
  bankName?: string;
  ifscCode?: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  referenceId: string; // Bank UTR or IMPS reference
  gatewayRef?: string; // Razorpay Payout ID (pout_...)
  gateway?: 'RAZORPAY_PAYOUT' | 'IMPS_DIRECT' | 'UPI_INSTANT';
  timestamp: string;
  notes?: string;
}
