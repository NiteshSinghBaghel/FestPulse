import {
  CollegeEvent,
  Ticket,
  PaymentRecord,
  RegisteredAccount,
  PayoutRecord,
  UserProfile,
} from '../types';

export class FirebaseDbService {
  static getActiveFirebaseUid(): string | null {
    return null;
  }

  static async clearAll(): Promise<void> {}
  static async getEvents(_hostId?: string): Promise<CollegeEvent[]> {
    return [];
  }
  static subscribeEvents(_hostId: string | undefined, _onUpdate: (events: CollegeEvent[]) => void): () => void {
    return () => {};
  }
  static async saveEvent(_event: CollegeEvent): Promise<boolean> {
    return false;
  }
  static async updateEvent(_eventId: string, _updates: Partial<CollegeEvent>): Promise<boolean> {
    return false;
  }
  static async deleteEvent(_eventId: string): Promise<boolean> {
    return false;
  }
  static async findEventByGatePin(_gatePin: string): Promise<CollegeEvent | null> {
    return null;
  }
  static async getTickets(_userId?: string, _role: 'user' | 'host' = 'user'): Promise<Ticket[]> {
    return [];
  }
  static subscribeUserTickets(_userId: string, _onUpdate: (tickets: Ticket[]) => void): () => void {
    return () => {};
  }
  static subscribeHostTickets(_hostId: string, _onUpdate: (tickets: Ticket[]) => void): () => void {
    return () => {};
  }
  static async saveTicket(_ticket: Ticket): Promise<boolean> {
    return false;
  }
  static async updateTicket(_ticketId: string, _updates: Partial<Ticket>): Promise<boolean> {
    return false;
  }
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
  static async getUserProfile(_uid: string): Promise<UserProfile | null> {
    return null;
  }
  static async findUserByEmail(_email: string): Promise<UserProfile | null> {
    return null;
  }
  static async saveUserProfile(_profile: UserProfile): Promise<boolean> {
    return false;
  }
  static async updateUserTickets(
    _uid: string,
    _name: string,
    _email: string,
    _phone?: string
  ): Promise<boolean> {
    return false;
  }
  static async getPayouts(_hostId?: string): Promise<PayoutRecord[]> {
    return [];
  }
  static subscribeHostPayouts(_hostId: string, _onUpdate: (payouts: PayoutRecord[]) => void): () => void {
    return () => {};
  }
  static async savePayout(_payout: PayoutRecord): Promise<boolean> {
    return false;
  }
}
