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

const ACTIVE_UID_KEY = 'campuspass_active_uid_v1';
const REALTIME_CHANNEL_NAME = 'campuspass_realtime_v1';

export interface SyncSession {
  uid?: string;
  email?: string;
  role?: 'user' | 'host';
}

function readStoredAuthSession(): SyncSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('festplus_auth_user_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.email) {
      return {
        uid: String(parsed.uid),
        email: String(parsed.email).toLowerCase().trim(),
        role: parsed.role === 'host' ? 'host' : 'user',
      };
    }
  } catch {}
  return null;
}

function broadcastTabUpdate(type: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('campuspass_data_updated'));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(REALTIME_CHANNEL_NAME);
      ch.postMessage({ type, timestamp: Date.now() });
      ch.close();
    }
  } catch {}
}

export class StorageService {
  private static isSyncing = false;
  private static recentMutationIds = new Map<string, number>();

  private static markMutation(id: string) {
    if (!id) return;
    this.recentMutationIds.set(id, Date.now());
  }

  private static isRecentMutation(id: string): boolean {
    const ts = this.recentMutationIds.get(id);
    if (!ts) return false;
    if (Date.now() - ts > 6000) {
      this.recentMutationIds.delete(id);
      return false;
    }
    return true;
  }

  /**
   * Clears user-scoped caches (tickets, payouts, payments, bookmarks) on logout or user switch
   * so the next logged-in account never sees leftover data from a previous user.
   */
  static clearUserScopedCache(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.TICKETS);
      localStorage.removeItem(STORAGE_KEYS.PAYOUTS);
      localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
      localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
      localStorage.removeItem(ACTIVE_UID_KEY);
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('campuspass_data_updated'));
    } catch {}
  }

  /**
   * Ensures cached tickets/payouts/payments belong to the currently active uid.
   */
  static ensureActiveUserScope(uid?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
      const cleanUid = (uid || '').trim();
      if (!cleanUid) {
        this.clearUserScopedCache();
        return;
      }
      const prevUid = localStorage.getItem(ACTIVE_UID_KEY);
      if (prevUid && prevUid !== cleanUid) {
        localStorage.removeItem(STORAGE_KEYS.TICKETS);
        localStorage.removeItem(STORAGE_KEYS.PAYOUTS);
        localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
      }
      localStorage.setItem(ACTIVE_UID_KEY, cleanUid);
    } catch {}
  }

  /**
   * Synchronizes data from Cloud API & Firestore into local cache strictly scoped to the active session.
   */
  static async syncFromCloud(explicitSession?: SyncSession | null): Promise<{ eventsCount: number; ticketsCount: number }> {
    if (this.isSyncing) {
      return { eventsCount: this.getEvents().length, ticketsCount: this.getTickets().length };
    }
    this.isSyncing = true;

    const session = explicitSession !== undefined ? explicitSession : readStoredAuthSession();
    if (session?.uid) {
      this.ensureActiveUserScope(session.uid);
    } else {
      this.clearUserScopedCache();
    }

    try {
      const activeUid = session?.uid?.trim() || '';
      const activeEmail = session?.email?.toLowerCase().trim() || '';
      const activeRole = session?.role === 'host' ? 'host' : 'user';
      const hasSession = Boolean(activeUid || activeEmail);

      // 1. Fetch from Firestore if user is authenticated in Firebase Auth
      let fbEvents: CollegeEvent[] = [];
      let fbTickets: Ticket[] = [];
      let fbPayouts: PayoutRecord[] = [];
      if (hasSession && FirebaseDbService.getActiveFirebaseUid() === activeUid) {
        try {
          const firestorePromise = Promise.all([
            FirebaseDbService.getEvents(activeUid),
            FirebaseDbService.getTickets(activeUid, activeRole),
            activeRole === 'host' ? FirebaseDbService.getPayouts(activeUid) : Promise.resolve([] as PayoutRecord[]),
          ]);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore sync timeout')), 2500)
          );
          [fbEvents, fbTickets, fbPayouts] = await Promise.race([firestorePromise, timeoutPromise]);
        } catch (fbErr) {
          console.warn('[Sync] Firestore sync warning:', fbErr);
        }
      }

      // 2. Sync scoped state from server database (/api/sync?userId=...&userEmail=...&role=...)
      let serverSyncOk = false;
      let srvEvents: CollegeEvent[] = [];
      let srvTickets: Ticket[] = [];
      let srvPayouts: PayoutRecord[] = [];
      let srvAccounts: RegisteredAccount[] = [];

      try {
        const params = new URLSearchParams();
        if (activeUid) params.set('userId', activeUid);
        if (activeEmail) params.set('userEmail', activeEmail);
        if (hasSession) params.set('role', activeRole);
        const queryStr = params.toString();
        const res = await fetch(queryStr ? `/api/sync?${queryStr}` : '/api/sync');
        if (res.ok) {
          serverSyncOk = true;
          const syncData = await res.json();
          if (Array.isArray(syncData.events)) srvEvents = syncData.events;
          if (Array.isArray(syncData.tickets)) srvTickets = syncData.tickets;
          if (Array.isArray(syncData.payouts)) srvPayouts = syncData.payouts;
          if (Array.isArray(syncData.accounts)) srvAccounts = syncData.accounts;
        }
      } catch {}

      // Merge events cleanly: authoritative server/firestore + preserve un-flushed recent local edits + preserve host gatePins from local if stripped
      const currentEvents = this.getEvents();
      const eventMap = new Map<string, CollegeEvent>();
      if (!serverSyncOk) {
        currentEvents.forEach(e => { if (e?.eventId) eventMap.set(e.eventId, e); });
      } else {
        currentEvents.forEach(e => {
          if (e?.eventId && this.isRecentMutation(e.eventId)) {
            eventMap.set(e.eventId, e);
          }
        });
      }
      srvEvents.forEach(e => { if (e?.eventId) eventMap.set(e.eventId, e); });
      fbEvents.forEach(e => {
        if (e?.eventId) {
          const prev = eventMap.get(e.eventId);
          const fbPin = e.gatePin && /^\d{6}$/.test(String(e.gatePin).trim()) ? String(e.gatePin).trim() : '';
          const prevPin = prev?.gatePin && /^\d{6}$/.test(String(prev.gatePin).trim()) ? String(prev.gatePin).trim() : '';
          const resolvedPin =
            prevPin && (!fbPin || fbPin === '100000')
              ? prevPin
              : fbPin || prevPin || undefined;
          eventMap.set(
            e.eventId,
            prev
              ? {
                  ...prev,
                  ...e,
                  ...(resolvedPin ? { gatePin: resolvedPin } : {}),
                }
              : e
          );
        }
      });

      // Ensure host events from Firestore or local cache are also registered on the backend API server (so unauthenticated volunteer PIN lookups succeed)
      if (serverSyncOk && hasSession && activeRole === 'host') {
        const srvById = new Map(srvEvents.map(se => [se.eventId, se]));
        Array.from(eventMap.values()).forEach((evt) => {
          const isOwned = Boolean(
            (activeUid && evt.hostId === activeUid) ||
            (activeEmail && evt.hostEmail && evt.hostEmail.toLowerCase().trim() === activeEmail)
          );
          if (!isOwned) return;
          const srvEvt = srvById.get(evt.eventId);
          if (!srvEvt || (evt.gatePin && srvEvt.gatePin !== evt.gatePin)) {
            fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(evt),
            }).catch(() => {});
          }
        });
      }

      this.saveEvents(Array.from(eventMap.values()), false);

      // Strictly scope tickets to the logged-in user/host (zero cross-user leakage)
      if (!hasSession) {
        this.saveTickets([], false);
        this.savePayouts([], false);
      } else {
        const currentTickets = this.getTickets();
        const ticketMap = new Map<string, Ticket>();
        if (!serverSyncOk) {
          currentTickets.forEach(t => { if (t?.ticketId) ticketMap.set(t.ticketId, t); });
        } else {
          currentTickets.forEach(t => {
            if (t?.ticketId && this.isRecentMutation(t.ticketId)) {
              ticketMap.set(t.ticketId, t);
            }
          });
        }
        srvTickets.forEach(t => { if (t?.ticketId) ticketMap.set(t.ticketId, t); });
        fbTickets.forEach(t => { if (t?.ticketId) ticketMap.set(t.ticketId, t); });
        const sortedTickets = Array.from(ticketMap.values()).sort(
          (a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime()
        );
        this.saveTickets(sortedTickets, false);

        // Ensure events in local cache reconcile with confirmed tickets so count never reverts
        const confirmedTicketCounts = new Map<string, number>();
        sortedTickets.forEach(t => {
          if (t?.eventId && t.status === 'confirmed') {
            const qty = Math.max(1, Number(t.quantity) || 1);
            confirmedTicketCounts.set(t.eventId, (confirmedTicketCounts.get(t.eventId) || 0) + qty);
          }
        });
        let eventsNeedReSave = false;
        eventMap.forEach((evt) => {
          const confirmedQty = confirmedTicketCounts.get(evt.eventId) || 0;
          if (confirmedQty > (evt.ticketsSold || 0)) {
            evt.ticketsSold = confirmedQty;
            evt.availableTickets = Math.max(0, (evt.capacity || 0) - confirmedQty);
            if (evt.capacity && confirmedQty >= evt.capacity) {
              evt.status = 'sold_out';
            }
            eventsNeedReSave = true;
          }
        });
        if (eventsNeedReSave) {
          this.saveEvents(Array.from(eventMap.values()), false);
        }

        if (activeRole === 'host') {
          const currentPayouts = this.getPayouts(activeUid);
          const payoutMap = new Map<string, PayoutRecord>();
          if (!serverSyncOk) {
            currentPayouts.forEach(p => { if (p?.payoutId) payoutMap.set(p.payoutId, p); });
          } else {
            currentPayouts.forEach(p => {
              if (p?.payoutId && this.isRecentMutation(p.payoutId)) {
                payoutMap.set(p.payoutId, p);
              }
            });
          }
          srvPayouts.forEach(p => { if (p?.payoutId) payoutMap.set(p.payoutId, p); });
          fbPayouts.forEach(p => { if (p?.payoutId) payoutMap.set(p.payoutId, p); });
          const sortedPayouts = Array.from(payoutMap.values()).sort(
            (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          this.savePayouts(sortedPayouts, false);
        } else {
          this.savePayouts([], false);
        }
      }

      // Merge sanitized account profile metadata without wiping existing password hashes
      if (srvAccounts.length > 0) {
        const localAccs = this.getRegisteredAccounts();
        const accMap = new Map<string, RegisteredAccount>();
        localAccs.forEach(a => {
          if (a?.email) accMap.set(a.uid || a.email.toLowerCase().trim(), a);
        });
        srvAccounts.forEach(a => {
          if (a?.email) {
            const key = a.uid || a.email.toLowerCase().trim();
            const existing = accMap.get(key);
            accMap.set(key, { ...existing, ...a, password: existing?.password });
          }
        });
        this.saveRegisteredAccounts(Array.from(accMap.values()));
      }

      window.dispatchEvent(new Event('campuspass_data_updated'));

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

  /**
   * Starts true multi-tab (BroadcastChannel), cross-browser/server (SSE EventSource),
   * and Firestore (onSnapshot) real-time synchronization for the active session.
   */
  static startRealtimeSync(
    session: SyncSession | null,
    onDataChanged: () => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    let disposed = false;
    let channel: BroadcastChannel | null = null;
    let eventSource: EventSource | null = null;
    let unsubEvents: (() => void) | null = null;
    let unsubTickets: (() => void) | null = null;
    let unsubPayouts: (() => void) | null = null;

    let syncPending = false;
    // Unique ID for this tab so BroadcastChannel can ignore its own posts
    const thisTabId = `tab_${Date.now()}_${Math.random()}`;

    const triggerSync = () => {
      if (disposed) return;
      if (this.isSyncing) {
        syncPending = true;
        return;
      }
      this.syncFromCloud(session).then(() => {
        if (!disposed) {
          onDataChanged();
          if (syncPending) {
            syncPending = false;
            triggerSync();
          }
        }
      });
    };

    // 1. Cross-tab instant synchronization via BroadcastChannel
    // Ignore messages that originated from THIS tab to prevent self-loop
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(REALTIME_CHANNEL_NAME);
        channel.onmessage = (evt) => {
          if (!disposed && evt.data?.fromTabId !== thisTabId) {
            triggerSync();
          }
        };
      }
    } catch {}

    // 2. Live Server-Sent Events stream from backend API
    try {
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/realtime/stream');
        eventSource.onmessage = (evt) => {
          if (disposed) return;
          try {
            const msg = JSON.parse(evt.data || '{}');
            if (!msg.type || msg.type === 'connected') return;

            // If the SSE message carries inline data, apply directly — no /api/sync round-trip
            if (msg.data) {
              let changed = false;

              // Handle deleted events
              if (msg.data.deletedEventId) {
                const current = this.getEvents();
                this.saveEvents(current.filter(e => e.eventId !== msg.data.deletedEventId), false);
                changed = true;
              }

              // Handle deleted tickets
              if (msg.data.deletedTicketId) {
                const current = this.getTickets();
                this.saveTickets(current.filter(t => t.ticketId !== msg.data.deletedTicketId), false);
                changed = true;
              }

              // Handle updated/new events list (server wins, merge over local)
              if (Array.isArray(msg.data.events)) {
                const local = this.getEvents();
                const map = new Map<string, CollegeEvent>();
                local.forEach(e => { if (e?.eventId) map.set(e.eventId, e); });
                (msg.data.events as CollegeEvent[]).forEach(e => { if (e?.eventId) map.set(e.eventId, e); });
                this.saveEvents(Array.from(map.values()), false);
                changed = true;
              }

              // Handle updated/new tickets (merge, server wins)
              if (Array.isArray(msg.data.tickets)) {
                const local = this.getTickets();
                const map = new Map<string, Ticket>();
                local.forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
                (msg.data.tickets as Ticket[]).forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
                const allTickets = Array.from(map.values());
                this.saveTickets(allTickets, false);
                changed = true;

                // Immediately reconcile event ticketsSold locally
                const localEvents = this.getEvents();
                let evtsChanged = false;
                localEvents.forEach(evt => {
                  const confirmedQty = allTickets
                    .filter(t => t.eventId === evt.eventId && t.status === 'confirmed')
                    .reduce((sum, t) => sum + Math.max(1, Number(t.quantity) || 1), 0);
                  if (confirmedQty > (evt.ticketsSold || 0)) {
                    evt.ticketsSold = confirmedQty;
                    evt.availableTickets = Math.max(0, (evt.capacity || 0) - confirmedQty);
                    evtsChanged = true;
                  }
                });
                if (evtsChanged) {
                  this.saveEvents(localEvents, false);
                }
              }

              if (changed) {
                // onDataChanged() triggers refreshData() in App.tsx — that's the single UI update
                // Do NOT call window.dispatchEvent here too (would cause double render/flicker)
                onDataChanged();
                // Notify OTHER tabs via BroadcastChannel so they also sync
                // Tagged with thisTabId so THIS tab's channel.onmessage ignores it (no self-loop)
                try {
                  if (typeof BroadcastChannel !== 'undefined') {
                    const ch = new BroadcastChannel(REALTIME_CHANNEL_NAME);
                    ch.postMessage({ type: msg.type, fromTabId: thisTabId, timestamp: Date.now() });
                    ch.close();
                  }
                } catch {}
                return; // *** Do NOT call triggerSync — prevents flicker from second HTTP round-trip ***
              }
            }

            // No inline data — fall back to full sync
            triggerSync();
          } catch {}
        };
      }
    } catch {}

    // 3. Real-time Firestore onSnapshot listeners when signed in via Firebase Auth
    const fbUid = FirebaseDbService.getActiveFirebaseUid();
    if (session?.uid && fbUid && fbUid === session.uid) {
      unsubEvents = FirebaseDbService.subscribeEvents(session.uid, (liveEvents) => {
        if (disposed) return;
        const current = this.getEvents();
        const map = new Map<string, CollegeEvent>();
        current.forEach(e => { if (e?.eventId) map.set(e.eventId, e); });
        liveEvents.forEach(e => { if (e?.eventId) map.set(e.eventId, e); });
        this.saveEvents(Array.from(map.values()), false);
        window.dispatchEvent(new Event('campuspass_data_updated'));
        onDataChanged();
      });

      if (session.role === 'host') {
        unsubTickets = FirebaseDbService.subscribeHostTickets(session.uid, (liveTickets) => {
          if (disposed) return;
          const current = this.getTickets();
          const map = new Map<string, Ticket>();
          current.forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
          liveTickets.forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
          this.saveTickets(Array.from(map.values()), false);
          window.dispatchEvent(new Event('campuspass_data_updated'));
          onDataChanged();
        });
        unsubPayouts = FirebaseDbService.subscribeHostPayouts(session.uid, (livePayouts) => {
          if (disposed) return;
          this.savePayouts(livePayouts, false);
          window.dispatchEvent(new Event('campuspass_data_updated'));
          onDataChanged();
        });
      } else {
        unsubTickets = FirebaseDbService.subscribeUserTickets(session.uid, (liveTickets) => {
          if (disposed) return;
          const current = this.getTickets();
          const map = new Map<string, Ticket>();
          current.forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
          liveTickets.forEach(t => { if (t?.ticketId) map.set(t.ticketId, t); });
          this.saveTickets(Array.from(map.values()), false);
          window.dispatchEvent(new Event('campuspass_data_updated'));
          onDataChanged();
        });
      }
    }

    return () => {
      disposed = true;
      try { channel?.close(); } catch {}
      try { eventSource?.close(); } catch {}
      try { unsubEvents?.(); } catch {}
      try { unsubTickets?.(); } catch {}
      try { unsubPayouts?.(); } catch {}
    };
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
      const parsed: Partial<CollegeEvent>[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((event): event is Partial<CollegeEvent> =>
          Boolean(event && typeof event === 'object' && event.eventId)
        )
        .map((event) => {
          const capacity = Number.isFinite(Number(event.capacity)) ? Number(event.capacity) : 0;
          const ticketsSold = Number.isFinite(Number(event.ticketsSold)) ? Number(event.ticketsSold) : 0;
          const availableTickets = Number.isFinite(Number(event.availableTickets))
            ? Number(event.availableTickets)
            : Math.max(0, capacity - ticketsSold);

          return {
            ...event,
            eventId: String(event.eventId),
            hostId: String(event.hostId || ''),
            hostName: String(event.hostName || 'Campus Host'),
            title: String(event.title || 'Untitled Event'),
            description: String(event.description || ''),
            imageUrl: String(event.imageUrl || ''),
            date: String(event.date || ''),
            startTime: String(event.startTime || ''),
            endTime: String(event.endTime || ''),
            location: String(event.location || ''),
            venue: String(event.venue || ''),
            price: Number.isFinite(Number(event.price)) ? Number(event.price) : 0,
            currency: String(event.currency || 'INR'),
            capacity,
            ticketsSold,
            availableTickets,
            status: event.status || 'published',
            category: event.category || 'Tech',
            createdAt: String(event.createdAt || ''),
            updatedAt: String(event.updatedAt || ''),
          } as CollegeEvent;
        })
        .filter(e =>
          !e.eventId.startsWith('evt-tech-fest-2026') &&
          !e.eventId.startsWith('evt-tech-summit-2025') &&
          !e.eventId.startsWith('evt-cultural-night') &&
          !e.eventId.startsWith('evt-esports-championship') &&
          !e.eventId.startsWith('evt-ai-workshop') &&
          !e.eventId.startsWith('evt-inter-college-derby') &&
          !e.eventId.startsWith('evt-muefnnqg-duty')
        );
    } catch {
      return [];
    }
  }

  static saveEvents(events: CollegeEvent[], broadcast = true): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    if (broadcast) {
      broadcastTabUpdate('events');
    }
  }

  static getEventById(eventId: string): CollegeEvent | undefined {
    return this.getEvents().find(e => e.eventId === eventId);
  }

  /**
   * Strictly filters and returns events owned by the specified organizer ID or email.
   */
  static getHostEvents(organizerId: string, organizerEmail?: string): CollegeEvent[] {
    if (!organizerId && !organizerEmail) return [];
    const cleanId = organizerId ? organizerId.trim() : '';
    const cleanEmail = organizerEmail ? organizerEmail.toLowerCase().trim() : '';
    const hostTickets = this.getHostTickets(cleanId, cleanEmail);
    const confirmedCountMap = new Map<string, number>();
    hostTickets.forEach(t => {
      if (t?.eventId && t.status === 'confirmed') {
        const qty = Math.max(1, Number(t.quantity) || 1);
        confirmedCountMap.set(t.eventId, (confirmedCountMap.get(t.eventId) || 0) + qty);
      }
    });

    return this.getEvents()
      .filter(e => {
        if (cleanId && e.hostId === cleanId) return true;
        if (cleanEmail && e.hostEmail && e.hostEmail.toLowerCase().trim() === cleanEmail) return true;
        return false;
      })
      .map(e => {
        const confirmedQty = confirmedCountMap.get(e.eventId) || 0;
        const effectiveSold = Math.max(Number(e.ticketsSold) || 0, confirmedQty);
        const cap = Number(e.capacity) || 0;
        return {
          ...e,
          ticketsSold: effectiveSold,
          availableTickets: Math.max(0, cap - effectiveSold),
          status: cap > 0 && effectiveSold >= cap ? ('sold_out' as const) : e.status,
        };
      });
  }

  static createEvent(eventData: Omit<CollegeEvent, 'eventId' | 'createdAt' | 'updatedAt' | 'ticketsSold' | 'availableTickets'>): CollegeEvent {
    const events = this.getEvents();
    // Generate secure 6-digit numeric gate PIN for volunteer scanner
    const randomGatePin = Math.floor(100000 + Math.random() * 900000).toString();
    const newEvent: CollegeEvent = {
      ...eventData,
      eventId: `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      gatePin: eventData.gatePin || randomGatePin,
      ticketsSold: 0,
      availableTickets: eventData.capacity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    events.unshift(newEvent);
    this.markMutation(newEvent.eventId);
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

  static updateEvent(
    eventId: string,
    updates: Partial<CollegeEvent>,
    requestingHostId?: string,
    requestingHostEmail?: string
  ): CollegeEvent {
    const events = this.getEvents();
    const idx = events.findIndex(e => e.eventId === eventId);
    if (idx === -1) throw new Error('Event not found');

    const currentEvt = events[idx];
    if (requestingHostId || requestingHostEmail) {
      const isOwner =
        (requestingHostId && currentEvt.hostId === requestingHostId) ||
        (requestingHostEmail && currentEvt.hostEmail && currentEvt.hostEmail.toLowerCase().trim() === requestingHostEmail.toLowerCase().trim());
      if (!isOwner) {
        throw new Error('Unauthorized: You cannot edit an event created by another organizer.');
      }
    }

    const updated = {
      ...currentEvt,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Auto sync sold out
    if (updated.availableTickets <= 0) {
      updated.status = 'sold_out';
    }

    events[idx] = updated;
    this.markMutation(eventId);
    this.saveEvents(events);

    // 1. Sync to Cloud Server API
    fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, requestingHostId, requestingHostEmail }),
    }).catch(e => console.warn('Cloud API updateEvent warning:', e));

    // 2. Sync to Firestore
    FirebaseDbService.updateEvent(eventId, updates).catch(e => console.warn('Cloud updateEvent error:', e));

    return updated;
  }

  static async syncEventToServerAsync(evt: CollegeEvent): Promise<CollegeEvent> {
    if (!evt?.eventId) return evt;
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evt),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.event) {
          return { ...evt, ...data.event };
        }
      }
    } catch {}
    return evt;
  }

  /**
   * Ensures an event has a valid 6-digit volunteer Gate PIN, generating & persisting one if missing.
   */
  static async ensureEventGatePin(
    eventId: string,
    requestingHostId?: string,
    requestingHostEmail?: string
  ): Promise<CollegeEvent | null> {
    const existing = this.getEventById(eventId);
    if (existing && /^\d{6}$/.test(String(existing.gatePin || '').trim())) {
      return existing;
    }
    return this.regenerateGatePinAsync(eventId, requestingHostId, requestingHostEmail);
  }

  /**
   * Generates a fresh unique 6-digit Gate PIN for an event and persists it across API, local cache, and Firestore.
   */
  static async regenerateGatePinAsync(
    eventId: string,
    requestingHostId?: string,
    requestingHostEmail?: string
  ): Promise<CollegeEvent | null> {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/regenerate-gate-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestingHostId, requestingHostEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.event) {
          const events = this.getEvents();
          const idx = events.findIndex((e) => e.eventId === eventId);
          if (idx >= 0) {
            events[idx] = { ...events[idx], ...data.event };
          } else {
            events.unshift(data.event);
          }
          this.markMutation(eventId);
          this.saveEvents(events);
          FirebaseDbService.updateEvent(eventId, { gatePin: data.event.gatePin }).catch(() => {});
          return idx >= 0 ? events[idx] : data.event;
        }
      }
    } catch {}

    // Fallback to local update if server record was not yet synced
    const current = this.getEventById(eventId);
    if (!current) return null;
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    return this.updateEvent(eventId, { gatePin: newPin }, requestingHostId, requestingHostEmail);
  }

  static deleteEvent(
    eventId: string,
    requestingHostId?: string,
    requestingHostEmail?: string
  ): void {
    const events = this.getEvents();
    const evt = events.find(e => e.eventId === eventId);
    if (evt && (requestingHostId || requestingHostEmail)) {
      const isOwner =
        (requestingHostId && evt.hostId === requestingHostId) ||
        (requestingHostEmail && evt.hostEmail && evt.hostEmail.toLowerCase().trim() === requestingHostEmail.toLowerCase().trim());
      if (!isOwner) {
        throw new Error('Unauthorized: You cannot delete an event created by another organizer.');
      }
    }

    const filtered = events.filter(e => e.eventId !== eventId);
    this.saveEvents(filtered);

    // 1. Delete on Cloud Server API
    fetch(`/api/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestingHostId, requestingHostEmail }),
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

  static saveTickets(tickets: Ticket[], broadcast = true): void {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    if (broadcast) {
      broadcastTabUpdate('tickets');
    }
  }

  static saveNewTicket(ticket: Ticket): void {
    const tickets = this.getTickets();
    tickets.unshift(ticket);
    this.markMutation(ticket.ticketId);
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

  static getUserTickets(userId: string, userEmail?: string): Ticket[] {
    if (!userId && !userEmail) return [];
    const cleanEmail = userEmail?.toLowerCase().trim();
    return this.getTickets().filter(t => {
      if (userId && t.userId === userId) return true;
      if (cleanEmail && t.userEmail && t.userEmail.toLowerCase().trim() === cleanEmail) return true;
      return false;
    });
  }

  static getEventAttendees(eventId: string): Ticket[] {
    return this.getTickets().filter(t => t.eventId === eventId);
  }

  static getHostAttendees(hostId: string, hostEmail?: string): Ticket[] {
    const cleanId = hostId ? hostId.trim() : '';
    const cleanEmail = hostEmail ? hostEmail.toLowerCase().trim() : '';
    if (!cleanId && !cleanEmail) return [];
    const events = this.getEvents();
    const hostEventIds = new Set(
      events
        .filter(e => (cleanId && e.hostId === cleanId) || (cleanEmail && e.hostEmail && e.hostEmail.toLowerCase().trim() === cleanEmail))
        .map(e => e.eventId)
    );
    return this.getTickets().filter(t => {
      if (cleanId && t.hostId === cleanId) return true;
      if (hostEventIds.has(t.eventId)) return true;
      return false;
    });
  }

  /**
   * Strictly filters and returns tickets belonging to events owned by the specified organizer ID or email.
   * Zero data from other organizers is allowed.
   */
  static getHostTickets(organizerId: string, organizerEmail?: string): Ticket[] {
    if (!organizerId && !organizerEmail) return [];
    const cleanId = organizerId ? organizerId.trim() : '';
    const cleanEmail = organizerEmail ? organizerEmail.toLowerCase().trim() : '';
    if (!cleanId && !cleanEmail) return [];
    const hostEvents = this.getHostEvents(cleanId, cleanEmail);
    const hostEventIds = new Set(hostEvents.map(e => e.eventId));
    return this.getTickets().filter(t => {
      if (hostEventIds.has(t.eventId)) return true;
      if (cleanId && t.hostId === cleanId) return true;
      return false;
    });
  }

  /**
   * Calculates financial metrics and gross revenue strictly for the specified organizer ID or email.
   */
  static getHostRevenue(organizerId: string, organizerEmail?: string): {
    totalEvents: number;
    totalTicketsSold: number;
    ticketsRevenue: number;
    eventsRevenue: number;
    totalRevenue: number;
    totalCheckedIn: number;
    totalTransferred: number;
    availableBalance: number;
  } {
    if (!organizerId && !organizerEmail) {
      return {
        totalEvents: 0,
        totalTicketsSold: 0,
        ticketsRevenue: 0,
        eventsRevenue: 0,
        totalRevenue: 0,
        totalCheckedIn: 0,
        totalTransferred: 0,
        availableBalance: 0,
      };
    }
    const cleanId = organizerId ? organizerId.trim() : '';
    const cleanEmail = organizerEmail ? organizerEmail.toLowerCase().trim() : '';
    const hostEvents = this.getHostEvents(cleanId, cleanEmail);
    const hostTickets = this.getHostTickets(cleanId, cleanEmail);
    const hostPayouts = this.getPayouts(cleanId, cleanEmail);

    const totalEvents = hostEvents.length;
    const confirmedTicketsSum = hostTickets
      .filter(t => t.status === 'confirmed')
      .reduce((acc, t) => acc + Math.max(1, Number(t.quantity) || 1), 0);
    const eventsSoldSum = hostEvents.reduce((acc, e) => acc + (Number(e.ticketsSold) || 0), 0);
    const totalTicketsSold = Math.max(confirmedTicketsSum, eventsSoldSum);

    const ticketsRevenue = hostTickets
      .filter(t => t.status === 'confirmed')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const eventsRevenue = hostEvents.reduce(
      (acc, e) => acc + ((e.ticketsSold || 0) * (e.price || 0)),
      0
    );

    const totalRevenue = Math.max(ticketsRevenue, eventsRevenue);
    const totalCheckedIn = hostTickets.filter(t => t.entryStatus === 'entered').length;

    const totalTransferred = hostPayouts
      .filter(p => p.status !== 'failed')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    const availableBalance = Math.max(0, totalRevenue - totalTransferred);

    return {
      totalEvents,
      totalTicketsSold,
      ticketsRevenue,
      eventsRevenue,
      totalRevenue,
      totalCheckedIn,
      totalTransferred,
      availableBalance,
    };
  }

  static getTicketById(ticketId: string): Ticket | undefined {
    return this.getTickets().find(t => t.ticketId === ticketId);
  }

  static getTicketByToken(token: string): Ticket | undefined {
    return this.getTickets().find(t => t.qrToken === token || t.ticketId === token);
  }

  static extractGatePin(rawInput: string): string {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) return '';
    const urlMatch = trimmed.match(/[?&](?:gatePin|volunteerGatePin)=(\d{6})\b/i);
    if (urlMatch?.[1]) return urlMatch[1];
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 6) return digits;
    return trimmed;
  }

  /**
   * Validates a 6-digit volunteer gate passcode and returns the associated event.
   * Protects organizer privacy: Gives zero access to organizer revenue, payouts, bank details, or editing.
   */
  static validateVolunteerGatePin(gatePin: string): CollegeEvent | null {
    const cleanPin = this.extractGatePin(gatePin);
    if (!/^\d{6}$/.test(cleanPin)) return null;
    const events = this.getEvents();
    const event = events.find(e => String(e?.gatePin || '').trim() === cleanPin);
    if (!event || event.status === 'cancelled') return null;
    return event;
  }

  static async validateVolunteerGatePinAsync(gatePin: string): Promise<CollegeEvent | null> {
    const cleanPin = this.extractGatePin(gatePin);
    if (!/^\d{6}$/.test(cleanPin)) return null;

    // 1. Check authoritative backend server endpoint first
    try {
      const res = await fetch(`/api/volunteer/validate-pin?pin=${encodeURIComponent(cleanPin)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.valid && data?.event) {
          return data.event as CollegeEvent;
        }
      }
    } catch {}

    // 2. Fallback: Check local browser cache (e.g., offline or newly created event pending server sync)
    const localMatch = this.validateVolunteerGatePin(cleanPin);
    if (localMatch) {
      void this.syncEventToServerAsync(localMatch);
      return localMatch;
    }

    // 3. Fallback: Query Firestore directly if user is signed in
    try {
      const fbMatch = await FirebaseDbService.findEventByGatePin(cleanPin);
      if (fbMatch) {
        void this.syncEventToServerAsync(fbMatch);
        return fbMatch;
      }
    } catch {}

    return null;
  }

  static async fetchVolunteerEventEntriesAsync(eventId: string, gatePin: string): Promise<Ticket[]> {
    const cleanPin = this.extractGatePin(gatePin);
    if (!eventId || !/^\d{6}$/.test(cleanPin)) return [];
    let serverRows: Ticket[] = [];
    try {
      const res = await fetch(`/api/volunteer/tickets?eventId=${encodeURIComponent(eventId)}&pin=${encodeURIComponent(cleanPin)}`);
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) serverRows = rows as Ticket[];
      }
    } catch {}

    const localRows = this.getTickets().filter(
      t => t.eventId === eventId && t.entryStatus === 'entered'
    );
    const merged = new Map<string, Ticket>();
    localRows.forEach(t => merged.set(t.ticketId, t));
    serverRows.forEach(t => merged.set(t.ticketId, t));

    return Array.from(merged.values()).sort((a, b) => {
      const tb = b.entryTimestamp ? new Date(b.entryTimestamp).getTime() : 0;
      const ta = a.entryTimestamp ? new Date(a.entryTimestamp).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.entryTime || '').localeCompare(a.entryTime || '');
    });
  }

  private static normalizeScanToken(rawToken: string): string {
    let clean = (rawToken || '').trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        clean = String(parsed.qrToken || parsed.ticketId || clean).trim();
      } catch {}
    }
    return clean;
  }

  static async verifyVolunteerScanAsync(
    qrToken: string,
    gatePin: string,
    targetEventId: string
  ): Promise<ScannerScanResult> {
    const cleanToken = this.normalizeScanToken(qrToken);
    const cleanPin = this.extractGatePin(gatePin);
    if (!cleanToken) {
      return { success: false, message: 'QR Token or Ticket ID is required.', code: 'INVALID_TOKEN' };
    }
    try {
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: cleanToken,
          volunteerGatePin: cleanPin,
          eventId: targetEventId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data.success === 'boolean') {
        if (data.success && data.ticket) {
          // Keep local cache & Firestore synchronized immediately
          const localTickets = this.getTickets();
          const idx = localTickets.findIndex(t => t.ticketId === data.ticket.ticketId);
          if (idx >= 0) {
            localTickets[idx] = { ...localTickets[idx], ...data.ticket };
            this.saveTickets(localTickets);
          }
          FirebaseDbService.updateTicket(data.ticket.ticketId, {
            entryStatus: 'entered',
            entryTime: data.ticket.entryTime,
            entryTimestamp: data.ticket.entryTimestamp,
            verifiedBy: 'volunteer',
            volunteerPin: cleanPin,
          }).catch(() => {});
          broadcastTabUpdate('tickets');
          return {
            success: true,
            message: data.message || 'Verification completed.',
            ticket: data.ticket,
            code: data.code,
          };
        }

        // Only return authoritative rejection immediately if server found the ticket or denied PIN/event;
        // if server returned INVALID_TOKEN (404), fall back to local/Firestore ticket cache before rejecting.
        if (data.code && data.code !== 'INVALID_TOKEN') {
          return {
            success: false,
            message: data.message || data.error || 'Verification rejected.',
            ticket: data.ticket,
            code: data.code,
          };
        }
      }
    } catch {}

    const localResult = this.verifyVolunteerScan(cleanToken, cleanPin, targetEventId);
    if (localResult.success && localResult.ticket) {
      // Ensure server ledger also receives locally verified ticket
      fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localResult.ticket),
      }).catch(() => {});
    }
    return localResult;
  }

  static async authenticateCredentialAsync(
    identifier: string,
    password: string,
    role?: 'user' | 'host'
  ): Promise<{ success: boolean; notFound?: boolean; error?: string; account?: RegisteredAccount }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, role }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.account) {
        return { success: true, account: data.account as RegisteredAccount };
      }
      if (res.status === 404 || data?.code === 'NOT_FOUND') {
        return { success: false, notFound: true, error: data?.error };
      }
      if (data && data.error) {
        return { success: false, error: data.error };
      }
    } catch {}
    return { success: false, notFound: true };
  }

  /**
   * Dedicated Volunteer Gate Verification:
   * Gate volunteers can only scan and admit attendees for this specific event.
   * Volunteers have ZERO access to revenue, payouts, bank details, or event management.
   */
  static verifyVolunteerScan(
    qrToken: string,
    gatePin: string,
    targetEventId: string
  ): ScannerScanResult {
    const cleanToken = this.normalizeScanToken(qrToken);
    const cleanPin = this.extractGatePin(gatePin);
    const event = this.getEventById(targetEventId);

    if (!event || String(event.gatePin || '').trim() !== cleanPin) {
      return {
        success: false,
        message: 'Invalid Gate PIN session. Scanner expired or unauthorized.',
        code: 'WRONG_HOST_OR_EVENT'
      };
    }

    const tickets = this.getTickets();
    const cleanTokenUpper = cleanToken.toUpperCase();
    const ticketIndex = tickets.findIndex(
      t =>
        String(t.qrToken || '').trim() === cleanToken ||
        String(t.ticketId || '').trim().toUpperCase() === cleanTokenUpper
    );

    if (ticketIndex === -1) {
      return {
        success: false,
        message: 'Invalid Ticket QR. No matching ticket found in database.',
        code: 'INVALID_TOKEN'
      };
    }

    const ticket = tickets[ticketIndex];

    // Ensure ticket strictly belongs to this event!
    if (ticket.eventId !== targetEventId) {
      const ticketEvent = this.getEventById(ticket.eventId);
      const otherEventTitle = ticket.eventTitle || ticketEvent?.title || 'Another Event';
      return {
        success: false,
        message: `WRONG EVENT PASS! This pass is registered for "${otherEventTitle}", not "${event.title}". Gate entry denied.`,
        ticket,
        code: 'WRONG_HOST_OR_EVENT'
      };
    }

    // Check status
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return {
        success: false,
        message: `Ticket is ${ticket.status.toUpperCase()} and cannot be used.`,
        ticket,
        code: 'TICKET_CANCELLED'
      };
    }

    // Strictly Entry-Only: Check if already entered
    if (ticket.entryStatus === 'entered') {
      return {
        success: false,
        message: `ALREADY USED! Checked in at ${ticket.entryTime || 'earlier today'}. Duplicate entry rejected!`,
        ticket,
        code: 'ALREADY_ENTERED'
      };
    }

    const now = new Date();
    const nowDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nowTimestamp = now.toISOString();

    const updatedTicket: Ticket = {
      ...ticket,
      entryStatus: 'entered',
      entryTime: nowDisplay,
      entryTimestamp: nowTimestamp,
      verifiedBy: 'volunteer',
      volunteerPin: cleanPin,
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
        entryTime: nowDisplay,
        entryTimestamp: nowTimestamp,
        verifiedBy: 'volunteer',
        volunteerGatePin: cleanPin,
        exitStatus: 'not_exited'
      }),
    }).catch(() => {});

    // 2. Sync to Firestore
    FirebaseDbService.updateTicket(updatedTicket.ticketId, {
      entryStatus: 'entered',
      entryTime: nowDisplay,
      entryTimestamp: nowTimestamp,
      verifiedBy: 'volunteer',
      volunteerPin: cleanPin,
      exitStatus: 'not_exited'
    }).catch(e => console.warn('Cloud volunteer updateTicket error:', e));

    return {
      success: true,
      message: `ENTRY GRANTED! Welcome ${updatedTicket.userName}. Pass verified successfully by Gate Staff.`,
      ticket: updatedTicket,
      code: 'VALID'
    };
  }

  // Scanner Verification: Strictly Entry-Only Gate Verification with Strict Host & Event Ownership Check
  static verifyAndProcessScan(
    qrToken: string,
    currentHostId: string,
    currentHostEmail?: string,
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
    const event = this.getEventById(ticket.eventId);

    // CRITICAL SECURITY ENFORCEMENT:
    // Only the organizer who created this event (matching hostId or hostEmail) can scan this ticket!
    const normalizedHostId = currentHostId?.trim();
    const normalizedHostEmail = currentHostEmail?.toLowerCase().trim();

    const isAuthorizedOrganizer = Boolean(
      (normalizedHostId && ticket.hostId && ticket.hostId === normalizedHostId) ||
      (normalizedHostId && event && event.hostId === normalizedHostId) ||
      (normalizedHostEmail && event && event.hostEmail && event.hostEmail.toLowerCase().trim() === normalizedHostEmail)
    );

    if (!isAuthorizedOrganizer) {
      const eventName = ticket.eventTitle || event?.title || 'Another Event';
      return {
        success: false,
        message: `UNAUTHORIZED SCANNER! This pass belongs to "${eventName}" created by a different organizer. Only the organizer of this event can scan and verify this pass.`,
        ticket,
        code: 'WRONG_HOST_OR_EVENT'
      };
    }

    // Check status
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return {
        success: false,
        message: `Ticket is ${ticket.status.toUpperCase()} and cannot be used.`,
        ticket,
        code: 'TICKET_CANCELLED'
      };
    }

    const now = new Date();
    const nowDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nowTimestamp = now.toISOString();

    // Strictly Entry-Only: Check if already entered
    if (ticket.entryStatus === 'entered') {
      return {
        success: false,
        message: `ALREADY USED! Checked in at ${ticket.entryTime || 'earlier today'}. Duplicate entry rejected!`,
        ticket,
        code: 'ALREADY_ENTERED'
      };
    }

    // Record entry check-in with exact ISO timestamp for precise reverse-chronological ordering
    const updatedTicket: Ticket = {
      ...ticket,
      entryStatus: 'entered',
      entryTime: nowDisplay,
      entryTimestamp: nowTimestamp,
      verifiedBy: 'organizer',
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
        entryTime: nowDisplay,
        entryTimestamp: nowTimestamp,
        verifiedBy: 'organizer',
        exitStatus: 'not_exited',
        requestingHostId: currentHostId,
        requestingHostEmail: currentHostEmail
      }),
    }).catch(() => {});

    // 2. Sync to Firestore
    FirebaseDbService.updateTicket(updatedTicket.ticketId, {
      entryStatus: 'entered',
      entryTime: nowDisplay,
      entryTimestamp: nowTimestamp,
      verifiedBy: 'organizer',
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

  // Bookmarks / Wishlist (scoped per active user)
  private static getBookmarkStorageKey(): string {
    const activeUid = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_UID_KEY) : null;
    return activeUid ? `${STORAGE_KEYS.BOOKMARKS}_${activeUid}` : STORAGE_KEYS.BOOKMARKS;
  }

  static getBookmarks(): string[] {
    const raw = localStorage.getItem(this.getBookmarkStorageKey());
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
    localStorage.setItem(this.getBookmarkStorageKey(), JSON.stringify(updated));
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

    // 1. FAST LOCAL LOOKUP: Instant 0ms response
    const local = this.findAccountByIdentifier(identifier);
    if (local && !forceFresh) {
      return local;
    }

    // 2. ULTRA-FAST SERVER API CHECK (/api/accounts is in-memory and returns in <5ms)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('/api/accounts', { signal: controller.signal });
      clearTimeout(timeoutId);
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

    // 3. If local exists, return it immediately without waiting for slow cloud
    if (local) return local;

    // 4. Default demo accounts (0ms instantaneous return)
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

    // 5. Cloud Firestore fallback with strict 1.5s timeout (only for new cross-device accounts)
    try {
      const fbPromise = FirebaseDbService.getAccounts();
      const timeoutPromise = new Promise<RegisteredAccount[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 1500)
      );
      const fbAccounts = await Promise.race([fbPromise, timeoutPromise]);
      if (Array.isArray(fbAccounts)) {
        const found = fbAccounts.find(matcher);
        if (found) {
          this.saveAccount(found);
          return found;
        }
      }
    } catch {}

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
    let accounts = this.getRegisteredAccounts();
    
    let idx = accounts.findIndex(
      a => (userId && a.uid === userId) || a.email.toLowerCase().trim() === cleanOldEmail
    );

    // If not found in local cache, check server database first before creating a partial account!
    let existingServerAccount: RegisteredAccount | undefined;
    if (idx === -1) {
      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const serverAccs: RegisteredAccount[] = await res.json();
          if (Array.isArray(serverAccs)) {
            existingServerAccount = serverAccs.find(
              a => (userId && a.uid === userId) || a.email.toLowerCase().trim() === cleanOldEmail
            );
            if (existingServerAccount) {
              accounts.push(existingServerAccount);
              idx = accounts.length - 1;
            }
          }
        }
      } catch {}
    }

    let updatedAccount: RegisteredAccount;

    if (idx >= 0) {
      const base = accounts[idx];
      updatedAccount = {
        ...base,
        uid: userId || base.uid,
        name: updates.name.trim(),
        email: cleanNewEmail,
        phone: updates.phone !== undefined ? updates.phone.trim() : (base.phone || ''),
        college: updates.college !== undefined ? updates.college.trim() : (base.college || ''),
        photoURL: updates.photoURL || base.photoURL,
        updatedAt: new Date().toISOString(),
      };
      accounts[idx] = updatedAccount;
    } else {
      updatedAccount = {
        uid: userId || `usr_${Date.now().toString(36)}`,
        name: updates.name.trim(),
        email: cleanNewEmail,
        phone: updates.phone?.trim() || '',
        college: updates.college?.trim() || '',
        photoURL: updates.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(updates.name.trim())}`,
        authProvider: 'email',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
  static getPayouts(hostId?: string, hostEmail?: string): PayoutRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
    if (!raw) return [];
    try {
      const parsed: PayoutRecord[] = JSON.parse(raw);
      // Clean out legacy mock dummy payout of 1500
      const cleaned = parsed.filter(p => p.payoutId !== 'pout_rzp_mv5dyagx_TTD1' && p.payoutId !== 'pout_rzp_mv8cukhu_V3LA');
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(cleaned));
      }
      if (hostId || hostEmail) {
        // Strictly return payouts belonging to this organizer ID or email only
        const cleanHostId = (hostId || '').trim();
        const cleanHostEmail = (hostEmail || '').toLowerCase().trim();
        return cleaned.filter(p =>
          (cleanHostId && p.hostId === cleanHostId) ||
          (cleanHostEmail && p.hostEmail && p.hostEmail.toLowerCase().trim() === cleanHostEmail)
        );
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  static savePayouts(payouts: PayoutRecord[], broadcast = true): void {
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(payouts));
    if (broadcast) {
      broadcastTabUpdate('payouts');
    }
  }

  static savePayoutRecord(payout: PayoutRecord): void {
    const payouts = this.getPayouts();
    const existingIdx = payouts.findIndex(p => p.payoutId === payout.payoutId);
    if (existingIdx > -1) {
      payouts[existingIdx] = payout;
    } else {
      payouts.unshift(payout);
    }
    this.markMutation(payout.payoutId);
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
    this.markMutation(newPayout.payoutId);
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
