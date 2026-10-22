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
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseInitialized } from './firebase';
import { CollegeEvent, Ticket, PaymentRecord, RegisteredAccount, PayoutRecord, UserProfile } from '../types';

const COLLECTIONS = {
  EVENTS: 'events',
  TICKETS: 'tickets',
  PAYMENTS: 'payments',
  ACCOUNTS: 'accounts',
  USERS: 'users',
  PAYOUTS: 'payouts',
};

export class FirebaseDbService {
  // ================= DATABASE RESET =================
  static async clearAll(): Promise<void> {
    if (!isFirebaseInitialized || !db) return;
    try {
      const collectionsToClear = [
        COLLECTIONS.EVENTS,
        COLLECTIONS.TICKETS,
        COLLECTIONS.PAYMENTS,
        COLLECTIONS.ACCOUNTS,
        COLLECTIONS.USERS,
        COLLECTIONS.PAYOUTS,
      ];
      for (const colName of collectionsToClear) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        const deletes = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(deletes);
      }
      console.log('FirebaseDbService: All Firestore collections flushed successfully.');
    } catch (error) {
      console.warn('FirebaseDbService.clearAll error:', error);
    }
  }

  // ================= EVENTS =================
  static async getEvents(): Promise<CollegeEvent[]> {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const colRef = collection(db, COLLECTIONS.EVENTS);
      const snapshot = await getDocs(colRef);
      const events: CollegeEvent[] = [];
      snapshot.forEach((docSnap) => {
        events.push(docSnap.data() as CollegeEvent);
      });
      // Sort by date / createdAt descending
      return events.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (error) {
      console.warn('Firestore getEvents error (using local storage fallback):', error);
      return [];
    }
  }

  static async saveEvent(event: CollegeEvent): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, event.eventId);
      await setDoc(docRef, { ...event, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore saveEvent error:', error);
      return false;
    }
  }

  static async updateEvent(eventId: string, updates: Partial<CollegeEvent>): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, eventId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return true;
    } catch (error) {
      console.warn('Firestore updateEvent error:', error);
      return false;
    }
  }

  static async deleteEvent(eventId: string): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.EVENTS, eventId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.warn('Firestore deleteEvent error:', error);
      return false;
    }
  }

  // ================= TICKETS =================
  static async getTickets(): Promise<Ticket[]> {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const colRef = collection(db, COLLECTIONS.TICKETS);
      const snapshot = await getDocs(colRef);
      const tickets: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        tickets.push(docSnap.data() as Ticket);
      });
      return tickets.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());
    } catch (error) {
      console.warn('Firestore getTickets error (using local fallback):', error);
      return [];
    }
  }

  static async saveTicket(ticket: Ticket): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.TICKETS, ticket.ticketId);
      await setDoc(docRef, ticket, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore saveTicket error:', error);
      return false;
    }
  }

  static async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.TICKETS, ticketId);
      await updateDoc(docRef, updates);
      return true;
    } catch (error) {
      console.warn('Firestore updateTicket error:', error);
      return false;
    }
  }

  // ================= PAYMENTS =================
  static async getPayments(): Promise<PaymentRecord[]> {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const colRef = collection(db, COLLECTIONS.PAYMENTS);
      const snapshot = await getDocs(colRef);
      const payments: PaymentRecord[] = [];
      snapshot.forEach((docSnap) => {
        payments.push(docSnap.data() as PaymentRecord);
      });
      return payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (error) {
      console.warn('Firestore getPayments error:', error);
      return [];
    }
  }

  static async savePayment(payment: PaymentRecord): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.PAYMENTS, payment.paymentId);
      await setDoc(docRef, payment, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore savePayment error:', error);
      return false;
    }
  }

  // ================= ACCOUNTS / USERS =================
  static async getAccounts(): Promise<RegisteredAccount[]> {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const colRef = collection(db, COLLECTIONS.ACCOUNTS);
      const snapshot = await getDocs(colRef);
      const accounts: RegisteredAccount[] = [];
      snapshot.forEach((docSnap) => {
        accounts.push(docSnap.data() as RegisteredAccount);
      });
      return accounts;
    } catch (error) {
      console.warn('Firestore getAccounts error:', error);
      return [];
    }
  }

  static async saveAccount(account: RegisteredAccount): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      // Use email as doc ID sanitized or uid
      const docRef = doc(db, COLLECTIONS.ACCOUNTS, account.uid);
      await setDoc(docRef, account, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore saveAccount error:', error);
      return false;
    }
  }

  // ================= PASSWORD UPDATE IN FIRESTORE =================
  static async updateAccountPassword(email: string, newPassword: string): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const cleanEmail = email.toLowerCase().trim();
      let updatedCount = 0;

      // 1. Update matching docs in accounts collection
      try {
        const accCol = collection(db, COLLECTIONS.ACCOUNTS);
        const qAcc = query(accCol, where('email', '==', cleanEmail));
        const snapAcc = await getDocs(qAcc);
        for (const docSnap of snapAcc.docs) {
          await setDoc(docSnap.ref, { password: newPassword, updatedAt: new Date().toISOString() }, { merge: true });
          updatedCount++;
        }
      } catch (err) {
        console.warn('Firestore updateAccountPassword accounts error:', err);
      }

      // 2. Update matching docs in users collection
      try {
        const userCol = collection(db, COLLECTIONS.USERS);
        const qUser = query(userCol, where('email', '==', cleanEmail));
        const snapUser = await getDocs(qUser);
        for (const docSnap of snapUser.docs) {
          await setDoc(docSnap.ref, { password: newPassword, updatedAt: new Date().toISOString() }, { merge: true });
          updatedCount++;
        }
      } catch (err) {
        console.warn('Firestore updateAccountPassword users error:', err);
      }

      // 3. If no docs found in Firestore, create an accounts entry
      if (updatedCount === 0) {
        const fallbackUid = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const docRef = doc(db, COLLECTIONS.ACCOUNTS, fallbackUid);
        await setDoc(docRef, {
          uid: fallbackUid,
          email: cleanEmail,
          password: newPassword,
          name: cleanEmail.split('@')[0],
          role: 'user',
          authProvider: 'email',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      console.log(`[FirebaseDbService] Firestore password updated for ${cleanEmail}`);
      return true;
    } catch (error) {
      console.warn('Firestore updateAccountPassword error:', error);
      return false;
    }
  }

  // ================= USER PROFILES =================
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!isFirebaseInitialized || !db) return null;
    try {
      const docRef = doc(db, COLLECTIONS.USERS, uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as UserProfile;
      }
      // Check accounts collection fallback
      const accRef = doc(db, COLLECTIONS.ACCOUNTS, uid);
      const accSnap = await getDoc(accRef);
      if (accSnap.exists()) {
        const acc = accSnap.data() as RegisteredAccount;
        return {
          uid: acc.uid,
          name: acc.name,
          email: acc.email,
          role: acc.role || 'user',
          college: acc.college,
          phone: acc.phone,
          photoURL: acc.photoURL,
          authProvider: acc.authProvider || 'email',
          createdAt: acc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return null;
    } catch (e) {
      console.warn('Firestore getUserProfile error:', e);
      return null;
    }
  }

  static async findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!isFirebaseInitialized || !db) return null;
    try {
      const cleanEmail = email.toLowerCase().trim();
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as UserProfile;
      }
      return null;
    } catch (e) {
      console.warn('Firestore findUserByEmail error:', e);
      return null;
    }
  }

  static async saveUserProfile(profile: UserProfile): Promise<boolean> {
    if (!isFirebaseInitialized || !db || !profile?.uid) return false;
    try {
      const docRef = doc(db, COLLECTIONS.USERS, profile.uid);
      await setDoc(docRef, { ...profile, updatedAt: new Date().toISOString() }, { merge: true });
      // Also sync to accounts
      const accRef = doc(db, COLLECTIONS.ACCOUNTS, profile.uid);
      await setDoc(accRef, {
        uid: profile.uid,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        college: profile.college || '',
        phone: profile.phone || '',
        photoURL: profile.photoURL || '',
        authProvider: profile.authProvider || 'email',
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore saveUserProfile error:', e);
      return false;
    }
  }

  static async updateUserTickets(userId: string, newName: string, newEmail: string, newPhone?: string): Promise<boolean> {
    if (!isFirebaseInitialized || !db || !userId) return false;
    try {
      const colRef = collection(db, COLLECTIONS.TICKETS);
      const q = query(colRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return true;
      const updates = snapshot.docs.map(docSnap => 
        setDoc(docSnap.ref, {
          userName: newName,
          userEmail: newEmail,
          ...(newPhone ? { phone: newPhone } : {}),
        }, { merge: true })
      );
      await Promise.all(updates);
      return true;
    } catch (e) {
      console.warn('Firestore updateUserTickets error:', e);
      return false;
    }
  }

  // ================= PAYOUTS =================
  static async getPayouts(): Promise<PayoutRecord[]> {
    if (!isFirebaseInitialized || !db) return [];
    try {
      const colRef = collection(db, COLLECTIONS.PAYOUTS);
      const snapshot = await getDocs(colRef);
      const payouts: PayoutRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.payoutId) {
          payouts.push(data as PayoutRecord);
        }
      });
      return payouts.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    } catch (error) {
      console.warn('Firestore getPayouts error:', error);
      return [];
    }
  }

  static async savePayout(payout: PayoutRecord): Promise<boolean> {
    if (!isFirebaseInitialized || !db) return false;
    try {
      const docRef = doc(db, COLLECTIONS.PAYOUTS, payout.payoutId);
      // Remove undefined values to prevent Firestore rejection
      const sanitized: Record<string, any> = {};
      Object.entries(payout).forEach(([k, v]) => {
        if (v !== undefined) {
          sanitized[k] = v;
        }
      });
      await setDoc(docRef, sanitized, { merge: true });
      return true;
    } catch (error) {
      console.warn('Firestore savePayout error:', error);
      return false;
    }
  }
}
