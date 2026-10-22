import { CollegeEvent, Ticket, UserProfile, PaymentRecord, ScannerScanResult, PayoutRecord, RegisteredAccount } from '../types';
import { FirebaseDbService } from './firebaseDbService';

const STORAGE_KEYS = {
  EVENTS: 'campuspass_events_v6',
  TICKETS: 'campuspass_tickets_v6',
  USERS: 'campuspass_users_v6',
  PAYMENTS: 'campuspass_payments_v6',
  CURRENT_USER: 'campuspass_auth_user_v6',
  BOOKMARKS: 'campuspass_bookmarks_v6',
  PAYOUTS: 'campuspass_payouts_v6',
  ACCOUNTS: 'campuspass_accounts_db_v6',
};

// Global Data Flush Epoch: Purges all legacy cached data across all user browsers and devices
const GLOBAL_FLUSH_EPOCH = 'campuspass_flush_clean_epoch_20261010_v6_total_flush';

if (typeof window !== 'undefined') {
  try {
    const lastFlush = localStorage.getItem('campuspass_last_flush_epoch');
    if (lastFlush !== GLOBAL_FLUSH_EPOCH) {
      // Purge all old storage keys completely
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('campuspass_') || k.startsWith('festplus_') || k.startsWith('evt_') || k.startsWith('tkt_') || k.includes('demo_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('campuspass_last_flush_epoch', GLOBAL_FLUSH_EPOCH);
    }
  } catch {
    // safe fallback
  }
}

// Clean slate: events are created by users and hosts
export const INITIAL_EVENTS: CollegeEvent[] = [];

export class StorageService {
  private static isSyncing = false;

  /**
   * Synchronizes data from Firestore into local cache.
   * Firestore is the authoritative source of truth.
   */
  static async syncFromCloud(): Promise<{ eventsCount: number; ticketsCount: number }> {
    if (this.isSyncing) {
      return { eventsCount: this.getEvents().length, ticketsCount: this.getTickets().length };
    }
    this.isSyncing = true;

    try {
      // 1. Fetch from Firestore (AUTHORITATIVE MASTER DATABASE)
      try {
        const [fbEvents, fbTickets, fbPayments, fbAccounts, fbPayouts] = await Promise.all([
          FirebaseDbService.getEvents(),
          FirebaseDbService.getTickets(),
          FirebaseDbService.getPayments(),
          FirebaseDbService.getAccounts(),
          FirebaseDbService.getPayouts(),
        ]);

        // Firestore is authoritative: mirror exactly what exists in Firestore.
        // If Firestore is empty (0 events, 0 tickets), local cache is emptied accordingly.
        this.saveEvents(fbEvents || []);
        this.saveTickets(fbTickets || []);
        this.savePayments(fbPayments || []);
        this.saveRegisteredAccounts(fbAccounts || []);
        
        // Payouts: Merge cloud and local payouts so settlements are never reset or lost
        const localPayouts = this.getPayouts();
        const payoutMap = new Map<string, PayoutRecord>();
        for (const p of localPayouts) {
          if (p && p.payoutId) payoutMap.set(p.payoutId, p);
        }
        for (const p of (fbPayouts || [])) {
          if (p && p.payoutId) payoutMap.set(p.payoutId, p);
        }
        const mergedPayouts = Array.from(payoutMap.values()).sort(
          (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
        this.savePayouts(mergedPayouts);

        // Upload any local settlements missing from Firestore to keep cloud database authoritative
        if (fbPayouts && Array.isArray(fbPayouts)) {
          const cloudIds = new Set(fbPayouts.map(p => p.payoutId));
          for (const lp of localPayouts) {
            if (!cloudIds.has(lp.payoutId)) {
              FirebaseDbService.savePayout(lp).catch(() => {});
            }
          }
        }

        return {
          eventsCount: (fbEvents || []).length,
          ticketsCount: (fbTickets || []).length,
        };
      } catch (fbErr) {
        console.warn('[Sync] Firestore sync warning:', fbErr);
      }

      // 2. Local development fallback if Firestore is not accessible
      try {
        const res = await fetch('/api/sync');
        if (res.ok) {
          const syncData = await res.json();
          if (Array.isArray(syncData.events)) this.saveEvents(syncData.events);
          if (Array.isArray(syncData.tickets)) this.saveTickets(syncData.tickets);
          if (Array.isArray(syncData.accounts)) this.saveRegisteredAccounts(syncData.accounts);
          if (Array.isArray(syncData.payouts) && syncData.payouts.length > 0) {
            const current = this.getPayouts();
            const pMap = new Map<string, PayoutRecord>();
            current.forEach(p => pMap.set(p.payoutId, p));
            syncData.payouts.forEach((p: PayoutRecord) => pMap.set(p.payoutId, p));
            this.savePayouts(Array.from(pMap.values()));
          }
        }
      } catch {
        // safe fallback
      }

      return {
        eventsCount: this.getEvents().length,
        ticketsCount: this.getTickets().length,
      };
    } catch (err) {
      console.warn('StorageService syncFromCloud error:', err);
      return {
        eventsCount: this.getEvents().length,
        ticketsCount: this.getTickets().length,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /** Backward-compatible alias for existing call sites */
  static async syncFromFirestore(): Promise<{ eventsCount: number; ticketsCount: number }> {
    return this.syncFromCloud();
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
        !e.eventId.startsWith('evt-inter-college-derby') &&
        !e.eventId.startsWith('evt-muefnnqg-duty')
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

    // 1. Persist to Cloud Server Database API
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    }).catch(e => console.warn('Cloud API saveEvent warning:', e));

    // 2. Sync to Firestore if initialized
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

    // 1. Sync to Cloud Server API
    fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(e => console.warn('Cloud API updateEvent warning:', e));

    // 2. Sync to Firestore
    FirebaseDbService.updateEvent(eventId, updates).catch(e => console.warn('Cloud updateEvent error:', e));

    return updated;
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter(e => e.eventId !== eventId);
    this.saveEvents(events);

    // 1. Delete on Cloud Server API
    fetch(`/api/events/${eventId}`, {
      method: 'DELETE',
    }).catch(e => console.warn('Cloud API deleteEvent warning:', e));

    // 2. Delete on Firestore
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
        !t.ticketId.startsWith('TKT-55182903') &&
        t.eventId !== 'evt-muefnnqg-duty'
      );
      if (cleaned.length !== parsed.length) {
        this.saveTickets(cleaned);
      }
      // Ensure hostPhone is populated from events if missing
      const events = this.getEvents();
      return cleaned.map(t => {
        if (!t.hostPhone) {
          const ev = events.find(e => e.eventId === t.eventId);
          t.hostPhone = ev?.hostPhone || '';
        }
        return t;
      });
    } catch {
      return [];
    }
  }

  /**
   * Completely clears all data (Events, Tickets, Accounts, Payouts, Sessions)
   */
  static async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.PAYOUTS);
    localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem('festplus_auth_user_v1');
    localStorage.removeItem('festplus_jwt_token');

    await FirebaseDbService.clearAll().catch(() => {});

    try {
      await fetch('/api/clear-database', { method: 'POST' });
    } catch {
      // safe fallback
    }
  }

  static updateTicketAttendee(ticketId: string, updates: Partial<Ticket>): Ticket {
    const tickets = this.getTickets();
    const idx = tickets.findIndex(t => t.ticketId === ticketId);
    if (idx === -1) throw new Error('Ticket not found');
    tickets[idx] = { ...tickets[idx], ...updates };
    this.saveTickets(tickets);

    // 1. Sync to Cloud API
    fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});

    // 2. Sync to Firestore
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

    // 1. Sync to Cloud Server API
    fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
    }).catch(e => console.warn('Cloud API saveTicket warning:', e));

    // 2. Sync to Firestore
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
    if (ticket.hostId !== currentHostId && currentHostId && currentHostId !== 'scanner-gate') {
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

    // 1. Sync to Cloud API
    fetch(`/api/tickets/${updatedTicket.ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryStatus: 'entered',
        entryTime: nowIso,
        exitStatus: 'not_exited'
      }),
    }).catch(() => {});

    // 2. Sync to Firestore
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

    // 1. Sync to Cloud API
    fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(() => {});

    // 2. Sync to Firestore
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

      fetch(`/api/events/${evt.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketsSold: evt.ticketsSold,
          availableTickets: evt.availableTickets,
          status: evt.status
        }),
      }).catch(() => {});

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
      const parsed: RegisteredAccount[] = JSON.parse(raw);
      // Keep all valid registered accounts, never delete host or student accounts
      const cleaned = parsed.filter(a => a && a.email && typeof a.email === 'string');
      if (cleaned.length !== parsed.length) {
        this.saveRegisteredAccounts(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  static saveRegisteredAccounts(accounts: RegisteredAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  static findAccountByUid(uid: string): RegisteredAccount | undefined {
    if (!uid) return undefined;
    const accounts = this.getRegisteredAccounts();
    return accounts.find(a => a.uid === uid);
  }

  static async findAccountByUidAsync(uid: string): Promise<RegisteredAccount | undefined> {
    if (!uid) return undefined;
    const local = this.findAccountByUid(uid);
    if (local) return local;

    try {
      const fbAccounts = await FirebaseDbService.getAccounts();
      const found = fbAccounts.find(a => a.uid === uid);
      if (found) {
        this.saveAccount(found);
        return found;
      }
    } catch {}

    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const accounts: RegisteredAccount[] = await res.json();
        if (Array.isArray(accounts)) {
          const found = accounts.find(a => a.uid === uid);
          if (found) {
            this.saveAccount(found);
            return found;
          }
        }
      }
    } catch {}

    return undefined;
  }

  static findAccountByIdentifier(identifier: string): RegisteredAccount | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/[\s\-()+]/g, '');
    const accounts = this.getRegisteredAccounts();
    return accounts.find(a => 
      (a.email && a.email.toLowerCase().trim() === clean) ||
      (cleanDigits.length >= 10 && a.phone && a.phone.replace(/[\s\-()+]/g, '') === cleanDigits)
    );
  }

  static findAccountByEmail(email: string): RegisteredAccount | undefined {
    return this.findAccountByIdentifier(email);
  }

  static async findAccountByIdentifierAsync(identifier: string, forceFresh = false): Promise<RegisteredAccount | undefined> {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/[\s\-()+]/g, '');

    const matcher = (a: RegisteredAccount) => {
      if (!a) return false;
      const aEmail = a.email ? a.email.toLowerCase().trim() : '';
      const aPhone = a.phone ? a.phone.replace(/[\s\-()+]/g, '') : '';
      return (clean && aEmail === clean) || (cleanDigits.length >= 10 && aPhone === cleanDigits);
    };

    // If fresh check requested (e.g. on login or post-edit), check persistent server & cloud first!
    if (forceFresh) {
      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const accounts: RegisteredAccount[] = await res.json();
          if (Array.isArray(accounts)) {
            const found = accounts.find(matcher);
            if (found) {
              this.saveAccount(found);
              return found;
            }
          }
        }
      } catch {}

      try {
        const fbAccounts = await FirebaseDbService.getAccounts();
        const found = fbAccounts.find(matcher);
        if (found) {
          this.saveAccount(found);
          return found;
        }
      } catch {}
    }

    // 1. Check local storage
    const local = this.findAccountByIdentifier(identifier);
    if (local && !forceFresh) return local;

    // 2. Check Firestore cloud database directly
    try {
      const fbAccounts = await FirebaseDbService.getAccounts();
      const found = fbAccounts.find(matcher);
      if (found) {
        this.saveAccount(found);
        return found;
      }
    } catch {}

    // 3. Check server database directly
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const accounts: RegisteredAccount[] = await res.json();
        if (Array.isArray(accounts)) {
          const found = accounts.find(matcher);
          if (found) {
            this.saveAccount(found);
            return found;
          }
        }
      }
    } catch {
      // safe fallback
    }

    // Fallback to local if server was temporarily unavailable
    if (local) return local;

    // 4. Default demo accounts
    if (clean === 'host@campusfest.org' || (cleanDigits && cleanDigits === '9876543210' && clean.includes('host'))) {
      return {
        uid: 'demo_host_uid',
        email: 'host@campusfest.org',
        name: 'Cultural Committee Head',
        role: 'host',
        college: 'IIT Delhi Event Council',
        phone: '9876543210',
        authProvider: 'email',
        createdAt: new Date().toISOString(),
      };
    }
    if (clean === 'student@college.edu' || (cleanDigits && cleanDigits === '9876543210' && !clean.includes('host'))) {
      return {
        uid: 'demo_user_uid',
        email: 'student@college.edu',
        name: 'Aarav Sharma',
        role: 'user',
        college: 'IIT Delhi (CS Dept)',
        phone: '9876543210',
        authProvider: 'email',
        createdAt: new Date().toISOString(),
      };
    }

    return undefined;
  }

  static async findAccountByEmailAsync(email: string, forceFresh = false): Promise<RegisteredAccount | undefined> {
    return this.findAccountByIdentifierAsync(email, forceFresh);
  }

  static async updateAccountPasswordAsync(
    email: string, 
    newPassword: string, 
    role?: string, 
    name?: string
  ): Promise<RegisteredAccount> {
    const cleanEmail = email.toLowerCase().trim();
    const accounts = this.getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.email && a.email.toLowerCase().trim() === cleanEmail);
    let updatedAccount: RegisteredAccount;

    if (idx >= 0) {
      accounts[idx].password = newPassword;
      accounts[idx].updatedAt = new Date().toISOString();
      if (role) accounts[idx].role = role as any;
      if (name) accounts[idx].name = name;
      updatedAccount = accounts[idx];
    } else {
      updatedAccount = {
        uid: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: newPassword,
        role: (role as any) || 'user',
        college: role === 'host' ? 'Campus Event Council' : 'College Student',
        phone: '',
        authProvider: 'email',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accounts.push(updatedAccount);
    }
    this.saveRegisteredAccounts(accounts);

    // 1. Sync to server API /api/auth/update-password and /api/accounts
    try {
      await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          newPassword,
          role: updatedAccount.role,
          name: updatedAccount.name,
          uid: updatedAccount.uid,
        }),
      });
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAccount),
      });
    } catch (e) {
      console.warn('updateAccountPasswordAsync API warning:', e);
    }

    // 2. Sync directly to Firestore
    try {
      await FirebaseDbService.updateAccountPassword(cleanEmail, newPassword);
      await FirebaseDbService.saveAccount(updatedAccount);
    } catch (e) {
      console.warn('updateAccountPasswordAsync Firestore warning:', e);
    }

    return updatedAccount;
  }

  static saveAccount(account: RegisteredAccount): void {
    const accounts = this.getRegisteredAccounts();
    const idx = accounts.findIndex(a => 
      (account.uid && a.uid === account.uid) || 
      a.email.toLowerCase().trim() === account.email.toLowerCase().trim()
    );
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...account };
    } else {
      accounts.push(account);
    }
    this.saveRegisteredAccounts(accounts);

    // 1. Sync to Cloud API
    fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    }).catch(e => console.warn('Cloud API saveAccount warning:', e));

    // 2. Sync to Firestore
    FirebaseDbService.saveAccount(account).catch(e => console.warn('Cloud saveAccount error:', e));
  }

  static async saveAccountAsync(account: RegisteredAccount): Promise<void> {
    this.saveAccount(account);
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
    } catch (e) {
      console.warn('API saveAccountAsync warning:', e);
    }
  }

  static async updateAccountDetails(
    userId: string,
    oldEmail: string,
    updates: {
      name: string;
      email: string;
      phone?: string;
      college?: string;
      photoURL?: string;
    }
  ): Promise<RegisteredAccount> {
    const cleanOldEmail = oldEmail.toLowerCase().trim();
    const cleanNewEmail = updates.email.toLowerCase().trim();
    const accounts = this.getRegisteredAccounts();
    
    let idx = accounts.findIndex(
      a => (userId && a.uid === userId) || a.email.toLowerCase().trim() === cleanOldEmail
    );

    let updatedAccount: RegisteredAccount;

    if (idx >= 0) {
      updatedAccount = {
        ...accounts[idx],
        uid: userId || accounts[idx].uid,
        name: updates.name.trim(),
        email: cleanNewEmail,
        phone: updates.phone !== undefined ? updates.phone.trim() : accounts[idx].phone,
        college: updates.college !== undefined ? updates.college.trim() : accounts[idx].college,
        photoURL: updates.photoURL || accounts[idx].photoURL,
      };
      accounts[idx] = updatedAccount;
    } else {
      updatedAccount = {
        uid: userId,
        name: updates.name.trim(),
        email: cleanNewEmail,
        phone: updates.phone?.trim() || '',
        college: updates.college?.trim() || '',
        photoURL: updates.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(updates.name.trim())}`,
        authProvider: 'email',
        role: 'user',
        createdAt: new Date().toISOString(),
      };
      accounts.push(updatedAccount);
    }

    this.saveRegisteredAccounts(accounts);

    // Update tickets locally
    try {
      const tickets = this.getTickets();
      let changed = false;
      const updatedTickets = tickets.map(t => {
        if (t.userId === userId || (t.userEmail && t.userEmail.toLowerCase().trim() === cleanOldEmail)) {
          changed = true;
          return {
            ...t,
            userName: updates.name.trim(),
            userEmail: cleanNewEmail,
            phone: updates.phone?.trim() || t.phone,
          };
        }
        return t;
      });
      if (changed) {
        this.saveTickets(updatedTickets);
      }
    } catch (e) {
      console.warn('Local tickets update warning:', e);
    }

    // Update host events locally if host name or phone changed
    try {
      const events = this.getEvents();
      let eventsChanged = false;
      const updatedEvents = events.map(evt => {
        if (evt.hostId === userId || evt.hostId === updatedAccount.uid) {
          eventsChanged = true;
          return {
            ...evt,
            hostName: updates.name.trim(),
            hostPhone: updates.phone?.trim() || evt.hostPhone,
          };
        }
        return evt;
      });
      if (eventsChanged) {
        this.saveEvents(updatedEvents);
      }
    } catch (e) {
      console.warn('Local events update warning:', e);
    }

    // Sync active session in localStorage
    try {
      const rawUser = localStorage.getItem('auth_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.uid === userId || (u.email && u.email.toLowerCase().trim() === cleanOldEmail))) {
          const syncedUser = {
            ...u,
            name: updates.name.trim(),
            email: cleanNewEmail,
            phone: updates.phone !== undefined ? updates.phone.trim() : u.phone,
            college: updates.college !== undefined ? updates.college.trim() : u.college,
            photoURL: updates.photoURL || u.photoURL,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem('auth_user', JSON.stringify(syncedUser));
        }
      }
    } catch {}

    // 1. Sync to server API (pass oldEmail so backend can update Postgres/memory)
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedAccount, oldEmail: cleanOldEmail }),
      });
    } catch (e) {
      console.warn('API saveAccount warning:', e);
    }

    // 2. Sync to Firestore (accounts, users, and tickets)
    try {
      await FirebaseDbService.saveAccount(updatedAccount);
      await FirebaseDbService.saveUserProfile({
        uid: updatedAccount.uid,
        name: updatedAccount.name,
        email: updatedAccount.email,
        phone: updatedAccount.phone,
        college: updatedAccount.college,
        photoURL: updatedAccount.photoURL,
        role: updatedAccount.role,
        authProvider: updatedAccount.authProvider,
        createdAt: updatedAccount.createdAt,
        updatedAt: new Date().toISOString(),
      });
      await FirebaseDbService.updateUserTickets(
        updatedAccount.uid,
        updatedAccount.name,
        updatedAccount.email,
        updatedAccount.phone
      );
    } catch (e) {
      console.warn('Firestore updateAccountDetails warning:', e);
    }

    return updatedAccount;
  }

  // ================= PAYOUTS / REVENUE TRANSFERS =================
  static getPayouts(hostId?: string): PayoutRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
    if (!raw) return [];
    try {
      const parsed: PayoutRecord[] = JSON.parse(raw);
      // Clean out legacy mock dummy payout of 1500
      const cleaned = parsed.filter(p => p.payoutId !== 'pout_rzp_mv5dyagx_TTD1' && p.payoutId !== 'pout_rzp_mv8cukhu_V3LA');
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(cleaned));
      }
      if (hostId) {
        // Return payouts for this host, including any demo host or unassigned payouts so history is never lost
        return cleaned.filter(p => !p.hostId || p.hostId === hostId || p.hostId === 'demo_host_uid' || hostId === 'demo_host_uid');
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  static savePayouts(payouts: PayoutRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(payouts));
    try {
      window.dispatchEvent(new Event('campuspass_data_updated'));
    } catch {}
  }

  static savePayoutRecord(payout: PayoutRecord): void {
    const payouts = this.getPayouts();
    const existingIdx = payouts.findIndex(p => p.payoutId === payout.payoutId);
    if (existingIdx > -1) {
      payouts[existingIdx] = payout;
    } else {
      payouts.unshift(payout);
    }
    this.savePayouts(payouts);

    // Sync to Firestore Cloud database immediately
    FirebaseDbService.savePayout(payout).catch(e => console.warn('Cloud savePayout error:', e));

    fetch('/api/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payout),
    }).catch(() => {});
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

    // 1. Sync to Cloud API
    fetch('/api/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayout),
    }).catch(e => console.warn('Cloud API savePayout warning:', e));

    // 2. Sync to Firestore Cloud Database
    FirebaseDbService.savePayout(newPayout).catch(e => console.warn('Cloud savePayout error:', e));

    return newPayout;
  }

  // ================= PAYMENTS RECOVERY & STORE =================
  static getPayments(): PaymentRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static savePayments(payments: PaymentRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }

  static saveNewPayment(payment: PaymentRecord): void {
    const payments = this.getPayments();
    payments.unshift(payment);
    this.savePayments(payments);

    // Sync to Firestore
    FirebaseDbService.savePayment(payment).catch(() => {});
  }

  static reconstructPaymentsFromTickets(): PaymentRecord[] {
    const tickets = this.getTickets();
    const payments: PaymentRecord[] = [];
    const events = this.getEvents();
    const eventMap = new Map<string, CollegeEvent>();
    events.forEach(e => eventMap.set(e.eventId, e));

    tickets.forEach(ticket => {
      const evt = eventMap.get(ticket.eventId);
      const isPaid = (ticket.amount || 0) > 0;
      payments.push({
        paymentId: `PAY-${ticket.ticketId}`,
        orderId: `ORDER-${ticket.ticketId}`,
        ticketId: ticket.ticketId,
        eventId: ticket.eventId,
        userId: ticket.userId,
        amount: ticket.amount ?? evt?.price ?? 0,
        currency: 'INR',
        gateway: isPaid ? 'UPI_RAZORPAY' : 'FREE_PASS',
        status: ticket.status === 'cancelled' ? 'refunded' : 'paid',
        upiVpa: 'verified@upi',
        createdAt: ticket.issuedAt || new Date().toISOString(),
        verifiedAt: ticket.issuedAt || new Date().toISOString(),
      });
    });

    return payments;
  }
}
