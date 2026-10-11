import pg from 'pg';

export const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export class PostgresService {
  private static pool: pg.Pool | null = null;
  private static isConnected = false;
  private static currentConnectionString = '';
  private static host = '';
  private static database = '';
  private static isSsl = false;

  static getConnected(): boolean {
    return this.isConnected && this.pool !== null;
  }

  static async getStatus(): Promise<{
    connected: boolean;
    host?: string;
    database?: string;
    ssl?: boolean;
    tables?: { events: number; tickets: number; accounts: number; payouts: number };
    error?: string;
  }> {
    if (!this.getConnected() || !this.pool) {
      return { connected: false };
    }

    try {
      const client = await this.pool.connect();
      try {
        const [evRes, tkRes, acRes, pyRes] = await Promise.all([
          client.query('SELECT COUNT(*) FROM events').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM tickets').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM accounts').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM payouts').catch(() => ({ rows: [{ count: 0 }] })),
        ]);

        return {
          connected: true,
          host: this.host,
          database: this.database,
          ssl: this.isSsl,
          tables: {
            events: parseInt(evRes.rows[0]?.count || '0', 10),
            tickets: parseInt(tkRes.rows[0]?.count || '0', 10),
            accounts: parseInt(acRes.rows[0]?.count || '0', 10),
            payouts: parseInt(pyRes.rows[0]?.count || '0', 10),
          },
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return {
        connected: false,
        error: err.message,
      };
    }
  }

  static async connect(
    connectionString: string,
    autoCreateSchema: boolean = true
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (this.pool) {
        await this.disconnect();
      }

      const sslConfig = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false;

      const newPool = new pg.Pool({
        connectionString,
        ssl: sslConfig,
        connectionTimeoutMillis: 10000,
      });

      const client = await newPool.connect();
      try {
        await client.query('SELECT 1');
        if (autoCreateSchema) {
          await client.query(POSTGRES_SCHEMA_SQL);
        }
      } finally {
        client.release();
      }

      this.pool = newPool;
      this.isConnected = true;
      this.currentConnectionString = connectionString;

      try {
        const parsed = new URL(connectionString);
        this.host = parsed.hostname;
        this.database = parsed.pathname.replace(/^\//, '');
        this.isSsl = Boolean(sslConfig);
      } catch {
        this.host = 'remote';
        this.database = 'postgres';
        this.isSsl = true;
      }

      return { success: true, message: 'Connected successfully' };
    } catch (err: any) {
      this.isConnected = false;
      this.pool = null;
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  static async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {}
      this.pool = null;
    }
    this.isConnected = false;
    this.currentConnectionString = '';
  }

  static async migrateFromData(data: {
    events: any[];
    tickets: any[];
    accounts: any[];
    payouts: any[];
  }): Promise<{ events: number; tickets: number; accounts: number; payouts: number }> {
    if (!this.pool || !this.isConnected) {
      throw new Error('PostgreSQL is not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query(POSTGRES_SCHEMA_SQL);

      let evCount = 0;
      let tkCount = 0;
      let acCount = 0;
      let pyCount = 0;

      for (const ev of data.events || []) {
        if (ev?.eventId) {
          await client.query(
            'INSERT INTO events (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
            [ev.eventId, JSON.stringify(ev)]
          );
          evCount++;
        }
      }

      for (const tk of data.tickets || []) {
        if (tk?.ticketId) {
          await client.query(
            'INSERT INTO tickets (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
            [tk.ticketId, JSON.stringify(tk)]
          );
          tkCount++;
        }
      }

      for (const ac of data.accounts || []) {
        if (ac?.email) {
          await client.query(
            'INSERT INTO accounts (email, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()',
            [ac.email.toLowerCase(), JSON.stringify(ac)]
          );
          acCount++;
        }
      }

      for (const py of data.payouts || []) {
        if (py?.id) {
          await client.query(
            'INSERT INTO payouts (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
            [py.id, JSON.stringify(py)]
          );
          pyCount++;
        }
      }

      return { events: evCount, tickets: tkCount, accounts: acCount, payouts: pyCount };
    } finally {
      client.release();
    }
  }

  static async clearDatabase(): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    const client = await this.pool.connect();
    try {
      await client.query('TRUNCATE TABLE events, tickets, accounts, payouts');
    } finally {
      client.release();
    }
  }

  static async getEvents(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM events ORDER BY updated_at DESC');
      return res.rows.map(r => r.data);
    } catch {
      return [];
    }
  }

  static async getTickets(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM tickets ORDER BY updated_at DESC');
      return res.rows.map(r => r.data);
    } catch {
      return [];
    }
  }

  static async getAccounts(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM accounts');
      return res.rows.map(r => r.data);
    } catch {
      return [];
    }
  }

  static async getPayouts(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM payouts ORDER BY updated_at DESC');
      return res.rows.map(r => r.data);
    } catch {
      return [];
    }
  }

  static async upsertEvent(event: any): Promise<void> {
    if (!this.pool || !this.isConnected || !event?.eventId) return;
    try {
      await this.pool.query(
        'INSERT INTO events (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
        [event.eventId, JSON.stringify(event)]
      );
    } catch (e: any) {
      console.warn('Postgres upsertEvent error:', e.message);
    }
  }

  static async deleteEvent(eventId: string): Promise<void> {
    if (!this.pool || !this.isConnected || !eventId) return;
    try {
      await this.pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    } catch (e: any) {
      console.warn('Postgres deleteEvent error:', e.message);
    }
  }

  static async upsertTicket(ticket: any): Promise<void> {
    if (!this.pool || !this.isConnected || !ticket?.ticketId) return;
    try {
      await this.pool.query(
        'INSERT INTO tickets (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
        [ticket.ticketId, JSON.stringify(ticket)]
      );
    } catch (e: any) {
      console.warn('Postgres upsertTicket error:', e.message);
    }
  }

  static async upsertAccount(account: any): Promise<void> {
    if (!this.pool || !this.isConnected || !account?.email) return;
    try {
      await this.pool.query(
        'INSERT INTO accounts (email, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()',
        [account.email.toLowerCase(), JSON.stringify(account)]
      );
    } catch (e: any) {
      console.warn('Postgres upsertAccount error:', e.message);
    }
  }

  static async deleteAccount(email: string): Promise<void> {
    if (!this.pool || !this.isConnected || !email) return;
    try {
      await this.pool.query('DELETE FROM accounts WHERE email = $1', [email.toLowerCase().trim()]);
    } catch (e: any) {
      console.warn('Postgres deleteAccount error:', e.message);
    }
  }

  static async insertPayout(payout: any): Promise<void> {
    if (!this.pool || !this.isConnected || !payout?.id) return;
    try {
      await this.pool.query(
        'INSERT INTO payouts (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
        [payout.id, JSON.stringify(payout)]
      );
    } catch (e: any) {
      console.warn('Postgres insertPayout error:', e.message);
    }
  }
}
