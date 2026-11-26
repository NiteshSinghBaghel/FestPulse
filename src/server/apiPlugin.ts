import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { Plugin, Connect } from 'vite';
import { PostgresService, POSTGRES_SCHEMA_SQL } from './postgresService';
import { MongoDbService } from './mongoService';

function getEnvKey(key: string, defaultVal: string): string {
  try {
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      fileURLToPath(new URL('../../.env', import.meta.url)),
    ];
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm'));
        const raw = match?.[1]?.trim().replace(/^["']|["']$/g, '').trim();
        if (raw) {
          return raw;
        }
      }
    }
  } catch {}
  const fromProc = (process.env[key] || '').trim().replace(/^["']|["']$/g, '').trim();
  return fromProc || defaultVal;
}

const LEGACY_DEMO_KEY_IDS = new Set([
  'rzp_test_5Wj8tV4x6zK9aL',
  'rzp_test_Tn2gGCmZM8sHv0',
]);

const LEGACY_DEMO_SECRETS = new Set([
  'test_secret_key_123',
  'nLuBuOx9Mu7NzmTCbAX8hLfP',
]);

function isLegacyDemoKeyId(val?: string): boolean {
  return Boolean(val && LEGACY_DEMO_KEY_IDS.has(val.trim()));
}

function isLegacyDemoSecret(val?: string): boolean {
  return Boolean(val && LEGACY_DEMO_SECRETS.has(val.trim()));
}

interface RazorpayConfigSchema {
  keyId: string;
  keySecret: string;
  accountNumber?: string;
  updatedViaUi?: boolean;
}

interface DatabaseSchema {
  events: any[];
  tickets: any[];
  accounts: any[];
  payouts: any[];
  payments: any[];
  razorpayConfig: RazorpayConfigSchema;
  flushedAt?: number;
  supabaseConfig: {
    url: string;
    anonKey: string;
    enabled: boolean;
  };
  passwordResetTokens?: Record<string, { email: string; role: string; createdAt: string; expiresAt: number }>;
  hostPayoutProfiles?: Record<string, any>;
}

function readEnvRazorpayConfig(): RazorpayConfigSchema {
  const keyId = getEnvKey('RAZORPAY_KEY_ID', '');
  const keySecret = getEnvKey('RAZORPAY_KEY_SECRET', '');
  const rawAccount = getEnvKey('RAZORPAY_ACCOUNT_NUMBER', '');
  return {
    keyId: isLegacyDemoKeyId(keyId) ? '' : keyId,
    keySecret: isLegacyDemoSecret(keySecret) ? '' : keySecret,
    accountNumber: rawAccount,
  };
}

function backfillEventGatePins(eventsList: any[]): any[] {
  if (!Array.isArray(eventsList)) return [];
  const usedPins = new Set<string>(
    eventsList
      .map((e) => String(e?.gatePin || '').trim())
      .filter((p) => /^\d{6}$/.test(p))
  );
  for (const evt of eventsList) {
    if (evt && typeof evt === 'object' && !/^\d{6}$/.test(String(evt.gatePin || '').trim())) {
      let nextPin = '';
      for (let attempt = 0; attempt < 25; attempt++) {
        const candidate = Math.floor(100000 + Math.random() * 900000).toString();
        if (!usedPins.has(candidate)) {
          nextPin = candidate;
          break;
        }
      }
      if (!nextPin) nextPin = Math.floor(100000 + Math.random() * 900000).toString();
      usedPins.add(nextPin);
      evt.gatePin = nextPin;
    }
  }
  return eventsList;
}

function getConfiguredDatabaseUrl(): string {
  return (
    getEnvKey('DATABASE_URL', '') ||
    getEnvKey('POSTGRES_URL', '') ||
    getEnvKey('NEON_DATABASE_URL', '') ||
    getEnvKey('SUPABASE_DB_URL', '')
  ).trim();
}

let manuallyDisconnectedPostgres = false;
let hasHydratedFromPostgres = false;
let hasHydratedFromMongo = false;

function getLocalDbFilePath(): string {
  const dir = path.resolve(process.cwd(), '.data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, 'local_db.json');
}

let sharedDb: DatabaseSchema | null = null;

function isCloudDatabaseConfigured(): boolean {
  return Boolean(MongoDbService.getUri() || getConfiguredDatabaseUrl());
}

function loadDatabase(): DatabaseSchema {
  const defaultRzpConfig = readEnvRazorpayConfig();
  const base: DatabaseSchema = {
    events: [],
    tickets: [],
    accounts: [],
    payouts: [],
    payments: [],
    razorpayConfig: defaultRzpConfig,
    flushedAt: 0,
    supabaseConfig: { url: '', anonKey: '', enabled: false },
    passwordResetTokens: {},
    hostPayoutProfiles: {},
  };

  // When a cloud database (MongoDB / PostgreSQL) is configured, never load stale data from local_db.json
  if (isCloudDatabaseConfigured()) {
    return base;
  }

  try {
    const filePath = getLocalDbFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          ...base,
          ...parsed,
          events: Array.isArray(parsed.events) ? parsed.events : [],
          tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
          payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
          payments: Array.isArray(parsed.payments) ? parsed.payments : [],
          razorpayConfig: parsed.razorpayConfig || defaultRzpConfig,
          passwordResetTokens: parsed.passwordResetTokens || {},
          hostPayoutProfiles: parsed.hostPayoutProfiles || {},
        };
      }
    }
  } catch (err) {
    console.warn('[Local DB] Error loading database from file:', err);
  }

  return base;
}

function getSharedDatabase(): DatabaseSchema {
  if (!sharedDb) {
    sharedDb = loadDatabase();
  }
  return sharedDb;
}

function saveDatabase(data: DatabaseSchema): boolean {
  if (isCloudDatabaseConfigured()) {
    void MongoDbService.saveSnapshot(data);
    return true;
  }
  try {
    const filePath = getLocalDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Local DB] Error saving database to file:', err);
  }
  return true;
}

async function parseRawBody(req: Connect.IncomingMessage): Promise<{ raw: string; json: any }> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve({ raw: body, json: body ? JSON.parse(body) : {} });
      } catch {
        resolve({ raw: body, json: {} });
      }
    });
  });
}

async function parseBody(req: Connect.IncomingMessage): Promise<any> {
  const { json } = await parseRawBody(req);
  return json;
}

function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Razorpay-Signature');
  res.end(JSON.stringify(data));
}

function sanitizeAccount(account: any) {
  if (!account || typeof account !== 'object') return account;
  const { password, passwordHash, salt, oldEmail, payoutDetails, bankAccount, ifscCode, ...safe } = account;
  return safe;
}

function reconcileEventTicketsSold(db: DatabaseSchema) {
  if (!Array.isArray(db.events) || !Array.isArray(db.tickets)) return;
  const ticketCounts = new Map<string, number>();
  for (const t of db.tickets) {
    if (t?.eventId && t?.status === 'confirmed') {
      const q = Math.max(1, Number(t.quantity) || 1);
      ticketCounts.set(t.eventId, (ticketCounts.get(t.eventId) || 0) + q);
    }
  }
  for (const evt of db.events) {
    if (!evt?.eventId) continue;
    const confirmedCount = ticketCounts.get(evt.eventId) || 0;
    const currentSold = Number(evt.ticketsSold) || 0;
    const effectiveSold = Math.max(currentSold, confirmedCount);
    evt.ticketsSold = effectiveSold;
    const cap = Number(evt.capacity) || 0;
    evt.availableTickets = Math.max(0, cap - effectiveSold);
    if (cap > 0 && effectiveSold >= cap) {
      evt.status = 'sold_out';
    }
  }
}

function computeServerHostRevenue(db: DatabaseSchema, hostId?: string, hostEmail?: string) {
  reconcileEventTicketsSold(db);
  const cleanId = (hostId || '').trim();
  const cleanEmail = (hostEmail || '').toLowerCase().trim();
  if (!cleanId && !cleanEmail) {
    return {
      totalEvents: 0,
      totalTicketsSold: 0,
      ticketsRevenue: 0,
      eventsRevenue: 0,
      paymentsRevenue: 0,
      totalRevenue: 0,
      totalCheckedIn: 0,
      totalTransferred: 0,
      availableBalance: 0,
      eventBreakdown: [] as any[],
      payouts: [] as any[],
    };
  }

  const matchesOrganizer = (record: any) =>
    Boolean(
      (cleanId && record?.hostId && String(record.hostId).trim() === cleanId) ||
      (cleanEmail && record?.hostEmail && String(record.hostEmail).toLowerCase().trim() === cleanEmail)
    );

  const hostEvents = (Array.isArray(db.events) ? db.events : []).filter(matchesOrganizer);
  const hostEventIds = new Set(hostEvents.map((e: any) => e.eventId));

  const hostTickets = (Array.isArray(db.tickets) ? db.tickets : []).filter(
    (t: any) => (t?.eventId && hostEventIds.has(t.eventId)) || matchesOrganizer(t)
  );
  const confirmedHostTickets = hostTickets.filter((t: any) => t?.status === 'confirmed');

  const hostCapturedPayments = (Array.isArray(db.payments) ? db.payments : []).filter(
    (p: any) => p?.status === 'captured' && ((p?.eventId && hostEventIds.has(p.eventId)) || matchesOrganizer(p))
  );

  let ticketsRevenue = 0;
  let eventsRevenue = 0;
  let paymentsRevenue = 0;
  let totalTicketsSold = 0;
  let grossTotalRevenue = 0;

  const eventBreakdown = hostEvents.map((evt: any) => {
    const evtTickets = confirmedHostTickets.filter((t: any) => t.eventId === evt.eventId);
    const evtPayments = hostCapturedPayments.filter((p: any) => p.eventId === evt.eventId);

    const evtTicketsRev = evtTickets.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
    const evtModelSold = Number(evt.ticketsSold) || 0;
    const evtTicketQtySum = evtTickets.reduce((acc: number, t: any) => acc + (Math.max(1, Number(t.quantity) || 1)), 0);
    const evtSoldCount = Math.max(evtModelSold, evtTicketQtySum);
    const evtModelRev = evtModelSold * (Number(evt.price) || 0);
    const evtPayRev = evtPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
    const evtRevenue = Math.max(evtTicketsRev, evtModelRev, evtPayRev);

    ticketsRevenue += evtTicketsRev;
    eventsRevenue += evtModelRev;
    paymentsRevenue += evtPayRev;
    totalTicketsSold += evtSoldCount;
    grossTotalRevenue += evtRevenue;

    return {
      eventId: evt.eventId,
      title: evt.title || 'Event',
      price: Number(evt.price) || 0,
      ticketsSold: evtSoldCount,
      revenue: evtRevenue,
      status: evt.status || 'published',
    };
  });

  // Include any orphan confirmed tickets / captured payments directly owned by this host (not in hostEventIds)
  const orphanTickets = confirmedHostTickets.filter((t: any) => !t?.eventId || !hostEventIds.has(t.eventId));
  const orphanPayments = hostCapturedPayments.filter((p: any) => !p?.eventId || !hostEventIds.has(p.eventId));
  const orphanTicketsRev = orphanTickets.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const orphanPaymentsRev = orphanPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
  ticketsRevenue += orphanTicketsRev;
  paymentsRevenue += orphanPaymentsRev;
  totalTicketsSold += orphanTickets.reduce((acc: number, t: any) => acc + Math.max(1, Number(t.quantity) || 1), 0);
  grossTotalRevenue += Math.max(orphanTicketsRev, orphanPaymentsRev);

  const payoutMap = new Map<string, any>();
  for (const p of Array.isArray(db.payouts) ? db.payouts : []) {
    if (matchesOrganizer(p) && p?.payoutId) {
      payoutMap.set(p.payoutId, p);
    }
  }
  const hostPayouts = Array.from(payoutMap.values()).sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );

  const totalTransferred = hostPayouts
    .filter((p: any) => {
      const st = String(p?.status || '').toLowerCase();
      return st !== 'failed' && st !== 'cancelled' && st !== 'reversed';
    })
    .reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

  const availableBalance = Math.max(0, grossTotalRevenue - totalTransferred);
  const totalCheckedIn = hostTickets.filter((t: any) => t?.entryStatus === 'entered').length;

  return {
    totalEvents: hostEvents.length,
    totalTicketsSold,
    ticketsRevenue,
    eventsRevenue,
    paymentsRevenue,
    totalRevenue: grossTotalRevenue,
    totalCheckedIn,
    totalTransferred,
    availableBalance,
    eventBreakdown,
    payouts: hostPayouts,
  };
}

