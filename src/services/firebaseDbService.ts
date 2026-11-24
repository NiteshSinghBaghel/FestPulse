import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db, isFirebaseInitialized } from './firebase';
import { CollegeEvent, Ticket, PaymentRecord, RegisteredAccount, PayoutRecord, UserProfile } from '../types';

const COLLECTIONS = {
  EVENTS: 'events',
  TICKETS: 'tickets',
  USERS: 'users',
  PAYOUTS: 'payouts',
};

function toIsoString(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return fallback;
    }
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return fallback;
}

function normalizeEvent(raw: any, docId?: string): CollegeEvent {
  return {
    ...raw,
    eventId: raw.eventId || docId || '',
    createdAt: toIsoString(raw.createdAt, new Date().toISOString()),
    updatedAt: toIsoString(raw.updatedAt, new Date().toISOString()),
  } as CollegeEvent;
}

function normalizeTicket(raw: any, docId?: string): Ticket {
  return {
    ...raw,
    ticketId: raw.ticketId || docId || '',
    issuedAt: toIsoString(raw.issuedAt || raw.createdAt, new Date().toISOString()),
    entryTimestamp: raw.entryTimestamp
      ? toIsoString(raw.entryTimestamp)
      : raw.entryTimestampMs
      ? new Date(raw.entryTimestampMs).toISOString()
      : undefined,
  } as Ticket;
}

function normalizePayout(raw: any, docId?: string): PayoutRecord {
  return {
    ...raw,
    payoutId: raw.payoutId || docId || '',
    timestamp: toIsoString(raw.timestamp || raw.createdAt, new Date().toISOString()),
  } as PayoutRecord;
}

export class FirebaseDbService {
  static getActiveFirebaseUid(): string | null {
    if (!isFirebaseInitialized || !auth?.currentUser) return null;
    return auth.currentUser.uid;
  }

