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

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_payout_profiles (
  host_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export interface PostgresMigrationPayload {
  events: any[];
  tickets: any[];
  accounts: any[];
  payouts: any[];
  payments?: any[];
  hostPayoutProfiles?: Record<string, any>;
}

export interface PostgresHydrationPayload {
  events: any[];
  tickets: any[];
  accounts: any[];
  payouts: any[];
  payments: any[];
  hostPayoutProfiles: Record<string, any>;
}

function resolveSslConfig(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  const lower = (connectionString || '').toLowerCase();
  if (lower.includes('sslmode=disable')) {
    return false;
  }
  if (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full') ||
    lower.includes('neon.tech') ||
    lower.includes('supabase.co') ||
    lower.includes('supabase.com') ||
    lower.includes('render.com') ||
    lower.includes('rlwy.net') ||
    lower.includes('railway.app') ||
    lower.includes('aivencloud.com') ||
    lower.includes('vercel-storage.com')
  ) {
    return { rejectUnauthorized: false };
  }
  try {
    const parsed = new URL(connectionString);
    const host = (parsed.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return false;
    }
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

export class PostgresService {
  private static pool: pg.Pool | null = null;
  private static isConnected = false;
  private static currentConnectionString = '';
  private static host = '';
  private static database = '';
  private static isSsl = false;
  private static autoConnectInFlight: Promise<boolean> | null = null;
  private static lastAutoConnectAttempt = 0;
  private static lastAutoConnectError = '';

  static getConnected(): boolean {
    return false;
  }

  static getLastError(): string {
    return this.lastAutoConnectError;
  }

  static async getStatus(): Promise<{
    connected: boolean;
    host?: string;
    database?: string;
    ssl?: boolean;
    tables?: {
      events: number;
      tickets: number;
      accounts: number;
      payouts: number;
      payments: number;
      hostPayoutProfiles: number;
    };
    error?: string;
  }> {
    if (!this.getConnected() || !this.pool) {
      return {
        connected: false,
        ...(this.lastAutoConnectError ? { error: this.lastAutoConnectError } : {}),
      };
    }

    try {
      const client = await this.pool.connect();
      try {
        const [evRes, tkRes, acRes, pyRes, pmRes, pfRes] = await Promise.all([
          client.query('SELECT COUNT(*) FROM events').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM tickets').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM accounts').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM payouts').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM payments').catch(() => ({ rows: [{ count: 0 }] })),
          client.query('SELECT COUNT(*) FROM host_payout_profiles').catch(() => ({ rows: [{ count: 0 }] })),
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
            payments: parseInt(pmRes.rows[0]?.count || '0', 10),
            hostPayoutProfiles: parseInt(pfRes.rows[0]?.count || '0', 10),
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
      const cleanConn = String(connectionString || '').trim();
      if (!cleanConn) {
        return { success: false, error: 'Connection string is required' };
      }

      if (this.pool) {
        await this.disconnect();
      }

      const sslConfig = resolveSslConfig(cleanConn);

      const newPool = new pg.Pool({
        connectionString: cleanConn,
        ssl: sslConfig,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      newPool.on('error', (err: any) => {
        console.warn('[Postgres] Idle pool client error:', err?.message || err);
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
      this.currentConnectionString = cleanConn;
      this.lastAutoConnectError = '';

      try {
        const parsed = new URL(cleanConn);
        this.host = parsed.hostname;
        this.database = parsed.pathname.replace(/^\//, '');
        this.isSsl = Boolean(sslConfig);
      } catch {
        this.host = 'remote';
        this.database = 'postgres';
        this.isSsl = Boolean(sslConfig);
      }

      return { success: true, message: 'Connected successfully' };
    } catch (err: any) {
      this.isConnected = false;
      this.pool = null;
      this.lastAutoConnectError = err?.message || 'Connection failed';
      return { success: false, error: this.lastAutoConnectError };
    }
  }

  static async ensureAutoConnected(
    connectionString?: string,
    seedData?: PostgresMigrationPayload
  ): Promise<boolean> {
    const cleanConn = String(connectionString || '').trim();
    if (!cleanConn) return false;

    if (this.getConnected() && this.currentConnectionString === cleanConn) {
      return true;
    }

    if (this.autoConnectInFlight) {
      return this.autoConnectInFlight;
    }

    // Prevent hammering a failing DB on every HTTP request; retry after 15s cooldown
    const now = Date.now();
    if (now - this.lastAutoConnectAttempt < 15000 && this.lastAutoConnectError) {
      return false;
    }

    this.lastAutoConnectAttempt = now;
    this.autoConnectInFlight = (async () => {
      try {
        const res = await this.connect(cleanConn, true);
        if (!res.success) {
          console.warn('[Postgres] Auto-connect failed:', res.error);
          return false;
        }

        // Seed existing local records ONLY if remote Postgres is completely empty
        if (seedData) {
          const hasLocalData =
            (seedData.events?.length || 0) > 0 ||
            (seedData.tickets?.length || 0) > 0 ||
            (seedData.accounts?.length || 0) > 0 ||
            (seedData.payouts?.length || 0) > 0 ||
            (seedData.payments?.length || 0) > 0 ||
            Object.keys(seedData.hostPayoutProfiles || {}).length > 0;

          if (hasLocalData) {
            const status = await this.getStatus();
            const remoteTotal = status.tables
              ? status.tables.events +
                status.tables.tickets +
                status.tables.accounts +
                status.tables.payouts +
                status.tables.payments +
                status.tables.hostPayoutProfiles
              : 0;
            if (remoteTotal === 0) {
              await this.migrateFromData(seedData).catch((e: any) =>
                console.warn('[Postgres] Initial auto-seed warning:', e?.message || e)
              );
            }
          }
        }

        console.log(`[Postgres] Connected permanently to ${this.host}/${this.database} (SSL: ${this.isSsl})`);
        return true;
      } finally {
        this.autoConnectInFlight = null;
      }
    })();

    return this.autoConnectInFlight;
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
    this.host = '';
    this.database = '';
  }

  static async migrateFromData(data: PostgresMigrationPayload): Promise<{
    events: number;
    tickets: number;
    accounts: number;
    payouts: number;
    payments: number;
    hostPayoutProfiles: number;
  }> {
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
      let pmCount = 0;
      let pfCount = 0;

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
        const payoutKey = py?.payoutId || py?.id;
        if (payoutKey) {
          await client.query(
            'INSERT INTO payouts (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
            [payoutKey, JSON.stringify(py)]
          );
          pyCount++;
        }
      }

      for (const pm of data.payments || []) {
        const payKey = pm?.paymentId || pm?.id;
        if (payKey) {
          await client.query(
            'INSERT INTO payments (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
            [payKey, JSON.stringify(pm)]
          );
          pmCount++;
        }
      }

      const profiles = data.hostPayoutProfiles || {};
      for (const [hostId, profile] of Object.entries(profiles)) {
        const profileKey = String(profile?.hostId || hostId || '').trim();
        if (profileKey && profile && typeof profile === 'object') {
          await client.query(
            'INSERT INTO host_payout_profiles (host_id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (host_id) DO UPDATE SET data = $2, updated_at = NOW()',
            [profileKey, JSON.stringify(profile)]
          );
          pfCount++;
        }
      }

      return {
        events: evCount,
        tickets: tkCount,
        accounts: acCount,
        payouts: pyCount,
        payments: pmCount,
        hostPayoutProfiles: pfCount,
      };
    } finally {
      client.release();
    }
  }

  static async clearDatabase(): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    const client = await this.pool.connect();
    try {
      await client.query('TRUNCATE TABLE events, tickets, accounts, payouts, payments, host_payout_profiles');
    } finally {
      client.release();
    }
  }

  static async getEvents(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM events ORDER BY updated_at DESC');
      return res.rows.map((r) => r.data);
    } catch {
      return [];
    }
  }

  static async getTickets(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM tickets ORDER BY updated_at DESC');
      return res.rows.map((r) => r.data);
    } catch {
      return [];
    }
  }

  static async getAccounts(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM accounts');
      return res.rows.map((r) => r.data);
    } catch {
      return [];
    }
  }

  static async getPayouts(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM payouts ORDER BY updated_at DESC');
      return res.rows.map((r) => r.data);
    } catch {
      return [];
    }
  }

  static async getPayments(): Promise<any[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT data FROM payments ORDER BY updated_at DESC');
      return res.rows.map((r) => r.data);
    } catch {
      return [];
    }
  }

  static async getPayoutProfiles(): Promise<Record<string, any>> {
    if (!this.pool || !this.isConnected) return {};
    try {
      const res = await this.pool.query('SELECT host_id, data FROM host_payout_profiles');
      const map: Record<string, any> = {};
      for (const row of res.rows) {
        if (row.host_id && row.data) {
          map[row.host_id] = row.data;
        }
      }
      return map;
    } catch {
      return {};
    }
  }

  static async hydrateAll(): Promise<PostgresHydrationPayload | null> {
    if (!this.pool || !this.isConnected) return null;
    try {
      const [events, tickets, accounts, payouts, payments, hostPayoutProfiles] = await Promise.all([
        this.getEvents(),
        this.getTickets(),
        this.getAccounts(),
        this.getPayouts(),
        this.getPayments(),
        this.getPayoutProfiles(),
      ]);
      return { events, tickets, accounts, payouts, payments, hostPayoutProfiles };
    } catch (e: any) {
      console.warn('Postgres hydrateAll error:', e?.message || e);
      return null;
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
    const payoutKey = payout?.payoutId || payout?.id;
    if (!this.pool || !this.isConnected || !payoutKey) return;
    try {
      await this.pool.query(
        'INSERT INTO payouts (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
        [payoutKey, JSON.stringify(payout)]
      );
    } catch (e: any) {
      console.warn('Postgres insertPayout error:', e.message);
    }
  }

  static async upsertPayment(payment: any): Promise<void> {
    const paymentKey = payment?.paymentId || payment?.id;
    if (!this.pool || !this.isConnected || !paymentKey) return;
    try {
      await this.pool.query(
        'INSERT INTO payments (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
        [paymentKey, JSON.stringify(payment)]
      );
    } catch (e: any) {
      console.warn('Postgres upsertPayment error:', e.message);
    }
  }

  static async upsertPayoutProfile(profile: any): Promise<void> {
    const hostId = String(profile?.hostId || '').trim();
    if (!this.pool || !this.isConnected || !hostId) return;
    try {
      await this.pool.query(
        'INSERT INTO host_payout_profiles (host_id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (host_id) DO UPDATE SET data = $2, updated_at = NOW()',
        [hostId, JSON.stringify(profile)]
      );
    } catch (e: any) {
      console.warn('Postgres upsertPayoutProfile error:', e.message);
    }
  }
}
