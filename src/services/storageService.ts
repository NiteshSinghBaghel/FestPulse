import { CollegeEvent, Ticket, UserProfile, PaymentRecord, ScannerScanResult, PayoutRecord, RegisteredAccount } from '../types';
import { FirebaseDbService } from './firebaseDbService';

const STORAGE_KEYS = {
  EVENTS: 'campuspass_events_v1',
  TICKETS: 'campuspass_tickets_v1',
  USERS: 'campuspass_users_v1',
  PAYMENTS: 'campuspass_payments_v1',
  CURRENT_USER: 'campuspass_auth_user_v1',
  BOOKMARKS: 'campuspass_bookmarks_v1',
  PAYOUTS: 'campuspass_payouts_v1',
  ACCOUNTS: 'campuspass_accounts_db_v1',
};

// No dummy events: Clean slate for user and host created events
export const INITIAL_EVENTS: CollegeEvent[] = [];

export class StorageService {
  /**
   * Synchronizes data from cloud Firestore database into local cache.
   * Merges remote items so offline/local changes are preserved.
   */
  static async syncFromFirestore(): Promise<{ eventsCount: number; ticketsCount: number }> {
    try {
      // 1. Sync Events
      const remoteEvents = await FirebaseDbService.getEvents();
      if (remoteEvents.length > 0) {
        const localEvents = this.getEvents();
        const eventMap = new Map<string, CollegeEvent>();
        localEvents.forEach(e => eventMap.set(e.eventId, e));
        remoteEvents.forEach(e => eventMap.set(e.eventId, e));
        const mergedEvents = Array.from(eventMap.values());
        this.saveEvents(mergedEvents);
      } else {
        // If Firestore is empty but we have local events, seed them into Firestore
        const localEvents = this.getEvents();
        if (localEvents.length > 0) {
          localEvents.forEach(e => FirebaseDbService.saveEvent(e));
        }
      }

      // 2. Sync Tickets
      const remoteTickets = await FirebaseDbService.getTickets();
      if (remoteTickets.length > 0) {
        const localTickets = this.getTickets();
        const ticketMap = new Map<string, Ticket>();
        localTickets.forEach(t => ticketMap.set(t.ticketId, t));
        remoteTickets.forEach(t => ticketMap.set(t.ticketId, t));
        const mergedTickets = Array.from(ticketMap.values());
        this.saveTickets(mergedTickets);
      } else {
        const localTickets = this.getTickets();
        if (localTickets.length > 0) {
          localTickets.forEach(t => FirebaseDbService.saveTicket(t));
        }
      }

      // 3. Sync Accounts
      const remoteAccounts = await FirebaseDbService.getAccounts();
      if (remoteAccounts.length > 0) {
        const localAccounts = this.getRegisteredAccounts();
        const accountMap = new Map<string, RegisteredAccount>();
        localAccounts.forEach(a => accountMap.set(a.email.toLowerCase().trim(), a));
        remoteAccounts.forEach(a => accountMap.set(a.email.toLowerCase().trim(), a));
        this.saveRegisteredAccounts(Array.from(accountMap.values()));
      }

      return {
        eventsCount: this.getEvents().length,
        ticketsCount: this.getTickets().length,
      };
    } catch (err) {
      console.warn('StorageService syncFromFirestore warning:', err);
      return {
        eventsCount: this.getEvents().length,
        ticketsCount: this.getTickets().length,
      };
    }
  }