  // ================= DATABASE RESET =================
  static async clearAll(): Promise<void> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return;
    try {
      const hostEventsSnap = await getDocs(
        query(collection(db, COLLECTIONS.EVENTS), where('hostId', '==', activeUid))
      );
      await Promise.all(hostEventsSnap.docs.map(docSnap => deleteDoc(docSnap.ref)));
    } catch (error) {
      console.warn('FirebaseDbService.clearAll warning:', error);
    }
  }

  // ================= EVENTS =================
  static async getEvents(hostId?: string): Promise<CollegeEvent[]> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return [];
    try {
      const colRef = collection(db, COLLECTIONS.EVENTS);
      const queries = [
        getDocs(query(colRef, where('status', 'in', ['published', 'sold_out', 'cancelled']))),
      ];
      if (hostId && hostId === activeUid) {
        queries.push(getDocs(query(colRef, where('hostId', '==', activeUid))));
      }
      const snapshots = await Promise.all(queries);
      const map = new Map<string, CollegeEvent>();
      snapshots.forEach(snap => {
        snap.forEach((docSnap) => {
          const evt = normalizeEvent(docSnap.data(), docSnap.id);
          if (evt.eventId) map.set(evt.eventId, evt);
        });
      });
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } catch (error) {
      console.warn('Firestore getEvents warning:', error);
      return [];
    }
  }

  static subscribeEvents(
    hostId: string | undefined,
    onUpdate: (events: CollegeEvent[]) => void
  ): Unsubscribe {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) {
      return () => {};
    }
    const colRef = collection(db, COLLECTIONS.EVENTS);
    const mergedMap = new Map<string, CollegeEvent>();

    const emit = () => {
      const list = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      onUpdate(list);
    };

    const unsubPublic = onSnapshot(
      query(colRef, where('status', 'in', ['published', 'sold_out', 'cancelled'])),
      (snap) => {
        snap.forEach((docSnap) => {
          const evt = normalizeEvent(docSnap.data(), docSnap.id);
          if (evt.eventId) mergedMap.set(evt.eventId, evt);
        });
        emit();
      },
      (err) => console.warn('Firestore subscribeEvents warning:', err)
    );

    let unsubOwn: Unsubscribe = () => {};
    if (hostId && hostId === activeUid) {
      unsubOwn = onSnapshot(
        query(colRef, where('hostId', '==', activeUid)),
        (snap) => {
          snap.forEach((docSnap) => {
            const evt = normalizeEvent(docSnap.data(), docSnap.id);
            if (evt.eventId) mergedMap.set(evt.eventId, evt);
          });
          emit();
        },
        () => {}
      );
    }

    return () => {
      unsubPublic();
      unsubOwn();
    };
  }

  static async saveEvent(event: CollegeEvent): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || event.hostId !== activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, event.eventId);
      const now = Timestamp.now();
      await setDoc(docRef, {
        hostId: event.hostId,
        hostName: event.hostName,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl || '',
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        venue: event.venue,
        price: Math.round(Number(event.price) || 0),
        capacity: Math.round(Number(event.capacity) || 1),
        ticketsSold: Math.round(Number(event.ticketsSold) || 0),
        availableTickets: Math.round(Number(event.availableTickets) || 0),
        status: event.status === 'draft' ? 'published' : event.status,
        category: event.category,
        gatePin:
          event.gatePin && /^\d{6}$/.test(String(event.gatePin).trim())
            ? String(event.gatePin).trim()
            : Math.floor(100000 + Math.random() * 900000).toString(),
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore saveEvent warning:', error);
      return false;
    }
  }

  static async updateEvent(eventId: string, updates: Partial<CollegeEvent>): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, eventId);
      const sanitized: Record<string, any> = { updatedAt: Timestamp.now() };
      const allowed = ['title', 'description', 'imageUrl', 'date', 'startTime', 'endTime', 'location', 'venue', 'price', 'capacity', 'ticketsSold', 'availableTickets', 'status', 'category', 'gatePin'];
      for (const key of allowed) {
        if ((updates as any)[key] !== undefined) {
          sanitized[key] = (updates as any)[key];
        }
      }
      await updateDoc(docRef, sanitized);
      return true;
    } catch (error) {
      console.warn('Firestore updateEvent warning:', error);
      return false;
    }
  }

  static async deleteEvent(eventId: string): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, eventId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.warn('Firestore deleteEvent warning:', error);
      return false;
    }
  }

  static async findEventByGatePin(gatePin: string): Promise<CollegeEvent | null> {
    const cleanPin = (gatePin || '').trim();
    if (!/^\d{6}$/.test(cleanPin)) return null;
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return null;
    try {
      const colRef = collection(db, COLLECTIONS.EVENTS);
      const q = query(
        colRef,
        where('status', 'in', ['published', 'sold_out']),
        where('gatePin', '==', cleanPin)
      );
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        const evt = normalizeEvent(docSnap.data(), docSnap.id);
        if (evt && String(evt.gatePin || '').trim() === cleanPin && evt.status !== 'cancelled') {
          return evt;
        }
      }
      return null;
    } catch (error) {
      console.warn('Firestore findEventByGatePin warning:', error);
      return null;
    }
  }

  // ================= TICKETS (STRICTLY SCOPED) =================
  static async getTickets(userId?: string, role: 'user' | 'host' = 'user'): Promise<Ticket[]> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return [];
    if (userId && userId !== activeUid) return [];
    try {
      const colRef = collection(db, COLLECTIONS.TICKETS);
      const field = role === 'host' ? 'hostId' : 'userId';
      const snapshot = await getDocs(query(colRef, where(field, '==', activeUid)));
      const tickets: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        tickets.push(normalizeTicket(docSnap.data(), docSnap.id));
      });
      return tickets.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
    } catch (error) {
      console.warn('Firestore getTickets warning:', error);
      return [];
    }
  }

  static subscribeUserTickets(
    userId: string,
    onUpdate: (tickets: Ticket[]) => void
  ): Unsubscribe {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || userId !== activeUid) {
      return () => {};
    }
    const q = query(collection(db, COLLECTIONS.TICKETS), where('userId', '==', activeUid));
    return onSnapshot(
      q,
      (snap) => {
        const list: Ticket[] = [];
        snap.forEach((docSnap) => list.push(normalizeTicket(docSnap.data(), docSnap.id)));
        list.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
        onUpdate(list);
      },
      (err) => console.warn('Firestore subscribeUserTickets warning:', err)
    );
  }

  static subscribeHostTickets(
    hostId: string,
    onUpdate: (tickets: Ticket[]) => void
  ): Unsubscribe {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || hostId !== activeUid) {
      return () => {};
    }
    const q = query(collection(db, COLLECTIONS.TICKETS), where('hostId', '==', activeUid));
    return onSnapshot(
      q,
      (snap) => {
        const list: Ticket[] = [];
        snap.forEach((docSnap) => list.push(normalizeTicket(docSnap.data(), docSnap.id)));
        list.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
        onUpdate(list);
      },
      (err) => console.warn('Firestore subscribeHostTickets warning:', err)
    );
  }

  static async saveTicket(ticket: Ticket): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || ticket.userId !== activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.TICKETS, ticket.ticketId);
      const now = Timestamp.now();
      await setDoc(docRef, {
        eventId: ticket.eventId,
        eventTitle: ticket.eventTitle,
        eventDate: ticket.eventDate,
        eventTime: ticket.eventTime,
        eventVenue: ticket.eventVenue,
        eventImageUrl: ticket.eventImageUrl || '',
        userId: ticket.userId,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        ...(ticket.college ? { college: ticket.college } : {}),
        ...(ticket.rollNo ? { rollNo: ticket.rollNo } : {}),
        hostId: ticket.hostId,
        amount: Math.round(Number(ticket.amount) || 0),
        status: ticket.status === 'cancelled' ? 'cancelled' : 'confirmed',
        qrToken: ticket.qrToken,
        qrHash: ticket.qrHash,
        entryStatus: ticket.entryStatus === 'entered' ? 'entered' : 'not_entered',
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore saveTicket warning:', error);
      return false;
    }
  }

  static async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.TICKETS, ticketId);
      const sanitized: Record<string, any> = { updatedAt: Timestamp.now() };
      if (updates.status !== undefined) sanitized.status = updates.status;
      if (updates.entryStatus !== undefined) sanitized.entryStatus = updates.entryStatus;
      if (updates.entryTime !== undefined) sanitized.entryTime = updates.entryTime;
      if (updates.verifiedBy !== undefined) sanitized.verifiedBy = updates.verifiedBy;
      if (updates.volunteerPin !== undefined) sanitized.volunteerPin = updates.volunteerPin;
      if (updates.entryTimestamp) {
        sanitized.entryTimestampMs = new Date(updates.entryTimestamp).getTime();
      }
      await updateDoc(docRef, sanitized);
      return true;
    } catch (error) {
      console.warn('Firestore updateTicket warning:', error);
      return false;
    }
  }

  // ================= PAYMENTS & ACCOUNTS (Server/Local managed; Firestore denied by rules) =================
  static async getPayments(): Promise<PaymentRecord[]> {
    return [];
  }

  static async savePayment(_payment: PaymentRecord): Promise<boolean> {
    return false;
  }

  static async getAccounts(): Promise<RegisteredAccount[]> {
    return [];
  }

  static async saveAccount(_account: RegisteredAccount): Promise<boolean> {
    return false;
  }

  static async updateAccountPassword(_email: string, _newPassword: string): Promise<boolean> {
    return false;
  }

  // ================= USER PROFILES =================
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || uid !== activeUid) return null;
    try {
      const docRef = doc(db, COLLECTIONS.USERS, uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...data,
          uid: data.userId || data.uid || uid,
          photoURL: data.photoUrl || data.photoURL || '',
          createdAt: toIsoString(data.createdAt, new Date().toISOString()),
          updatedAt: toIsoString(data.updatedAt, new Date().toISOString()),
        } as UserProfile;
      }
      return null;
    } catch (e) {
      console.warn('Firestore getUserProfile warning:', e);
      return null;
    }
  }

  static async findUserByEmail(_email: string): Promise<UserProfile | null> {
    // Disallowed by zero-trust security rules (only self userId read allowed)
    return null;
  }

  static async saveUserProfile(profile: UserProfile): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !profile?.uid || !activeUid || profile.uid !== activeUid) {
      return false;
    }
    try {
      const docRef = doc(db, COLLECTIONS.USERS, profile.uid);
      const now = Timestamp.now();
      await setDoc(docRef, {
        userId: profile.uid,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        ...(profile.college !== undefined ? { college: profile.college } : {}),
        ...(profile.phone !== undefined ? { phone: profile.phone } : {}),
        ...(profile.photoURL !== undefined ? { photoUrl: profile.photoURL } : {}),
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore saveUserProfile warning:', e);
      return false;
    }
  }

  static async updateUserTickets(
    _userId: string,
    _newName: string,
    _newEmail: string,
    _newPhone?: string
  ): Promise<boolean> {
    return false;
  }

  // ================= PAYOUTS (STRICTLY HOST-SCOPED) =================
  static async getPayouts(hostId?: string): Promise<PayoutRecord[]> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid) return [];
    if (hostId && hostId !== activeUid) return [];
    try {
      const colRef = collection(db, COLLECTIONS.PAYOUTS);
      const snapshot = await getDocs(query(colRef, where('hostId', '==', activeUid)));
      const payouts: PayoutRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = normalizePayout(docSnap.data(), docSnap.id);
        if (data && data.payoutId) payouts.push(data);
      });
      return payouts.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    } catch (error) {
      console.warn('Firestore getPayouts warning:', error);
      return [];
    }
  }

  static subscribeHostPayouts(
    hostId: string,
    onUpdate: (payouts: PayoutRecord[]) => void
  ): Unsubscribe {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || hostId !== activeUid) {
      return () => {};
    }
    const q = query(collection(db, COLLECTIONS.PAYOUTS), where('hostId', '==', activeUid));
    return onSnapshot(
      q,
      (snap) => {
        const list: PayoutRecord[] = [];
        snap.forEach((docSnap) => {
          const data = normalizePayout(docSnap.data(), docSnap.id);
          if (data && data.payoutId) list.push(data);
        });
        list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        onUpdate(list);
      },
      (err) => console.warn('Firestore subscribeHostPayouts warning:', err)
    );
  }

  static async savePayout(payout: PayoutRecord): Promise<boolean> {
    const activeUid = this.getActiveFirebaseUid();
    if (!isFirebaseInitialized || !db || !activeUid || payout.hostId !== activeUid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.PAYOUTS, payout.payoutId);
      const now = Timestamp.now();
      await setDoc(docRef, {
        hostId: payout.hostId,
        hostName: payout.hostName,
        amount: Math.round(Number(payout.amount) || 0),
        method: payout.method,
        destination: payout.destination,
        accountHolderName: payout.accountHolderName,
        status: payout.status === 'processing' ? 'processing' : 'completed',
        referenceId: payout.referenceId,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore savePayout warning:', error);
      return false;
    }
  }
}