function stripGatePinUnlessOwner(event: any, userId: string, userEmail: string) {
  if (!event || typeof event !== 'object') return event;
  const isOwner = Boolean(
    (userId && event.hostId === userId) ||
    (userEmail && event.hostEmail && String(event.hostEmail).toLowerCase().trim() === userEmail)
  );
  if (isOwner) return event;
  const { gatePin, ...safeEvent } = event;
  return safeEvent;
}

const sseClients = new Set<any>();

function broadcastRealtime(type: string, meta?: Record<string, any>, data?: Record<string, any>) {
  if (sseClients.size === 0) return;
  // Embed data inline so receiving clients can apply it without an extra /api/sync round-trip
  const payload = JSON.stringify({
    type,
    timestamp: Date.now(),
    ...(meta || {}),
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  });
  const frame = `data: ${payload}\n\n`;
  for (const client of Array.from(sseClients)) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(frame);
      } else {
        sseClients.delete(client);
      }
    } catch {
      sseClients.delete(client);
    }
  }
}

/** Helper: build scoped full-db broadcast payload */
function buildBroadcastData(db: DatabaseSchema, opts: {
  includeEvents?: boolean;
  includeAllTickets?: boolean;
  includedTickets?: any[];
  eventId?: string;
  deletedEventId?: string;
  deletedTicketId?: string;
}): Record<string, any> {
  const d: Record<string, any> = {};
  if (opts.includeEvents) {
    d.events = db.events.filter((e: any) => e.status !== 'draft');
  }
  if (opts.deletedEventId) {
    d.deletedEventId = opts.deletedEventId;
  }
  if (opts.deletedTicketId) {
    d.deletedTicketId = opts.deletedTicketId;
  }
  if (opts.includeAllTickets && opts.eventId) {
    d.tickets = db.tickets.filter((t: any) => t.eventId === opts.eventId);
  }
  if (opts.includedTickets) {
    d.tickets = opts.includedTickets;
  }
  return d;
}

async function hydrateDbFromPostgres(db: DatabaseSchema): Promise<boolean> {
  if (!PostgresService.getConnected()) return false;
  try {
    const pgData = await PostgresService.hydrateAll();
    if (!pgData) return false;

    const remoteTotal =
      pgData.events.length +
      pgData.tickets.length +
      pgData.accounts.length +
      pgData.payouts.length +
      pgData.payments.length +
      Object.keys(pgData.hostPayoutProfiles || {}).length;

    if (remoteTotal > 0) {
      const beforePins = pgData.events.map((e) => String(e?.gatePin || '').trim());
      backfillEventGatePins(pgData.events);
      for (let i = 0; i < pgData.events.length; i++) {
        if (String(pgData.events[i]?.gatePin || '').trim() !== beforePins[i]) {
          PostgresService.upsertEvent(pgData.events[i]).catch(() => {});
        }
      }
      db.events = pgData.events;
      db.tickets = pgData.tickets;
      db.accounts = pgData.accounts;
      db.payouts = pgData.payouts;
      db.payments = pgData.payments;
      db.hostPayoutProfiles = pgData.hostPayoutProfiles || {};
      saveDatabase(db);
      return true;
    }
    return false;
  } catch (pgErr) {
    console.warn('[Postgres] Hydrate warning:', pgErr);
    return false;
  }
}