  // ================= EVENTS =================
  static getEvents(): CollegeEvent[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: CollegeEvent[] = JSON.parse(raw);
      // Clean out any legacy mock events if they exist
      const cleaned = parsed.filter(e => 
        !e.eventId.startsWith('evt-tech-fest-2026') && 
        !e.eventId.startsWith('evt-tech-summit-2025') && 
        !e.eventId.startsWith('evt-cultural-night') && 
        !e.eventId.startsWith('evt-esports-championship') && 
        !e.eventId.startsWith('evt-ai-workshop') && 
        !e.eventId.startsWith('evt-inter-college-derby')
      );
      if (cleaned.length !== parsed.length) {
        this.saveEvents(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  static saveEvents(events: CollegeEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  static getEventById(eventId: string): CollegeEvent | undefined {
    return this.getEvents().find(e => e.eventId === eventId);
  }

  static createEvent(eventData: Omit<CollegeEvent, 'eventId' | 'createdAt' | 'updatedAt' | 'ticketsSold' | 'availableTickets'>): CollegeEvent {
    const events = this.getEvents();
    const newEvent: CollegeEvent = {
      ...eventData,
      eventId: `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      ticketsSold: 0,
      availableTickets: eventData.capacity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    events.unshift(newEvent);
    this.saveEvents(events);

    // Sync to Firestore Cloud Database
    FirebaseDbService.saveEvent(newEvent).catch(e => console.warn('Cloud saveEvent error:', e));

    return newEvent;
  }

  static updateEvent(eventId: string, updates: Partial<CollegeEvent>): CollegeEvent {
    const events = this.getEvents();
    const idx = events.findIndex(e => e.eventId === eventId);
    if (idx === -1) throw new Error('Event not found');
    
    const updated = {
      ...events[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Auto sync sold out
    if (updated.availableTickets <= 0) {
      updated.status = 'sold_out';
    }
    
    events[idx] = updated;
    this.saveEvents(events);

    // Sync to Firestore Cloud Database
    FirebaseDbService.updateEvent(eventId, updates).catch(e => console.warn('Cloud updateEvent error:', e));

    return updated;
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter(e => e.eventId !== eventId);
    this.saveEvents(events);

    // Sync to Firestore Cloud Database
    FirebaseDbService.deleteEvent(eventId).catch(e => console.warn('Cloud deleteEvent error:', e));
  }

  // ================= TICKETS =================
  static getTickets(): Ticket[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) return [];
    try {
      const parsed: Ticket[] = JSON.parse(raw);
      // Clean out any legacy mock tickets
      const cleaned = parsed.filter(t => 
        !t.ticketId.startsWith('TKT-88492014') && 
        !t.ticketId.startsWith('TKT-77382910') && 
        !t.ticketId.startsWith('TKT-66291044') && 
        !t.ticketId.startsWith('TKT-55182903')
      );
      if (cleaned.length !== parsed.length) {
        this.saveTickets(cleaned);
      }
      // Ensure hostPhone is populated from events if missing
      const events = this.getEvents();
      return cleaned.map(t => {
        if (!t.hostPhone) {
          const ev = events.find(e => e.eventId === t.eventId);
          t.hostPhone = ev?.hostPhone || '+91 98112 34567';
        }
        return t;
      });
    } catch {
      return [];
    }
  }

  static updateTicketAttendee(ticketId: string, updates: Partial<Ticket>): Ticket {
    const tickets = this.getTickets();
    const idx = tickets.findIndex(t => t.ticketId === ticketId);
    if (idx === -1) throw new Error('Ticket not found');
    tickets[idx] = { ...tickets[idx], ...updates };
    this.saveTickets(tickets);

    // Sync to Firestore Cloud Database
    FirebaseDbService.updateTicket(ticketId, updates).catch(e => console.warn('Cloud updateTicket error:', e));

    return tickets[idx];
  }

  static updateEventHostHelpline(eventId: string, hostPhone: string): void {
    this.updateEvent(eventId, { hostPhone });
    const tickets = this.getTickets();
    let changed = false;
    tickets.forEach(t => {
      if (t.eventId === eventId) {
        t.hostPhone = hostPhone;
        changed = true;
      }
    });
    if (changed) this.saveTickets(tickets);
  }

  static saveTickets(tickets: Ticket[]): void {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  }

  static saveNewTicket(ticket: Ticket): void {
    const tickets = this.getTickets();
    tickets.unshift(ticket);
    this.saveTickets(tickets);

    // Sync to Firestore Cloud Database
    FirebaseDbService.saveTicket(ticket).catch(e => console.warn('Cloud saveTicket error:', e));
  }

  static getUserTickets(userId: string): Ticket[] {
    return this.getTickets().filter(t => t.userId === userId);
  }

  static getEventAttendees(eventId: string): Ticket[] {
    return this.getTickets().filter(t => t.eventId === eventId);
  }

  static getHostAttendees(hostId: string): Ticket[] {
    return this.getTickets().filter(t => t.hostId === hostId);
  }

  static getTicketById(ticketId: string): Ticket | undefined {
    return this.getTickets().find(t => t.ticketId === ticketId);
  }

  static getTicketByToken(token: string): Ticket | undefined {
    return this.getTickets().find(t => t.qrToken === token || t.ticketId === token);
  }

  // Scanner Verification: Strictly Entry-Only Gate Verification
  static verifyAndProcessScan(
    qrToken: string,
    currentHostId: string,
    _legacyMode?: 'entry' | 'exit'
  ): ScannerScanResult {
    const tickets = this.getTickets();
    const ticketIndex = tickets.findIndex(t => t.qrToken === qrToken || t.ticketId === qrToken);

    if (ticketIndex === -1) {
      return {
        success: false,
        message: 'Invalid Ticket QR. No matching ticket found in database.',
        code: 'INVALID_TOKEN'
      };
    }

    const ticket = tickets[ticketIndex];

    // Check status
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return {
        success: false,
        message: `Ticket is ${ticket.status.toUpperCase()} and cannot be used.`,
        ticket,
        code: 'TICKET_CANCELLED'
      };
    }

    // Host check - gate scanner allows valid event verification
    if (ticket.hostId !== currentHostId && currentHostId && currentHostId !== 'host-council-101' && currentHostId !== 'scanner-gate') {
      // Allow verification with event notice
    }

    const nowIso = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Strictly Entry-Only: Check if already entered
    if (ticket.entryStatus === 'entered') {
      return {
        success: false,
        message: `ALREADY USED! Checked in at ${ticket.entryTime || 'earlier today'}. Duplicate entry rejected!`,
        ticket,
        code: 'ALREADY_ENTERED'
      };
    }

    // Record entry check-in
    const updatedTicket: Ticket = {
      ...ticket,
      entryStatus: 'entered',
      entryTime: nowIso,
      exitStatus: 'not_exited'
    };
    tickets[ticketIndex] = updatedTicket;
    this.saveTickets(tickets);

    // Sync gate check-in status to Firestore Cloud Database
    FirebaseDbService.updateTicket(updatedTicket.ticketId, {
      entryStatus: 'entered',
      entryTime: nowIso,
      exitStatus: 'not_exited'
    }).catch(e => console.warn('Cloud updateTicket check-in error:', e));

    return {
      success: true,
      message: `ENTRY GRANTED! Welcome ${updatedTicket.userName}. Pass verified successfully.`,
      ticket: updatedTicket,
      code: 'VALID'
    };
  }

  static cancelTicket(ticketId: string): { success: boolean; message: string; ticket?: Ticket } {
    const tickets = this.getTickets();
    const idx = tickets.findIndex(t => t.ticketId === ticketId);
    if (idx === -1) {
      return { success: false, message: 'Ticket not found.' };
    }
    const ticket = tickets[idx];
    if (ticket.status === 'cancelled') {
      return { success: false, message: 'Ticket is already cancelled.' };
    }
    if (ticket.entryStatus === 'entered') {
      return { success: false, message: 'Cannot cancel a ticket that has already been checked in at the gate.' };
    }

    ticket.status = 'cancelled';
    this.saveTickets(tickets);

    // Sync cancelled status to Firestore
    FirebaseDbService.updateTicket(ticketId, { status: 'cancelled' }).catch(e => console.warn('Cloud cancelTicket error:', e));

    // Increase available tickets and reduce ticketsSold for the event
    const events = this.getEvents();
    const evt = events.find(e => e.eventId === ticket.eventId);
    if (evt) {
      evt.ticketsSold = Math.max(0, evt.ticketsSold - (ticket.quantity || 1));
      evt.availableTickets = Math.min(evt.capacity, evt.availableTickets + (ticket.quantity || 1));
      if (evt.status === 'sold_out' && evt.availableTickets > 0) {
        evt.status = 'published';
      }
      this.saveEvents(events);
      FirebaseDbService.updateEvent(evt.eventId, {
        ticketsSold: evt.ticketsSold,
        availableTickets: evt.availableTickets,
        status: evt.status
      }).catch(e => console.warn('Cloud updateEvent sync error:', e));
    }

    return { success: true, message: 'Ticket cancelled successfully. Pass has been revoked.', ticket };
  }

  // Bookmarks / Wishlist
  static getBookmarks(): string[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static toggleBookmark(eventId: string): string[] {
    const bookmarks = this.getBookmarks();
    const index = bookmarks.indexOf(eventId);
    let updated: string[];
    if (index > -1) {
      updated = bookmarks.filter(id => id !== eventId);
    } else {
      updated = [...bookmarks, eventId];
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updated));
    return updated;
  }

  static isBookmarked(eventId: string): boolean {
    return this.getBookmarks().includes(eventId);
  }

  static seedInitialData(_userId: string, _userName: string, _userEmail: string) {
    // Clean slate: no fake tickets
  }

  // ================= USER ACCOUNTS DATABASE =================
  static getRegisteredAccounts(): RegisteredAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveRegisteredAccounts(accounts: RegisteredAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  static findAccountByEmail(email: string): RegisteredAccount | undefined {
    const accounts = this.getRegisteredAccounts();
    return accounts.find(a => a.email.toLowerCase().trim() === email.toLowerCase().trim());
  }

  static saveAccount(account: RegisteredAccount): void {
    const accounts = this.getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.email.toLowerCase().trim() === account.email.toLowerCase().trim());
    if (idx >= 0) {
      accounts[idx] = account;
    } else {
      accounts.push(account);
    }
    this.saveRegisteredAccounts(accounts);

    // Sync to Firestore Cloud Database
    FirebaseDbService.saveAccount(account).catch(e => console.warn('Cloud saveAccount error:', e));
  }

  // ================= PAYOUTS / REVENUE TRANSFERS =================
  static getPayouts(hostId?: string): PayoutRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
    if (!raw) return [];
    try {
      const parsed: PayoutRecord[] = JSON.parse(raw);
      if (hostId) {
        return parsed.filter(p => p.hostId === hostId);
      }
      return parsed;
    } catch {
      return [];
    }
  }

  static savePayouts(payouts: PayoutRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(payouts));
  }

  static createPayout(payoutData: Omit<PayoutRecord, 'payoutId' | 'status' | 'referenceId' | 'timestamp'>): PayoutRecord {
    const payouts = this.getPayouts();
    const newPayout: PayoutRecord = {
      ...payoutData,
      payoutId: `POUT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'completed',
      referenceId: `UPI-SETTLE-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      timestamp: new Date().toISOString(),
    };

    payouts.unshift(newPayout);
    this.savePayouts(payouts);

    // Sync to Firestore Cloud Database
    FirebaseDbService.savePayout(newPayout).catch(e => console.warn('Cloud savePayout error:', e));

    return newPayout;
  }
}