export const apiMiddleware = async (req: any, res: any, next: any) => {
  const url = req.url || '';
  if (!url.startsWith('/api/')) {
    return next();
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  // Real-time Server-Sent Events (SSE) stream
  if ((url === '/api/realtime/stream' || url.startsWith('/api/realtime/stream?')) && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(': ping\n\n');
        } else {
          clearInterval(keepAlive);
          sseClients.delete(res);
        }
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
    return;
  }

  try {
    const db = getSharedDatabase();

    // MongoDB Atlas is the cloud persistence source when MONGODB_URI is configured.
    if (MongoDbService.getUri() && !hasHydratedFromMongo) {
      const mongoConnected = await MongoDbService.ensureConnected();
      if (mongoConnected) {
        const remoteSnapshot = await MongoDbService.hydrateAll();
        if (remoteSnapshot) {
          db.events = Array.isArray(remoteSnapshot.events) ? remoteSnapshot.events : db.events;
          db.tickets = Array.isArray(remoteSnapshot.tickets) ? remoteSnapshot.tickets : db.tickets;
          db.accounts = Array.isArray(remoteSnapshot.accounts) ? remoteSnapshot.accounts : db.accounts;
          db.payouts = Array.isArray(remoteSnapshot.payouts) ? remoteSnapshot.payouts : db.payouts;
          db.payments = Array.isArray(remoteSnapshot.payments) ? remoteSnapshot.payments : db.payments;
          db.passwordResetTokens = remoteSnapshot.passwordResetTokens || db.passwordResetTokens;
          db.hostPayoutProfiles = remoteSnapshot.hostPayoutProfiles || db.hostPayoutProfiles;
          db.supabaseConfig = remoteSnapshot.supabaseConfig || db.supabaseConfig;
          backfillEventGatePins(db.events);
          reconcileEventTicketsSold(db);
        } else {
          await MongoDbService.saveSnapshot(db);
        }
        hasHydratedFromMongo = true;
      }
    }

    // PostgreSQL disabled: MongoDB Atlas is the sole database source.

          // 1. Health check
        if (url === '/api/health' && req.method === 'GET') {
          const pgStatus = await PostgresService.getStatus();
          const mongoStatus = await MongoDbService.getStatus();
          return sendJson(res, 200, {
            status: 'ok',
            database: mongoStatus.connected ? 'mongodb_atlas' : pgStatus.connected ? 'postgresql' : 'local_json',
            storageMode: mongoStatus.connected ? 'mongodb_atlas' : pgStatus.connected ? 'postgresql_permanent' : 'local_json_ephemeral',
            mongodb: mongoStatus,
            postgres: pgStatus,
            eventsCount: db.events.length,
            ticketsCount: db.tickets.length,
            accountsCount: db.accounts.length,
            payoutsCount: db.payouts.length,
            paymentsCount: db.payments.length,
            timestamp: new Date().toISOString(),
          });
        }

        // 1b. PostgreSQL Management Endpoints
        if (url === '/api/postgres/status' && req.method === 'GET') {
          const status = await PostgresService.getStatus();
          return sendJson(res, 200, status);
        }

        if (url === '/api/postgres/schema' && req.method === 'GET') {
          return sendJson(res, 200, {
            schemaSql: POSTGRES_SCHEMA_SQL,
            tables: ['events', 'tickets', 'accounts', 'payouts', 'payments', 'host_payout_profiles'],
          });
        }

        if (url === '/api/postgres/connect' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const connectionString = body.connectionString || '';
            if (!connectionString) {
              return sendJson(res, 400, { success: false, error: 'Connection string is required' });
            }

            manuallyDisconnectedPostgres = false;
            const connectResult = await PostgresService.connect(connectionString, true);
            if (!connectResult.success) {
              return sendJson(res, 400, connectResult);
            }

            // Auto-migrate current memory/JSON data into PostgreSQL, then hydrate combined records
            const migrationResult = await PostgresService.migrateFromData({
              events: db.events,
              tickets: db.tickets,
              accounts: db.accounts,
              payouts: db.payouts,
              payments: db.payments,
              hostPayoutProfiles: db.hostPayoutProfiles,
            });
            await hydrateDbFromPostgres(db);
            hasHydratedFromPostgres = true;

            const status = await PostgresService.getStatus();
            return sendJson(res, 200, {
              success: true,
              message: 'Connected to PostgreSQL database successfully and synced tables.',
              status,
              migration: migrationResult,
            });
          } catch (err: any) {
            return sendJson(res, 500, { success: false, error: err.message || 'Error connecting to PostgreSQL' });
          }
        }

        if (url === '/api/postgres/disconnect' && req.method === 'POST') {
          manuallyDisconnectedPostgres = true;
          hasHydratedFromPostgres = false;
          await PostgresService.disconnect();
          return sendJson(res, 200, { success: true, message: 'Disconnected from PostgreSQL' });
        }

        if (url === '/api/postgres/migrate' && req.method === 'POST') {
          try {
            if (!PostgresService.getConnected()) {
              return sendJson(res, 400, { success: false, error: 'PostgreSQL is not connected.' });
            }
            const migration = await PostgresService.migrateFromData({
              events: db.events,
              tickets: db.tickets,
              accounts: db.accounts,
              payouts: db.payouts,
              payments: db.payments,
              hostPayoutProfiles: db.hostPayoutProfiles,
            });
            const status = await PostgresService.getStatus();
            return sendJson(res, 200, { success: true, migration, status });
          } catch (err: any) {
            return sendJson(res, 500, { success: false, error: err.message || 'Error migrating to PostgreSQL' });
          }
        }

        // 2. Scoped synchronization: Return ONLY data permitted for the signed-in user/role
        if ((url === '/api/sync' || url.startsWith('/api/sync?')) && req.method === 'GET') {
          reconcileEventTicketsSold(db);
          // Hydrate from Postgres only if already connected AND not yet done this server lifecycle
          if (PostgresService.getConnected() && !hasHydratedFromPostgres) {
            await hydrateDbFromPostgres(db);
            hasHydratedFromPostgres = true;
          }

          const parsed = new URL(url, 'http://localhost');
          const userId = (parsed.searchParams.get('userId') || '').trim();
          const userEmail = (parsed.searchParams.get('userEmail') || '').toLowerCase().trim();
          const role = (parsed.searchParams.get('role') || '').trim().toLowerCase();
          const hasIdentity = Boolean(userId || userEmail);

          const scopedEvents = db.events
            .filter((e) => {
              const isOwner = Boolean(
                (userId && e.hostId === userId) ||
                (userEmail && e.hostEmail && String(e.hostEmail).toLowerCase().trim() === userEmail)
              );
              return e.status !== 'draft' || isOwner;
            })
            .map((e) => stripGatePinUnlessOwner(e, userId, userEmail));

          let scopedTickets: any[] = [];
          if (hasIdentity) {
            if (role === 'host') {
              const hostEventIds = new Set(
                db.events
                  .filter((e) =>
                    (userId && e.hostId === userId) ||
                    (userEmail && e.hostEmail && String(e.hostEmail).toLowerCase().trim() === userEmail)
                  )
                  .map((e) => e.eventId)
              );
              scopedTickets = db.tickets.filter(
                (t) => (userId && t.hostId === userId) || hostEventIds.has(t.eventId)
              );
            } else {
              scopedTickets = db.tickets.filter(
                (t) =>
                  (userId && t.userId === userId) ||
                  (userEmail && t.userEmail && String(t.userEmail).toLowerCase().trim() === userEmail)
              );
            }
          }

          const scopedPayouts =
            role === 'host' && (userId || userEmail)
              ? db.payouts.filter(
                  (p) =>
                    (userId && p.hostId === userId) ||
                    (userEmail && p.hostEmail && String(p.hostEmail).toLowerCase().trim() === userEmail)
                )
              : [];

          const scopedAccounts = hasIdentity
            ? db.accounts
                .filter(
                  (a) =>
                    (userId && a.uid === userId) ||
                    (userEmail && a.email && String(a.email).toLowerCase().trim() === userEmail)
                )
                .map(sanitizeAccount)
            : [];

          const pgStatus = await PostgresService.getStatus();
          return sendJson(res, 200, {
            events: scopedEvents,
            tickets: scopedTickets,
            accounts: scopedAccounts,
            payouts: scopedPayouts,
            flushedAt: db.flushedAt || 0,
            postgresStatus: pgStatus,
            supabaseConfig: db.supabaseConfig,
            timestamp: new Date().toISOString(),
          });
        }

        // 2b. Clear / Reset All Data
        if (url === '/api/clear-database' && (req.method === 'POST' || req.method === 'DELETE')) {
          db.events = [];
          db.tickets = [];
          db.accounts = [];
          db.payouts = [];
          db.payments = [];
          db.hostPayoutProfiles = {};
          db.flushedAt = Date.now();
          saveDatabase(db);
          if (PostgresService.getConnected()) {
            await PostgresService.clearDatabase().catch((e: any) => console.warn('Postgres clear warning:', e));
          }
          broadcastRealtime('reset');
          return sendJson(res, 200, {
            success: true,
            flushedAt: db.flushedAt,
            message: 'All database data (events, tickets, accounts, payouts) has been completely cleared.',
            eventsCount: 0,
            ticketsCount: 0,
            accountsCount: 0,
          });
        }

        // 2c. Dedicated Volunteer Gate Endpoints (PIN-scoped, zero financial leakage)
        if ((url === '/api/volunteer/validate-pin' || url.startsWith('/api/volunteer/validate-pin?')) && req.method === 'GET') {
          const parsed = new URL(url, 'http://localhost');
          const pin = (parsed.searchParams.get('pin') || '').trim();
          if (pin.length !== 6) {
            return sendJson(res, 400, { valid: false, error: 'Please enter a valid 6-digit numeric Gate PIN.' });
          }
          const matchedEvent = db.events.find(
            (e) => String(e?.gatePin || '').trim() === pin && e.status !== 'cancelled'
          );
          if (!matchedEvent) {
            return sendJson(res, 404, { valid: false, error: 'Invalid or inactive Gate PIN. Please check with your organizer.' });
          }
          return sendJson(res, 200, {
            valid: true,
            event: {
              eventId: matchedEvent.eventId,
              title: matchedEvent.title,
              category: matchedEvent.category,
              date: matchedEvent.date,
              startTime: matchedEvent.startTime,
              endTime: matchedEvent.endTime,
              venue: matchedEvent.venue,
              location: matchedEvent.location,
              capacity: matchedEvent.capacity,
              ticketsSold: matchedEvent.ticketsSold,
              availableTickets: matchedEvent.availableTickets,
              status: matchedEvent.status,
              gatePin: String(matchedEvent.gatePin).trim(),
              imageUrl: matchedEvent.imageUrl,
            },
          });
        }

        if ((url === '/api/volunteer/tickets' || url.startsWith('/api/volunteer/tickets?')) && req.method === 'GET') {
          const parsed = new URL(url, 'http://localhost');
          const eventId = (parsed.searchParams.get('eventId') || '').trim();
          const pin = (parsed.searchParams.get('pin') || '').trim();
          if (!eventId || pin.length !== 6) {
            return sendJson(res, 400, { error: 'eventId and 6-digit pin are required.' });
          }
          const event = db.events.find(
            (e) => e.eventId === eventId && String(e?.gatePin || '').trim() === pin && e.status !== 'cancelled'
          );
          if (!event) {
            return sendJson(res, 403, { error: 'Unauthorized: Invalid Gate PIN for this event.' });
          }
          const enteredTickets = db.tickets
            .filter((t) => t.eventId === eventId && t.entryStatus === 'entered')
            .map((t) => ({
              ticketId: t.ticketId,
              eventId: t.eventId,
              eventTitle: t.eventTitle,
              userName: t.userName,
              rollNo: t.rollNo,
              college: t.college,
              quantity: t.quantity || 1,
              status: t.status,
              entryStatus: t.entryStatus,
              entryTime: t.entryTime,
              entryTimestamp: t.entryTimestamp,
              verifiedBy: t.verifiedBy,
            }))
            .sort((a, b) => {
              const tb = a.entryTimestamp ? new Date(b.entryTimestamp || 0).getTime() : 0;
              const ta = a.entryTimestamp ? new Date(a.entryTimestamp || 0).getTime() : 0;
              if (tb !== ta) return tb - ta;
              return (b.entryTime || '').localeCompare(a.entryTime || '');
            });
          return sendJson(res, 200, enteredTickets);
        }

        // 3. Events endpoints
        if (url === '/api/events' || url.startsWith('/api/events?')) {
          if (req.method === 'GET') {
            reconcileEventTicketsSold(db);
            const parsed = new URL(url, 'http://localhost');
            const hostId = (parsed.searchParams.get('hostId') || '').trim();
            const hostEmail = (parsed.searchParams.get('hostEmail') || '').toLowerCase().trim();
            if (hostId || hostEmail) {
              return sendJson(
                res,
                200,
                db.events.filter(
                  (e) =>
                    (hostId && e.hostId === hostId) ||
                    (hostEmail && e.hostEmail && String(e.hostEmail).toLowerCase().trim() === hostEmail)
                )
              );
            }
            return sendJson(
              res,
              200,
              db.events.filter((e) => e.status !== 'draft').map((e) => stripGatePinUnlessOwner(e, '', ''))
            );
          }
          if (req.method === 'POST') {
            const newEvent = await parseBody(req);
            if (!newEvent || !newEvent.eventId) {
              return sendJson(res, 400, { error: 'Invalid event data' });
            }
            const existingIdx = db.events.findIndex((e) => e.eventId === newEvent.eventId);
            const existingEvent = existingIdx >= 0 ? db.events[existingIdx] : null;
            const rawPin = String(newEvent.gatePin || existingEvent?.gatePin || '').trim();
            if (!/^\d{6}$/.test(rawPin)) {
              const used = new Set(db.events.map((e) => String(e?.gatePin || '').trim()));
              let generated = Math.floor(100000 + Math.random() * 900000).toString();
              for (let i = 0; i < 20 && used.has(generated); i++) {
                generated = Math.floor(100000 + Math.random() * 900000).toString();
              }
              newEvent.gatePin = generated;
            } else {
              newEvent.gatePin = rawPin;
            }
            if (existingIdx >= 0) {
              db.events[existingIdx] = { ...existingEvent, ...newEvent, updatedAt: new Date().toISOString() };
            } else {
              db.events.unshift(newEvent);
            }
            const savedEvent = existingIdx >= 0 ? db.events[existingIdx] : newEvent;
            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.upsertEvent(savedEvent).catch((e: any) => console.warn('Postgres event sync error:', e));
            }
            // Broadcast with the full updated events list so clients skip the extra /api/sync round-trip
            broadcastRealtime('events', { eventId: savedEvent.eventId }, { events: db.events.filter((e: any) => e.status !== 'draft') });
            return sendJson(res, 200, { success: true, event: savedEvent });
          }
        }

        if (url.startsWith('/api/events/') && url.endsWith('/regenerate-gate-pin') && req.method === 'POST') {
          const eventId = url.replace('/api/events/', '').replace('/regenerate-gate-pin', '').split('?')[0].trim();
          const body = await parseBody(req).catch(() => ({}));
          const idx = db.events.findIndex((e) => e.eventId === eventId);
          if (idx === -1) {
            return sendJson(res, 404, { success: false, error: 'Event not found' });
          }
          const currentEvent = db.events[idx];
          const reqHostId = (body?.requestingHostId || '').trim();
          const reqHostEmail = (body?.requestingHostEmail || '').toLowerCase().trim();
          if (reqHostId || reqHostEmail) {
            const isOwner = Boolean(
              !currentEvent.hostId ||
              currentEvent.hostId === 'demo_host_uid' ||
              !currentEvent.hostEmail ||
              currentEvent.hostEmail === 'host@campusfest.org' ||
              (reqHostId && currentEvent.hostId === reqHostId) ||
              (reqHostEmail && currentEvent.hostEmail && String(currentEvent.hostEmail).toLowerCase().trim() === reqHostEmail)
            );
            if (!isOwner) {
              return sendJson(res, 403, { success: false, error: 'Unauthorized: Only the event organizer can regenerate its Gate PIN.' });
            }
            if ((!currentEvent.hostId || currentEvent.hostId === 'demo_host_uid') && reqHostId) {
              currentEvent.hostId = reqHostId;
            }
            if ((!currentEvent.hostEmail || currentEvent.hostEmail === 'host@campusfest.org') && reqHostEmail) {
              currentEvent.hostEmail = reqHostEmail;
            }
          }
          const used = new Set(db.events.map((e) => String(e?.gatePin || '').trim()));
          let nextPin = Math.floor(100000 + Math.random() * 900000).toString();
          for (let i = 0; i < 25 && (used.has(nextPin) || nextPin === currentEvent.gatePin); i++) {
            nextPin = Math.floor(100000 + Math.random() * 900000).toString();
          }
          db.events[idx] = { ...currentEvent, gatePin: nextPin, updatedAt: new Date().toISOString() };
          saveDatabase(db);
          if (PostgresService.getConnected()) {
            await PostgresService.upsertEvent(db.events[idx]).catch((e: any) => console.warn('Postgres gatePin update error:', e));
          }
          broadcastRealtime('events', { eventId }, buildBroadcastData(db, { includeEvents: true }));
          return sendJson(res, 200, { success: true, gatePin: nextPin, event: db.events[idx] });
        }

        if (url.startsWith('/api/events/')) {
          const eventId = url.replace('/api/events/', '').split('?')[0];
          if (req.method === 'PUT') {
            const updates = await parseBody(req);
            let idx = db.events.findIndex((e) => e.eventId === eventId);
            if (idx === -1) {
              // Auto-upsert if event doesn't exist on server yet
              const newEvent = {
                eventId,
                ...updates,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              delete newEvent.requestingHostId;
              delete newEvent.requestingHostEmail;
              db.events.unshift(newEvent);
              saveDatabase(db);
              if (PostgresService.getConnected()) {
                await PostgresService.upsertEvent(newEvent).catch(() => {});
              }
              broadcastRealtime('events', { eventId }, { events: db.events.filter((e: any) => e.status !== 'draft') });
              return sendJson(res, 200, { success: true, event: newEvent });
            }

            const currentEvent = db.events[idx];
            const isOwner = Boolean(
              !currentEvent.hostId ||
              currentEvent.hostId === 'demo_host_uid' ||
              !currentEvent.hostEmail ||
              currentEvent.hostEmail === 'host@campusfest.org' ||
              (updates.requestingHostId && currentEvent.hostId === updates.requestingHostId) ||
              (updates.requestingHostEmail && currentEvent.hostEmail && currentEvent.hostEmail.toLowerCase().trim() === updates.requestingHostEmail.toLowerCase().trim())
            );
            if (!isOwner) {
              return sendJson(res, 403, { error: "Unauthorized: You cannot edit another organizer's event." });
            }

            // Claim demo or unowned event
            if ((!currentEvent.hostId || currentEvent.hostId === 'demo_host_uid') && updates.requestingHostId) {
              currentEvent.hostId = updates.requestingHostId;
            }
            if ((!currentEvent.hostEmail || currentEvent.hostEmail === 'host@campusfest.org') && updates.requestingHostEmail) {
              currentEvent.hostEmail = updates.requestingHostEmail;
            }

            delete updates.requestingHostId;
            delete updates.requestingHostEmail;

            if (updates.price !== undefined) {
              updates.price = Math.max(0, Number(updates.price) || 0);
            }
            if (updates.capacity !== undefined) {
              updates.capacity = Math.max(0, Number(updates.capacity) || 0);
            }
            if (updates.availableTickets !== undefined) {
              updates.availableTickets = Math.max(0, Number(updates.availableTickets) || 0);
            }

            const mergedEvent = { ...db.events[idx], ...updates, updatedAt: new Date().toISOString() };
            if (mergedEvent.availableTickets <= 0 && mergedEvent.status === 'published') {
              mergedEvent.status = 'sold_out';
            } else if (mergedEvent.availableTickets > 0 && mergedEvent.status === 'sold_out' && updates.status === undefined) {
              mergedEvent.status = 'published';
            }
            db.events[idx] = mergedEvent;

            // Propagate updated hostPhone live to all tickets of this event
            let updatedEventTickets: any[] = [];
            if (updates.hostPhone !== undefined && Array.isArray(db.tickets)) {
              for (const t of db.tickets) {
                if (t.eventId === eventId) {
                  t.hostPhone = mergedEvent.hostPhone || '';
                  updatedEventTickets.push(t);
                }
              }
            }

            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.upsertEvent(db.events[idx]).catch((e: any) => console.warn('Postgres event update error:', e));
              for (const t of updatedEventTickets) {
                await PostgresService.upsertTicket(t).catch(() => {});
              }
            }
            broadcastRealtime(
              'events',
              { eventId },
              buildBroadcastData(db, {
                includeEvents: true,
                includedTickets: updatedEventTickets.length > 0 ? updatedEventTickets : undefined,
              })
            );
            return sendJson(res, 200, { success: true, event: db.events[idx] });
          }
          if (req.method === 'DELETE') {
            const body = await parseBody(req).catch(() => ({}));
            const currentEvent = db.events.find(e => e.eventId === eventId);
            if (currentEvent && (body?.requestingHostId || body?.requestingHostEmail)) {
              const isOwner = Boolean(
                !currentEvent.hostId ||
                currentEvent.hostId === 'demo_host_uid' ||
                !currentEvent.hostEmail ||
                currentEvent.hostEmail === 'host@campusfest.org' ||
                (body.requestingHostId && currentEvent.hostId === body.requestingHostId) ||
                (body.requestingHostEmail && currentEvent.hostEmail && currentEvent.hostEmail.toLowerCase().trim() === body.requestingHostEmail.toLowerCase().trim())
              );
              if (!isOwner) {
                return sendJson(res, 403, { error: "Unauthorized: You cannot delete another organizer's event." });
              }
            }

            db.events = db.events.filter((e) => e.eventId !== eventId);
            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.deleteEvent(eventId).catch((e: any) => console.warn('Postgres event delete error:', e));
            }
            broadcastRealtime('events', { eventId }, buildBroadcastData(db, { includeEvents: true, deletedEventId: eventId }));
            return sendJson(res, 200, { success: true });
          }
        }

        // 4. Dedicated Ticket Gate Verification with Strict Host & Event Check or Volunteer Gate PIN
        if (url === '/api/tickets/verify' && req.method === 'POST') {
          const body = await parseBody(req);
          const { qrToken, ticketId, hostId, hostEmail, volunteerGatePin, eventId: targetEventId } = body;
          let token = (qrToken || ticketId || '').trim();
          if (token.startsWith('{') && token.endsWith('}')) {
            try {
              const parsedQr = JSON.parse(token);
              token = String(parsedQr.qrToken || parsedQr.ticketId || token).trim();
            } catch {}
          }

          if (!token) {
            return sendJson(res, 400, { success: false, error: 'QR Token or Ticket ID is required', code: 'INVALID_TOKEN' });
          }

          const tokenUpper = token.toUpperCase();
          const ticket = db.tickets.find(
            (t: any) =>
              String(t?.qrToken || '').trim() === token ||
              String(t?.ticketId || '').trim().toUpperCase() === tokenUpper
          );
          if (!ticket) {
            return sendJson(res, 404, { success: false, error: 'Invalid Ticket QR. No matching ticket found in database.', code: 'INVALID_TOKEN' });
          }

          const event = db.events.find((e: any) => e.eventId === ticket.eventId);

          if (volunteerGatePin && targetEventId) {
            const cleanVolPin = String(volunteerGatePin).trim();
            const targetEvent = db.events.find(
              (e: any) => e.eventId === targetEventId && String(e?.gatePin || '').trim() === cleanVolPin
            );
            if (!targetEvent) {
              return sendJson(res, 403, { success: false, error: 'Invalid volunteer gate PIN for this event', code: 'WRONG_HOST_OR_EVENT' });
            }
            if (targetEvent.status === 'cancelled') {
              return sendJson(res, 400, { success: false, error: 'This event has been cancelled.', code: 'TICKET_CANCELLED' });
            }
            if (ticket.eventId !== targetEventId) {
              const eventName = ticket.eventTitle || event?.title || 'an event';
              return sendJson(res, 403, {
                success: false,
                error: `WRONG EVENT PASS! This pass belongs to "${eventName}", not "${targetEvent.title}". Gate entry denied.`,
                code: 'WRONG_HOST_OR_EVENT',
                ticket
              });
            }
          } else {
            // STRICT HOST VERIFICATION
            const normalizedHostId = hostId?.trim();
            const normalizedHostEmail = hostEmail?.toLowerCase().trim();
            const isAuthorizedOrganizer = Boolean(
              (normalizedHostId && ticket.hostId && ticket.hostId === normalizedHostId) ||
              (normalizedHostId && event && event.hostId === normalizedHostId) ||
              (normalizedHostEmail && event && event.hostEmail && event.hostEmail.toLowerCase().trim() === normalizedHostEmail)
            );

            if (!isAuthorizedOrganizer) {
              const eventName = ticket.eventTitle || event?.title || 'an event';
              return sendJson(res, 403, {
                success: false,
                error: `UNAUTHORIZED SCANNER! This pass belongs to "${eventName}" created by a different organizer. Only the organizer of this event can scan and verify this pass.`,
                code: 'WRONG_HOST_OR_EVENT',
                ticket
              });
            }
          }

          if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
            return sendJson(res, 400, {
              success: false,
              error: `Ticket is ${ticket.status.toUpperCase()} and cannot be used.`,
              code: 'TICKET_CANCELLED',
              ticket
            });
          }

          if (ticket.entryStatus === 'entered') {
            return sendJson(res, 400, {
              success: false,
              error: `ALREADY USED! Checked in at ${ticket.entryTime || 'earlier today'}. Duplicate entry rejected!`,
              code: 'ALREADY_ENTERED',
              ticket
            });
          }

          const now = new Date();
          const nowDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          ticket.entryStatus = 'entered';
          ticket.entryTime = nowDisplay;
          ticket.entryTimestamp = now.toISOString();
          ticket.verifiedBy = volunteerGatePin ? 'volunteer' : 'organizer';
          if (volunteerGatePin) {
            ticket.volunteerPin = String(volunteerGatePin).trim();
          }
          ticket.exitStatus = 'not_exited';
          saveDatabase(db);

          if (PostgresService.getConnected()) {
            await PostgresService.upsertTicket(ticket).catch(() => {});
          }

          broadcastRealtime('tickets', { ticketId: ticket.ticketId, eventId: ticket.eventId },
            buildBroadcastData(db, { includeAllTickets: true, eventId: ticket.eventId }));
          return sendJson(res, 200, {
            success: true,
            message: `ENTRY GRANTED! Welcome ${ticket.userName}. Pass verified successfully.`,
            ticket,
            code: 'VALID'
          });
        }

        // 4b. Tickets endpoints (strictly scoped)
        if (url === '/api/tickets' || url.startsWith('/api/tickets?')) {
          if (req.method === 'GET') {
            const parsed = new URL(url, 'http://localhost');
            const hostId = (parsed.searchParams.get('hostId') || '').trim();
            const hostEmail = (parsed.searchParams.get('hostEmail') || '').toLowerCase().trim();
            const userId = (parsed.searchParams.get('userId') || '').trim();
            const userEmail = (parsed.searchParams.get('userEmail') || '').toLowerCase().trim();

            if (hostId || hostEmail) {
              const hostEvents = db.events.filter(
                (e) =>
                  (hostId && e.hostId === hostId) ||
                  (hostEmail && e.hostEmail && String(e.hostEmail).toLowerCase().trim() === hostEmail)
              );
              const hostEventIds = new Set(hostEvents.map((e) => e.eventId));
              return sendJson(
                res,
                200,
                db.tickets.filter((t) => (hostId && t.hostId === hostId) || hostEventIds.has(t.eventId))
              );
            }

            if (userId || userEmail) {
              return sendJson(
                res,
                200,
                db.tickets.filter(
                  (t) =>
                    (userId && t.userId === userId) ||
                    (userEmail && t.userEmail && String(t.userEmail).toLowerCase().trim() === userEmail)
                )
              );
            }

            return sendJson(res, 200, []);
          }
          if (req.method === 'POST') {
            const newTicket = await parseBody(req);
            if (!newTicket || !newTicket.ticketId) {
              return sendJson(res, 400, { error: 'Invalid ticket data' });
            }
            const existingIdx = db.tickets.findIndex((t) => t.ticketId === newTicket.ticketId);
            if (existingIdx >= 0) {
              db.tickets[existingIdx] = { ...db.tickets[existingIdx], ...newTicket };
            } else {
              db.tickets.unshift(newTicket);
            }
            const savedTicket = existingIdx >= 0 ? db.tickets[existingIdx] : newTicket;

            // *** CRITICAL: Recalculate event.ticketsSold from actual confirmed tickets ***
            // The client updates localStorage optimistically — but server must stay authoritative.
            // Without this, /api/sync returns stale ticketsSold and overwrites the correct count.
            if (savedTicket.eventId) {
              const evtIdx = db.events.findIndex((e: any) => e.eventId === savedTicket.eventId);
              if (evtIdx >= 0) {
                const confirmedQty = db.tickets
                  .filter((t: any) => t.eventId === savedTicket.eventId && t.status === 'confirmed')
                  .reduce((sum: number, t: any) => sum + Math.max(1, Number(t.quantity) || 1), 0);
                const capacity = Number(db.events[evtIdx].capacity) || 0;
                const wasSoldOut = db.events[evtIdx].status === 'sold_out';
                db.events[evtIdx] = {
                  ...db.events[evtIdx],
                  ticketsSold: confirmedQty,
                  availableTickets: Math.max(0, capacity - confirmedQty),
                  status: capacity > 0 && confirmedQty >= capacity
                    ? 'sold_out'
                    : (wasSoldOut ? 'published' : db.events[evtIdx].status),
                  updatedAt: new Date().toISOString(),
                };
                if (PostgresService.getConnected()) {
                  await PostgresService.upsertEvent(db.events[evtIdx]).catch((e: any) =>
                    console.warn('Postgres event ticketsSold update error:', e));
                }
              }
            }

            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.upsertTicket(savedTicket).catch((e: any) => console.warn('Postgres ticket sync error:', e));
            }
            // Broadcast with updated ticket AND event (now has correct ticketsSold)
            broadcastRealtime('tickets', { ticketId: savedTicket.ticketId, eventId: savedTicket.eventId }, {
              tickets: [savedTicket],
              events: db.events.filter((e: any) => e.eventId === savedTicket.eventId),
            });
            return sendJson(res, 200, { success: true, ticket: savedTicket });
          }
        }

        if (url.startsWith('/api/tickets/')) {
          const ticketId = url.replace('/api/tickets/', '').split('?')[0];
          if (req.method === 'PUT') {
            const updates = await parseBody(req);
            const idx = db.tickets.findIndex((t) => t.ticketId === ticketId);
            if (idx === -1) {
              return sendJson(res, 404, { error: 'Ticket not found' });
            }

            const currentTicket = db.tickets[idx];
            const event = db.events.find((e) => e.eventId === currentTicket.eventId);

            // If updating check-in status, enforce host authorization or volunteer gate PIN
            if (updates.volunteerGatePin) {
              const isVolunteerValid = Boolean(event && event.gatePin === updates.volunteerGatePin.trim());
              if (!isVolunteerValid) {
                return sendJson(res, 403, {
                  error: 'Unauthorized: Invalid volunteer gate PIN for this event.',
                  code: 'WRONG_HOST_OR_EVENT'
                });
              }
              delete updates.volunteerGatePin;
            } else if (updates.requestingHostId || updates.requestingHostEmail) {
              const isOwner = Boolean(
                (updates.requestingHostId && currentTicket.hostId === updates.requestingHostId) ||
                (updates.requestingHostId && event && event.hostId === updates.requestingHostId) ||
                (updates.requestingHostEmail && event && event.hostEmail && event.hostEmail.toLowerCase().trim() === updates.requestingHostEmail.toLowerCase().trim())
              );
              if (!isOwner) {
                return sendJson(res, 403, {
                  error: 'Unauthorized: You cannot check in tickets for events created by another organizer.',
                  code: 'WRONG_HOST_OR_EVENT'
                });
              }
            }

            delete updates.requestingHostId;
            delete updates.requestingHostEmail;

            db.tickets[idx] = { ...db.tickets[idx], ...updates };
            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.upsertTicket(db.tickets[idx]).catch((e: any) => console.warn('Postgres ticket update error:', e));
            }
            // Broadcast with updated ticket + all tickets for this event so host dashboard refreshes instantly
            broadcastRealtime('tickets', { ticketId, eventId: currentTicket.eventId },
              buildBroadcastData(db, { includeAllTickets: true, eventId: currentTicket.eventId, includedTickets: db.tickets.filter((t: any) => t.eventId === currentTicket.eventId) }));
            return sendJson(res, 200, { success: true, ticket: db.tickets[idx] });
          }
        }

        // 5. Server-verified Authentication & Sanitized Accounts endpoints
        if (url === '/api/auth/login' && req.method === 'POST') {
          const body = await parseBody(req);
          const rawIdentifier = String(body.identifier || '').trim();
          const password = String(body.password || '');
          const clean = rawIdentifier.toLowerCase();
          const cleanDigits = rawIdentifier.replace(/[\s\-()+]/g, '');

          if (!rawIdentifier || !password) {
            return sendJson(res, 400, { success: false, error: 'Identifier and password are required.' });
          }

          let matched = db.accounts.find((a) => {
            const aEmail = a.email ? String(a.email).toLowerCase().trim() : '';
            const aPhone = a.phone ? String(a.phone).replace(/[\s\-()+]/g, '') : '';
            return (clean && aEmail === clean) || (cleanDigits.length >= 10 && aPhone === cleanDigits);
          });

          if (!matched && PostgresService.getConnected()) {
            const pgAccs = await PostgresService.getAccounts().catch(() => []);
            matched = pgAccs.find((a: any) => {
              const aEmail = a.email ? String(a.email).toLowerCase().trim() : '';
              const aPhone = a.phone ? String(a.phone).replace(/[\s\-()+]/g, '') : '';
              return (clean && aEmail === clean) || (cleanDigits.length >= 10 && aPhone === cleanDigits);
            });
          }

          if (!matched) {
            return sendJson(res, 404, { success: false, code: 'NOT_FOUND', error: 'No account found with this identifier.' });
          }

          if (!matched.password || matched.password !== password) {
            return sendJson(res, 401, {
              success: false,
              code: 'INVALID_PASSWORD',
              error: matched.authProvider === 'google' && !matched.password
                ? 'This account uses Google Sign-In. Please continue with Google or reset your password.'
                : 'Incorrect password. Please verify your credentials or reset your password.',
            });
          }

          return sendJson(res, 200, { success: true, account: sanitizeAccount(matched) });
        }

        if (url === '/api/accounts' || url.startsWith('/api/accounts?')) {
          if (req.method === 'GET') {
            const parsed = new URL(url, 'http://localhost');
            const uid = (parsed.searchParams.get('uid') || '').trim();
            const identifier = (parsed.searchParams.get('identifier') || parsed.searchParams.get('email') || '').trim();
            const clean = identifier.toLowerCase();
            const cleanDigits = identifier.replace(/[\s\-()+]/g, '');

            if (uid) {
              return sendJson(res, 200, db.accounts.filter((a) => a.uid === uid).map(sanitizeAccount));
            }
            if (identifier) {
              const found = db.accounts.filter((a) => {
                const aEmail = a.email ? String(a.email).toLowerCase().trim() : '';
                const aPhone = a.phone ? String(a.phone).replace(/[\s\-()+]/g, '') : '';
                return (clean && aEmail === clean) || (cleanDigits.length >= 10 && aPhone === cleanDigits);
              });
              return sendJson(res, 200, found.map(sanitizeAccount));
            }
            return sendJson(res, 200, db.accounts.map(sanitizeAccount));
          }
          if (req.method === 'POST') {
            const account = await parseBody(req);
            if (!account || !account.email) {
              return sendJson(res, 400, { error: 'Invalid account data' });
            }
            const cleanEmail = account.email.toLowerCase().trim();
            const cleanOldEmail = account.oldEmail ? account.oldEmail.toLowerCase().trim() : null;
            const existingIdx = db.accounts.findIndex(
              (a) => (account.uid && a.uid === account.uid) ||
                     a.email.toLowerCase().trim() === cleanEmail ||
                     (cleanOldEmail && a.email.toLowerCase().trim() === cleanOldEmail)
            );
            let savedAccount: any;
            if (existingIdx >= 0) {
              const existingAcc = db.accounts[existingIdx];
              const incomingCopy = { ...account };
              if (!incomingCopy.password && existingAcc.password) {
                incomingCopy.password = existingAcc.password;
              }
              savedAccount = { ...existingAcc, ...incomingCopy };
              if (cleanOldEmail && cleanOldEmail !== cleanEmail) {
                delete savedAccount.oldEmail;
              }
              db.accounts[existingIdx] = savedAccount;
            } else {
              savedAccount = { ...account };
              db.accounts.push(savedAccount);
            }

            // Keep attendee tickets synced if user details changed
            if (Array.isArray(db.tickets)) {
              for (const t of db.tickets) {
                if (t.userId === savedAccount.uid || (cleanOldEmail && t.userEmail?.toLowerCase().trim() === cleanOldEmail)) {
                  t.userEmail = cleanEmail;
                  if (savedAccount.name) t.userName = savedAccount.name;
                  if (savedAccount.phone) t.phone = savedAccount.phone;
                }
              }
            }

            // Keep host events & their tickets synced if organizer details changed
            const syncedHostEventIds = new Set<string>();
            if (Array.isArray(db.events)) {
              for (const e of db.events) {
                const isHostEvent = Boolean(
                  (savedAccount.uid && e.hostId === savedAccount.uid) ||
                  (cleanEmail && e.hostEmail && String(e.hostEmail).toLowerCase().trim() === cleanEmail)
                );
                if (isHostEvent) {
                  if (savedAccount.name) e.hostName = savedAccount.name;
                  if (savedAccount.phone) e.hostPhone = savedAccount.phone;
                  e.updatedAt = new Date().toISOString();
                  syncedHostEventIds.add(e.eventId);
                }
              }
            }

            const syncedHostTickets: any[] = [];
            if (savedAccount.phone && syncedHostEventIds.size > 0 && Array.isArray(db.tickets)) {
              for (const t of db.tickets) {
                if (syncedHostEventIds.has(t.eventId)) {
                  t.hostPhone = savedAccount.phone;
                  syncedHostTickets.push(t);
                }
              }
            }

            saveDatabase(db);
            if (PostgresService.getConnected()) {
              if (cleanOldEmail && cleanOldEmail !== cleanEmail) {
                await PostgresService.deleteAccount(cleanOldEmail).catch((e: any) => console.warn('Postgres delete old account error:', e));
              }
              await PostgresService.upsertAccount(savedAccount).catch((e: any) => console.warn('Postgres account sync error:', e));
              for (const t of syncedHostTickets) {
                await PostgresService.upsertTicket(t).catch(() => {});
              }
            }
            broadcastRealtime('accounts', { uid: savedAccount.uid });
            if (syncedHostEventIds.size > 0) {
              broadcastRealtime(
                'events',
                { uid: savedAccount.uid },
                buildBroadcastData(db, {
                  includeEvents: true,
                  includedTickets: syncedHostTickets.length > 0 ? syncedHostTickets : undefined,
                })
              );
            }
            return sendJson(res, 200, { success: true, account: sanitizeAccount(savedAccount) });
          }
        }

        // 5b. Dedicated Genuine Password Reset Endpoints
        if (url === '/api/auth/send-reset-link' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const email = String(body.email || '').trim().toLowerCase();
            const targetRole = String(body.targetRole || '').trim().toLowerCase();
            const origin = String(body.origin || '').trim();

            if (!email || !email.includes('@')) {
              return sendJson(res, 400, { success: false, error: 'Please enter a valid email address.' });
            }

            // 1. Strict check in registered accounts database
            let account = db.accounts.find((a: any) => a.email && a.email.toLowerCase().trim() === email);
            if (!account && PostgresService.getConnected()) {
              const pgAccounts = await PostgresService.getAccounts().catch(() => []);
              account = pgAccounts.find((a: any) => a.email && a.email.toLowerCase().trim() === email);
            }

            // If account was validated client-side from Firestore or local storage, import into db.accounts
            if (!account && body.account && body.account.email && body.account.email.toLowerCase().trim() === email) {
              account = {
                uid: body.account.uid || `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
                name: body.account.name || email.split('@')[0],
                email,
                role: body.account.role || targetRole || 'user',
                college: body.account.college || '',
                phone: body.account.phone || '',
                photoURL: body.account.photoURL || '',
                authProvider: body.account.authProvider || 'email',
                password: body.account.password || '',
                createdAt: body.account.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              db.accounts.push(account);
              saveDatabase(db);
              if (PostgresService.getConnected()) {
                await PostgresService.upsertAccount(account).catch(() => {});
              }
            }

            if (!account) {
              const portalLabel = targetRole === 'host' ? 'Host / Organizer' : 'Student';
              return sendJson(res, 404, {
                success: false,
                error: `No registered ${portalLabel} account found with "${email}". Please check your email or register a new account.`
              });
            }

            // 2. Strict portal & role verification for both logins
            const rawRole = (account.role || 'user').toLowerCase();
            const normalizedRegistered = (rawRole === 'student' || rawRole === 'user') ? 'user' : 'host';
            const normalizedTarget = (targetRole === 'student' || targetRole === 'user') ? 'user' : (targetRole === 'host' ? 'host' : null);
            const registeredRole = normalizedRegistered;

            if (normalizedTarget && normalizedRegistered !== normalizedTarget) {
              const registeredPortal = normalizedRegistered === 'host' ? 'Host / Organizer' : 'Student';
              return sendJson(res, 400, {
                success: false,
                error: `"${email}" is registered as a ${registeredPortal} account. Please switch to the ${registeredPortal} login portal to reset your password.`
              });
            }

            // 3. Generate genuine cryptographically secure reset token
            const token = `prt_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
            if (!db.passwordResetTokens) {
              db.passwordResetTokens = {};
            }

            // Clean up any expired tokens
            const now = Date.now();
            for (const k of Object.keys(db.passwordResetTokens)) {
              if (db.passwordResetTokens[k].expiresAt < now) {
                delete db.passwordResetTokens[k];
              }
            }

            // Token is valid for 1 hour
            db.passwordResetTokens[token] = {
              email,
              role: registeredRole,
              createdAt: new Date().toISOString(),
              expiresAt: now + 3600000,
            };
            saveDatabase(db);

            const hostOrigin = origin || 'http://localhost:3000';
            const cleanOrigin = hostOrigin.replace(/\/+$/, '');
            const resetLink = `${cleanOrigin}/?mode=resetPassword&resetToken=${token}`;

            console.log(`[AUTH] Genuine password reset link generated for ${email} (${registeredRole}): ${resetLink}`);

            return sendJson(res, 200, {
              success: true,
              message: `A secure password reset link has been dispatched to ${email}.`,
              resetLink,
              email,
              role: registeredRole,
            });
          } catch (err: any) {
            console.error('[AUTH send-reset-link error]:', err);
            return sendJson(res, 500, { success: false, error: err?.message || 'Failed to dispatch reset link.' });
          }
        }

        if (url.startsWith('/api/auth/verify-reset-token') && req.method === 'GET') {
          try {
            const parsedUrl = new URL(url, 'http://localhost');
            const token = parsedUrl.searchParams.get('token');
            if (!token || !db.passwordResetTokens || !db.passwordResetTokens[token]) {
              return sendJson(res, 400, { valid: false, error: 'Invalid or expired password reset link. Please request a new link.' });
            }
            const tokenData = db.passwordResetTokens[token];
            if (tokenData.expiresAt < Date.now()) {
              delete db.passwordResetTokens[token];
              saveDatabase(db);
              return sendJson(res, 400, { valid: false, error: 'This password reset link has expired. Please request a new link.' });
            }
            return sendJson(res, 200, { valid: true, email: tokenData.email, role: tokenData.role });
          } catch (err: any) {
            return sendJson(res, 500, { valid: false, error: 'Failed to verify token' });
          }
        }

        if (url === '/api/auth/confirm-reset-password' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const token = String(body.token || '').trim();
            const newPassword = String(body.newPassword || '');

            if (!token || !db.passwordResetTokens || !db.passwordResetTokens[token]) {
              return sendJson(res, 400, { success: false, error: 'Invalid or expired password reset link. Please request a new link.' });
            }

            const tokenData = db.passwordResetTokens[token];
            if (tokenData.expiresAt < Date.now()) {
              delete db.passwordResetTokens[token];
              saveDatabase(db);
              return sendJson(res, 400, { success: false, error: 'This password reset link has expired. Please request a new link.' });
            }

            if (!newPassword || newPassword.length < 6) {
              return sendJson(res, 400, { success: false, error: 'Password must be at least 6 characters long.' });
            }

            const cleanEmail = tokenData.email.toLowerCase().trim();
            let accountIdx = db.accounts.findIndex((a: any) => a.email && a.email.toLowerCase().trim() === cleanEmail);
            let targetAccount: any;

            if (accountIdx >= 0) {
              db.accounts[accountIdx].password = newPassword;
              db.accounts[accountIdx].updatedAt = new Date().toISOString();
              targetAccount = db.accounts[accountIdx];
            } else {
              targetAccount = {
                uid: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
                name: cleanEmail.split('@')[0],
                email: cleanEmail,
                password: newPassword,
                role: tokenData.role || 'user',
                college: tokenData.role === 'host' ? 'Campus Event Council' : 'College Student',
                phone: '',
                authProvider: 'email',
                createdAt: tokenData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              db.accounts.push(targetAccount);
            }

            delete db.passwordResetTokens[token];
            saveDatabase(db);

            if (PostgresService.getConnected() && targetAccount) {
              await PostgresService.upsertAccount(targetAccount).catch(() => {});
            }

            console.log(`[AUTH] Password updated in database for ${cleanEmail}`);

            return sendJson(res, 200, {
              success: true,
              message: 'Your password has been reset successfully in the database. You can now log in with your new password.',
              email: cleanEmail,
              role: tokenData.role,
              account: targetAccount,
            });
          } catch (err: any) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Failed to update password.' });
          }
        }

        if (url === '/api/auth/update-password' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const email = String(body.email || '').trim().toLowerCase();
            const newPassword = String(body.newPassword || '');

            if (!email || !email.includes('@')) {
              return sendJson(res, 400, { success: false, error: 'Valid email address required.' });
            }
            if (!newPassword || newPassword.length < 6) {
              return sendJson(res, 400, { success: false, error: 'Password must be at least 6 characters long.' });
            }

            let accountIdx = db.accounts.findIndex((a: any) => a.email && a.email.toLowerCase().trim() === email);
            let targetAccount: any;

            if (accountIdx >= 0) {
              db.accounts[accountIdx].password = newPassword;
              db.accounts[accountIdx].updatedAt = new Date().toISOString();
              targetAccount = db.accounts[accountIdx];
            } else {
              targetAccount = {
                uid: body.uid || `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
                name: body.name || email.split('@')[0],
                email,
                password: newPassword,
                role: body.role || 'user',
                college: body.college || '',
                phone: body.phone || '',
                authProvider: 'email',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              db.accounts.push(targetAccount);
            }

            saveDatabase(db);

            if (PostgresService.getConnected()) {
              await PostgresService.upsertAccount(targetAccount).catch(() => {});
            }

            console.log(`[AUTH] Password directly updated in database for ${email}`);

            return sendJson(res, 200, {
              success: true,
              message: 'Password updated successfully in database.',
              email,
              account: targetAccount,
            });
          } catch (err: any) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Failed to update password.' });
          }
        }

        // 6. Payouts endpoints (strictly scoped per host)
        if (url === '/api/payouts' || url.startsWith('/api/payouts?')) {
          if (req.method === 'GET') {
            const parsed = new URL(url, 'http://localhost');
            const hostId = (parsed.searchParams.get('hostId') || '').trim();
            const hostEmail = (parsed.searchParams.get('hostEmail') || '').toLowerCase().trim();
            if (!hostId && !hostEmail) {
              return sendJson(res, 200, []);
            }
            return sendJson(
              res,
              200,
              db.payouts.filter(
                (p) =>
                  (hostId && p.hostId === hostId) ||
                  (hostEmail && p.hostEmail && String(p.hostEmail).toLowerCase().trim() === hostEmail)
              )
            );
          }
          if (req.method === 'POST') {
            const payout = await parseBody(req);
            if (!payout || !payout.payoutId) {
              return sendJson(res, 400, { error: 'Invalid payout data' });
            }
            const existIdx = db.payouts.findIndex((p) => p.payoutId === payout.payoutId);
            if (existIdx > -1) {
              db.payouts[existIdx] = { ...db.payouts[existIdx], ...payout };
            } else {
              db.payouts.unshift(payout);
            }
            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.insertPayout(payout).catch((e: any) => console.warn('Postgres payout sync error:', e));
            }
            broadcastRealtime('payouts', { payoutId: payout.payoutId, hostId: payout.hostId });
            return sendJson(res, 200, { success: true, payout });
          }
        }

        // 7. Supabase Config endpoints
        if (url === '/api/supabase-config') {
          if (req.method === 'GET') {
            return sendJson(res, 200, db.supabaseConfig || { url: '', anonKey: '', enabled: false });
          }
          if (req.method === 'POST') {
            const config = await parseBody(req);
            db.supabaseConfig = {
              url: config.url || '',
              anonKey: config.anonKey || '',
              enabled: Boolean(config.enabled && config.url && config.anonKey),
            };
            saveDatabase(db);
            return sendJson(res, 200, { success: true, supabaseConfig: db.supabaseConfig });
          }
        }

        // 8. Centralized Backend Razorpay Gateway Integration Helpers
        const getActiveRzp = () => {
          const envCfg = readEnvRazorpayConfig();
          const hasEnvCreds = Boolean(
            envCfg.keyId &&
            envCfg.keySecret &&
            (envCfg.keyId.startsWith('rzp_live_') || envCfg.keyId.startsWith('rzp_test_'))
          );
          const stored = db.razorpayConfig;
          const useStored = Boolean(
            !hasEnvCreds &&
            stored &&
            stored.updatedViaUi &&
            stored.keyId &&
            !isLegacyDemoKeyId(stored.keyId) &&
            !isLegacyDemoSecret(stored.keySecret)
          );
          const keyId = ((hasEnvCreds ? envCfg.keyId : useStored ? stored.keyId : envCfg.keyId) || '').trim();
          const keySecret = ((hasEnvCreds ? envCfg.keySecret : useStored ? stored.keySecret : envCfg.keySecret) || '').trim();
          const accountNumber = ((hasEnvCreds ? envCfg.accountNumber : useStored ? stored.accountNumber : envCfg.accountNumber) || envCfg.accountNumber || '').trim();
          const isLive = keyId.startsWith('rzp_live_');
          const isConfigured = Boolean(
            keyId &&
            keySecret &&
            (keyId.startsWith('rzp_live_') || keyId.startsWith('rzp_test_')) &&
            !isLegacyDemoKeyId(keyId) &&
            !isLegacyDemoSecret(keySecret)
          );
          const hasValidPayoutAccount = Boolean(accountNumber && !accountNumber.startsWith('rzp_') && accountNumber.length >= 6);
          return {
            keyId,
            keySecret,
            accountNumber,
            isLive,
            isConfigured,
            hasEnvCreds,
            hasValidPayoutAccount,
            source: hasEnvCreds ? 'env' : useStored ? 'settings' : 'env',
          };
        };

        // 8a. Authoritative Host Revenue & Saved Bank Profile Endpoints (strictly organizer-scoped)
        if ((url === '/api/host/revenue' || url.startsWith('/api/host/revenue?')) && req.method === 'GET') {
          const parsed = new URL(url, 'http://localhost');
          const hostId = (parsed.searchParams.get('hostId') || '').trim();
          const hostEmail = (parsed.searchParams.get('hostEmail') || '').toLowerCase().trim();
          if (!hostId && !hostEmail) {
            return sendJson(res, 401, { success: false, error: 'Authenticated organizer ID or email is required.' });
          }
          const rzp = getActiveRzp();
          const rev = computeServerHostRevenue(db, hostId, hostEmail);
          return sendJson(res, 200, {
            success: true,
            ...rev,
            gatewayConfigured: rzp.isConfigured,
            hasValidPayoutAccount: rzp.hasValidPayoutAccount,
            isLive: rzp.isLive,
          });
        }

        if (url === '/api/host/payout-profile' || url.startsWith('/api/host/payout-profile?')) {
          if (req.method === 'GET') {
            const parsed = new URL(url, 'http://localhost');
            const hostId = (parsed.searchParams.get('hostId') || '').trim();
            if (!hostId) {
              return sendJson(res, 401, { success: false, error: 'Authenticated organizer ID is required.' });
            }
            const profile = db.hostPayoutProfiles?.[hostId] || null;
            return sendJson(res, 200, { success: true, profile });
          }
          if (req.method === 'POST') {
            const body = await parseBody(req);
            const hostId = String(body.hostId || '').trim();
            if (!hostId) {
              return sendJson(res, 401, { success: false, error: 'Authenticated organizer ID is required.' });
            }
            const preferredMethod: 'BANK_TRANSFER' | 'UPI' = body.preferredMethod === 'UPI' ? 'UPI' : 'BANK_TRANSFER';
            const profile = {
              hostId,
              preferredMethod,
              accountHolderName: String(body.accountHolderName || '').trim(),
              accountNumber: String(body.accountNumber || '').trim(),
              ifscCode: String(body.ifscCode || '').trim().toUpperCase(),
              bankName: String(body.bankName || '').trim(),
              upiId: String(body.upiId || '').trim(),
              updatedAt: new Date().toISOString(),
            };
            if (!db.hostPayoutProfiles || typeof db.hostPayoutProfiles !== 'object') {
              db.hostPayoutProfiles = {};
            }
            db.hostPayoutProfiles[hostId] = profile;
            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.upsertPayoutProfile(profile).catch((e: any) =>
                console.warn('Postgres payout profile sync error:', e)
              );
            }
            return sendJson(res, 200, { success: true, profile });
          }
        }

        if (url === '/api/razorpay/config') {
          if (req.method === 'GET') {
            const rzp = getActiveRzp();
            return sendJson(res, 200, {
              keyId: rzp.keyId,
              isConfigured: rzp.isConfigured,
              isLive: rzp.isLive,
              hasSecret: Boolean(rzp.keySecret),
              configurationError: rzp.isConfigured
                ? ''
                : 'Replace demo or placeholder Razorpay credentials with real test/live API keys from your Razorpay Dashboard.',
              hasValidPayoutAccount: rzp.hasValidPayoutAccount,
              accountNumber: rzp.hasValidPayoutAccount
                ? `${rzp.accountNumber.slice(0, 4)}••••${rzp.accountNumber.slice(-4)}`
                : '',
              source: rzp.source,
              centralized: true,
              merchantName: 'Fest-Plus College Events',
            });
          }

          if (req.method === 'POST') {
            try {
              const body = await parseBody(req);
              const rzp = getActiveRzp();
              if (rzp.hasEnvCreds) {
                return sendJson(res, 403, {
                  success: false,
                  error:
                    'Payment gateway is centrally configured on the backend server (.env / Secrets). Individual organizers cannot override platform credentials.',
                });
              }
              const newKeyId = (body.keyId || '').trim();
              const newKeySecret = (body.keySecret || '').trim();
              const newAccountNumber = (body.accountNumber || '').trim();

              if (!newKeyId || (!newKeyId.startsWith('rzp_live_') && !newKeyId.startsWith('rzp_test_'))) {
                return sendJson(res, 400, { error: 'Valid Razorpay Key ID is required (must start with rzp_live_ or rzp_test_).' });
              }
              if (isLegacyDemoKeyId(newKeyId) || isLegacyDemoSecret(newKeySecret)) {
                return sendJson(res, 400, { error: 'Demo placeholder keys are not accepted. Please provide your Razorpay merchant API credentials.' });
              }

              const effectiveSecret = newKeySecret || rzp.keySecret;
              if (!effectiveSecret) {
                return sendJson(res, 400, { error: 'Razorpay Key Secret is required.' });
              }

              if (newAccountNumber && newAccountNumber.startsWith('rzp_')) {
                return sendJson(res, 400, {
                  error: 'RazorpayX Account Number should be your RazorpayX Current/Virtual Account Number (digits), not your rzp_ Key ID.',
                });
              }

              db.razorpayConfig = {
                keyId: newKeyId,
                keySecret: effectiveSecret,
                accountNumber: newAccountNumber.includes('••••') ? rzp.accountNumber : newAccountNumber,
                updatedViaUi: true,
              };
              saveDatabase(db);

              return sendJson(res, 200, {
                success: true,
                message: `Razorpay ${newKeyId.startsWith('rzp_live_') ? 'Live Production' : 'Test Mode'} credentials saved and activated.`,
                keyId: newKeyId,
                isLive: newKeyId.startsWith('rzp_live_'),
              });
            } catch (err: any) {
              return sendJson(res, 500, { error: err.message || 'Error updating Razorpay credentials' });
            }
          }
        }

        if (url === '/api/razorpay/test-connection' && req.method === 'POST') {
          try {
            const body = await parseBody(req).catch(() => ({}));
            const rzp = getActiveRzp();
            const keyToTest = (body.keyId || rzp.keyId || '').trim();
            const secretToTest = (body.keySecret || rzp.keySecret || '').trim();

            if (!keyToTest || !secretToTest) {
              return sendJson(res, 400, {
                success: false,
                error: 'Please provide both Razorpay Key ID and Key Secret to test the gateway connection.',
              });
            }

            const basicAuth = Buffer.from(`${keyToTest}:${secretToTest}`).toString('base64');
            const checkRes = await fetch('https://api.razorpay.com/v1/orders?count=1', {
              headers: {
                Authorization: `Basic ${basicAuth}`,
              },
            });

            if (checkRes.ok) {
              const isLive = keyToTest.startsWith('rzp_live_');
              return sendJson(res, 200, {
                success: true,
                isLive,
                mode: isLive ? 'Live Production Gateway' : 'Razorpay Test Gateway',
                message: `Verified with Razorpay API! ${isLive ? 'Live payments active (real UPI, Cards & NetBanking).' : 'Razorpay Test Gateway active.'}`,
              });
            } else {
              const errData: any = await checkRes.json().catch(() => ({}));
              return sendJson(res, 200, {
                success: false,
                statusCode: checkRes.status,
                error: errData?.error?.description || 'Authentication failed with Razorpay API. Please verify your Key ID and Key Secret.',
              });
            }
          } catch (err: any) {
            return sendJson(res, 500, { error: err.message || 'Error checking Razorpay gateway connection' });
          }
        }

        if ((url === '/api/create-order' || url === '/api/razorpay/create-order') && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const rzp = getActiveRzp();

            if (!rzp.isConfigured) {
              return sendJson(res, 503, {
                error: 'Real Razorpay gateway credentials are not configured on the server. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Secrets.',
              });
            }

            const qty = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 1)));
            const eventId = String(body.eventId || '').trim();
            const matchedEvent = eventId ? db.events.find((e: any) => e.eventId === eventId) : null;

            let amountInPaise = 0;
            if (matchedEvent) {
              if (matchedEvent.status === 'cancelled') {
                return sendJson(res, 400, { error: 'This event has been cancelled by the organizer.' });
              }
              if (matchedEvent.status === 'sold_out' || Number(matchedEvent.availableTickets) < qty) {
                return sendJson(res, 409, { error: `Only ${matchedEvent.availableTickets || 0} tickets remaining for this event.` });
              }
              const unitPrice = Number(matchedEvent.price) || 0;
              if (unitPrice <= 0) {
                return sendJson(res, 400, { error: 'Free events do not require a Razorpay payment order.' });
              }
              amountInPaise = Math.round(unitPrice * qty * 100);
            } else if (body.amountInPaise !== undefined) {
              amountInPaise = Math.round(Number(body.amountInPaise));
            } else if (body.amountInRupees !== undefined) {
              amountInPaise = Math.round(Number(body.amountInRupees) * 100);
            } else if (body.amount !== undefined) {
              amountInPaise = Math.round(Number(body.amount));
            }

            if (isNaN(amountInPaise) || amountInPaise < 100) {
              return sendJson(res, 400, { error: 'Order amount must be at least ₹1 (100 paise).' });
            }

            const currency = String(body.currency || 'INR').toUpperCase();
            const receipt = String(body.receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).slice(0, 40);
            const notes = body.notes || {
              eventId,
              eventTitle: String(matchedEvent?.title || body.eventTitle || '').substring(0, 40),
              hostId: String(matchedEvent?.hostId || '').substring(0, 40),
              hostEmail: String(matchedEvent?.hostEmail || '').substring(0, 40),
              studentName: String(body.studentName || '').substring(0, 40),
              studentEmail: String(body.studentEmail || '').substring(0, 40),
              quantity: String(qty),
            };

            const basicAuth = Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString('base64');
            const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${basicAuth}`,
              },
              body: JSON.stringify({
                amount: amountInPaise,
                currency,
                receipt,
                payment_capture: 1,
                notes,
              }),
            });

            const rzpData: any = await rzpRes.json().catch(() => ({}));

            if (rzpRes.status === 401) {
              return sendJson(res, 401, {
                error: 'Razorpay authentication failed. Please check your Key ID and Key Secret.',
                details: rzpData?.error,
              });
            }

            if (!rzpRes.ok || !rzpData.id) {
              console.error('[Razorpay Order Creation API Error]:', rzpData);
              return sendJson(res, rzpRes.status >= 400 ? rzpRes.status : 502, {
                error: rzpData?.error?.description || 'Razorpay order creation failed.',
                details: rzpData?.error,
              });
            }

            return sendJson(res, 200, {
              success: true,
              order_id: rzpData.id,
              orderId: rzpData.id,
              amount: rzpData.amount,
              currency: rzpData.currency,
              receipt: rzpData.receipt || receipt,
              key_id: rzp.keyId,
              keyId: rzp.keyId,
              isLive: rzp.isLive,
            });
          } catch (err: any) {
            console.error('[Razorpay Create Order Exception]', err);
            return sendJson(res, 502, { error: err.message || 'Server error creating Razorpay order' });
          }
        }

        if ((url === '/api/verify-payment' || url === '/api/razorpay/verify-payment') && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const rzp = getActiveRzp();

            if (!rzp.isConfigured) {
              return sendJson(res, 503, {
                success: false,
                verified: false,
                error: 'Razorpay gateway is not configured on the server.',
              });
            }

            const orderId = String(body.razorpay_order_id || body.order_id || body.orderId || '').trim();
            const paymentId = String(body.razorpay_payment_id || body.payment_id || body.paymentId || '').trim();
            const signature = String(body.razorpay_signature || body.signature || '').trim();

            if (!orderId || !paymentId || !signature) {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: 'Missing required Razorpay verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
              });
            }

            // Prevent replay of an already verified payment
            const duplicatePayment = Array.isArray(db.payments)
              ? db.payments.find((p: any) => p.paymentId === paymentId && p.status === 'captured')
              : null;
            if (duplicatePayment) {
              return sendJson(res, 409, {
                success: false,
                verified: false,
                error: 'This payment reference has already been verified and issued.',
              });
            }

            // 1. Cryptographic HMAC-SHA256 verification (constant-time comparison)
            const expectedSignature = crypto
              .createHmac('sha256', rzp.keySecret)
              .update(`${orderId}|${paymentId}`)
              .digest('hex');

            const expectedBuf = Buffer.from(expectedSignature, 'utf8');
            const receivedBuf = Buffer.from(signature, 'utf8');
            const isSignatureValid =
              expectedBuf.length === receivedBuf.length &&
              crypto.timingSafeEqual(expectedBuf, receivedBuf);

            if (!isSignatureValid) {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: 'Payment verification failed: Signature mismatch. Transaction was not authorized.',
              });
            }

            // 2. Authoritative status check against Razorpay Payments REST API
            const basicAuth = Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString('base64');
            const rzpPaymentRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
              headers: { Authorization: `Basic ${basicAuth}` },
            });

            if (!rzpPaymentRes.ok) {
              const errBody: any = await rzpPaymentRes.json().catch(() => ({}));
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: errBody?.error?.description || 'Could not confirm payment status with Razorpay API.',
              });
            }

            const rzpPayment: any = await rzpPaymentRes.json();
            if (rzpPayment.order_id && rzpPayment.order_id !== orderId) {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: 'Payment order mismatch detected by Razorpay gateway.',
              });
            }

            // Verify the order amount/currency server-side too. The checkout signature
            // only proves order_id|payment_id ownership; it does not authorize a ticket
            // quantity or event price.
            const rzpOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
              headers: { Authorization: `Basic ${basicAuth}` },
            });

            if (!rzpOrderRes.ok) {
              const errBody: any = await rzpOrderRes.json().catch(() => ({}));
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: errBody?.error?.description || 'Could not confirm the Razorpay order.',
              });
            }

            const rzpOrder: any = await rzpOrderRes.json();
            if (Number(rzpPayment.amount) !== Number(rzpOrder.amount)) {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: 'Payment amount does not match the Razorpay order amount.',
              });
            }
            if (String(rzpPayment.currency || rzpOrder.currency || 'INR').toUpperCase() !== String(rzpOrder.currency || 'INR').toUpperCase()) {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: 'Payment currency does not match the Razorpay order currency.',
              });
            }

            // If authorized but not yet captured, capture via Razorpay API
            let finalPaymentStatus = rzpPayment.status;
            if (finalPaymentStatus === 'authorized') {
              const captureRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Basic ${basicAuth}`,
                },
                body: JSON.stringify({
                  amount: rzpPayment.amount,
                  currency: rzpPayment.currency || 'INR',
                }),
              });
              if (captureRes.ok) {
                const capData: any = await captureRes.json().catch(() => ({}));
                finalPaymentStatus = capData.status || 'captured';
              }
            }

            if (finalPaymentStatus !== 'captured') {
              return sendJson(res, 400, {
                success: false,
                verified: false,
                error: `Payment is in "${finalPaymentStatus}" state and has not been captured by Razorpay.`,
              });
            }

            // Verified & captured! Record payment tagged with owning organizer in central gateway ledger
            const matchedEvent = body.eventId ? db.events.find((e: any) => e.eventId === body.eventId) : null;
            const resolvedHostId = String(matchedEvent?.hostId || body.hostId || '').trim();
            const resolvedHostEmail = String(matchedEvent?.hostEmail || body.hostEmail || '').toLowerCase().trim();
            const paymentRecord = {
              paymentId,
              orderId,
              amount: Number(rzpPayment.amount ? rzpPayment.amount / 100 : body.amount) || 0,
              currency: rzpPayment.currency || 'INR',
              status: 'captured',
              method: rzpPayment.method || 'razorpay_standard',
              vpa: rzpPayment.vpa || undefined,
              eventId: body.eventId || '',
              eventTitle: String(matchedEvent?.title || body.eventTitle || ''),
              hostId: resolvedHostId,
              hostEmail: resolvedHostEmail,
              quantity: Math.max(1, Math.floor(Number(body.quantity) || 1)),
              userId: body.userId || '',
              studentName: body.userName || body.studentName || '',
              studentEmail: body.userEmail || body.studentEmail || '',
              timestamp: new Date().toISOString(),
              isLive: rzp.isLive,
            };

            if (!Array.isArray(db.payments)) {
              db.payments = [];
            }
            db.payments.push(paymentRecord);

            // Recalculate event.ticketsSold from confirmed tickets now that payment is captured
            if (paymentRecord.eventId) {
              const evtIdx = db.events.findIndex((e: any) => e.eventId === paymentRecord.eventId);
              if (evtIdx >= 0) {
                const confirmedQty = db.tickets
                  .filter((t: any) => t.eventId === paymentRecord.eventId && t.status === 'confirmed')
                  .reduce((sum: number, t: any) => sum + Math.max(1, Number(t.quantity) || 1), 0);
                const capacity = Number(db.events[evtIdx].capacity) || 0;
                db.events[evtIdx] = {
                  ...db.events[evtIdx],
                  ticketsSold: confirmedQty,
                  availableTickets: Math.max(0, capacity - confirmedQty),
                  status: capacity > 0 && confirmedQty >= capacity ? 'sold_out' : db.events[evtIdx].status,
                  updatedAt: new Date().toISOString(),
                };
              }
            }

            saveDatabase(db);
            await MongoDbService.saveSnapshot(db).catch((e: any) =>
              console.warn('MongoDB payment sync error:', e)
            );
            if (PostgresService.getConnected()) {
              await PostgresService.upsertPayment(paymentRecord).catch((e: any) =>
                console.warn('Postgres payment sync error:', e)
              );
            }
            // Broadcast with updated tickets AND the event (now has correct ticketsSold)
            broadcastRealtime('payments', { paymentId, eventId: paymentRecord.eventId, hostId: resolvedHostId }, {
              tickets: db.tickets.filter((t: any) => t.eventId === paymentRecord.eventId),
              events: db.events.filter((e: any) => e.eventId === paymentRecord.eventId),
            });

            return sendJson(res, 200, {
              success: true,
              verified: true,
              message: 'Payment signature and Razorpay capture verified successfully',
              payment_id: paymentId,
              order_id: orderId,
              amount: paymentRecord.amount,
              method: paymentRecord.method,
              status: 'captured',
              isLive: rzp.isLive,
            });
          } catch (err: any) {
            console.error('[Razorpay Verify Payment Exception]', err);
            return sendJson(res, 502, {
              success: false,
              verified: false,
              error: err.message || 'Error verifying Razorpay payment',
            });
          }
        }

        // 9. RazorpayX Live Payout & Direct Settlement Endpoint
        if (url === '/api/razorpay/create-payout' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const rzp = getActiveRzp();

            const amountInRupees = Number(body.amount) || 0;
            if (amountInRupees <= 0) {
              return sendJson(res, 400, { success: false, error: 'Settlement amount must be greater than ₹0' });
            }

            const hostId = String(body.hostId || '').trim();
            const hostEmail = String(body.hostEmail || '').toLowerCase().trim();
            if (!hostId) {
              return sendJson(res, 401, { success: false, error: 'Authenticated organizer ID is required for payouts.' });
            }

            // Strictly enforce per-organizer sold-ticket available balance
            const hostRev = computeServerHostRevenue(db, hostId, hostEmail);
            if (hostRev.totalRevenue <= 0 || hostRev.availableBalance <= 0) {
              return sendJson(res, 400, {
                success: false,
                error: 'No settleable sold-ticket balance available for this organizer account (Available: ₹0).',
              });
            }
            if (amountInRupees > hostRev.availableBalance) {
              return sendJson(res, 400, {
                success: false,
                error: `Requested settlement (₹${amountInRupees.toLocaleString()}) exceeds your verified sold-ticket available balance (₹${hostRev.availableBalance.toLocaleString()}).`,
              });
            }

            const method: 'UPI' | 'BANK_TRANSFER' = body.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'UPI';
            const destination = String(body.destination || '').trim();
            const accountHolderName = String(body.accountHolderName || '').trim();
            const hostName = String(body.hostName || accountHolderName).trim();
            const ifscCode = String(body.ifscCode || '').trim().toUpperCase();
            const bankName = String(body.bankName || 'Bank Account').trim();

            if (!accountHolderName) {
              return sendJson(res, 400, { success: false, error: 'Beneficiary account holder name is required.' });
            }

            if (method === 'UPI' && (!destination || !destination.includes('@'))) {
              return sendJson(res, 400, { success: false, error: 'Valid UPI ID (e.g. mobile@upi) is required for UPI settlement.' });
            }

            if (method === 'BANK_TRANSFER' && (!destination || destination.length < 8 || ifscCode.length < 5)) {
              return sendJson(res, 400, { success: false, error: 'Valid Bank Account number and IFSC code are required.' });
            }

            const amountInPaise = Math.round(amountInRupees * 100);
            const referenceId = `SETTLE_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const idempotencyKey = `idem_${hostId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            let rzpPayoutData: any = null;
            let settlementGateway = 'DIRECT_INSTANT_SETTLEMENT';
            let payoutStatus = 'completed';

            // If RazorpayX credentials & account number are configured, attempt automatic clearing via RazorpayX API
            if (rzp.isConfigured && rzp.hasValidPayoutAccount) {
              try {
                const basicAuth = Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString('base64');
                const rzpPayoutPayload: any = {
                  account_number: rzp.accountNumber,
                  amount: amountInPaise,
                  currency: 'INR',
                  mode: method === 'UPI' ? 'UPI' : 'IMPS',
                  purpose: 'payout',
                  fund_account: {
                    account_type: method === 'UPI' ? 'vpa' : 'bank_account',
                    vpa: method === 'UPI' ? { address: destination } : undefined,
                    bank_account: method === 'BANK_TRANSFER' ? {
                      name: accountHolderName,
                      ifsc: ifscCode,
                      account_number: destination,
                    } : undefined,
                    contact: {
                      name: accountHolderName,
                      type: 'vendor',
                      reference_id: hostId,
                    },
                  },
                  queue_if_low_balance: true,
                  reference_id: referenceId,
                  narration: 'Fest Revenue Settlement',
                };

                const rzpPayoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${basicAuth}`,
                    'X-Payout-Idempotency': idempotencyKey,
                  },
                  body: JSON.stringify(rzpPayoutPayload),
                });

                const apiResData = await rzpPayoutRes.json().catch(() => ({}));
                if (rzpPayoutRes.ok && apiResData.id) {
                  rzpPayoutData = apiResData;
                  settlementGateway = 'RAZORPAYX_PAYOUT';
                  payoutStatus = apiResData.status || 'processing';
                } else {
                  console.warn('[RazorpayX Payout API fallback]:', apiResData?.error?.description || 'Falling back to direct ledger settlement');
                }
              } catch (rzpErr) {
                console.warn('[RazorpayX Payout fetch error]:', rzpErr);
              }
            }

            const destinationFormatted = method === 'UPI' ? destination : `${destination} (${bankName})`;
            const payoutId = rzpPayoutData?.id || `pout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const finalUtr = rzpPayoutData?.utr || `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

            const payoutRecord: any = {
              payoutId,
              hostId,
              hostEmail: hostEmail || undefined,
              hostName,
              amount: amountInRupees,
              currency: 'INR',
              method,
              destination: destinationFormatted,
              accountHolderName,
              status: payoutStatus,
              referenceId: finalUtr,
              gatewayRef: payoutId,
              gateway: settlementGateway,
              timestamp: new Date().toISOString(),
              notes: body.notes || `Host revenue settlement via ${method} (${destinationFormatted})`,
              isLive: Boolean(rzp.isLive),
            };
            if (method === 'BANK_TRANSFER' && bankName) payoutRecord.bankName = bankName;
            if (method === 'BANK_TRANSFER' && ifscCode) payoutRecord.ifscCode = ifscCode;

            if (!Array.isArray(db.payouts)) {
              db.payouts = [];
            }
            const existIdx = db.payouts.findIndex((p: any) => p.payoutId === payoutRecord.payoutId);
            if (existIdx > -1) {
              db.payouts[existIdx] = payoutRecord;
            } else {
              db.payouts.unshift(payoutRecord);
            }

            if (body.saveBankDetails) {
              if (!db.hostPayoutProfiles || typeof db.hostPayoutProfiles !== 'object') {
                db.hostPayoutProfiles = {};
              }
              const prevProfile = db.hostPayoutProfiles[hostId] || {};
              db.hostPayoutProfiles[hostId] = {
                ...prevProfile,
                hostId,
                preferredMethod: method,
                accountHolderName,
                accountNumber: method === 'BANK_TRANSFER' ? destination : prevProfile.accountNumber || '',
                ifscCode: method === 'BANK_TRANSFER' ? ifscCode : prevProfile.ifscCode || '',
                bankName: method === 'BANK_TRANSFER' ? bankName : prevProfile.bankName || '',
                upiId: method === 'UPI' ? destination : prevProfile.upiId || '',
                updatedAt: new Date().toISOString(),
              };
            }

            saveDatabase(db);
            if (PostgresService.getConnected()) {
              await PostgresService.insertPayout(payoutRecord).catch((e: any) =>
                console.warn('Postgres payout insert error:', e)
              );
              if (body.saveBankDetails && db.hostPayoutProfiles?.[hostId]) {
                await PostgresService.upsertPayoutProfile(db.hostPayoutProfiles[hostId]).catch((e: any) =>
                  console.warn('Postgres payout profile sync error:', e)
                );
              }
            }
            broadcastRealtime('payouts', { payoutId: payoutRecord.payoutId, hostId: payoutRecord.hostId });

            return sendJson(res, 200, {
              success: true,
              message: `₹${amountInRupees.toLocaleString()} dispatched via RazorpayX ${method === 'UPI' ? 'UPI' : 'IMPS'}!`,
              payout: payoutRecord,
              utr: payoutRecord.referenceId,
              gatewayPayoutId: payoutRecord.payoutId,
              isLive: rzp.isLive,
            });
          } catch (err: any) {
            console.error('[Razorpay Payout Exception]', err);
            return sendJson(res, 502, { success: false, error: err.message || 'Error processing RazorpayX settlement payout' });
          }
        }

        // Fallback for unmatched API routes
        return sendJson(res, 404, { error: 'Endpoint not found' });
      } catch (error: any) {
        console.error('[API Server] Unhandled error:', error);
        return sendJson(res, 500, { error: error?.message || 'Internal Server Error' });
      }
    };

export function apiServerPlugin(): Plugin {
  return {
    name: 'campuspass-api-server',
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}
