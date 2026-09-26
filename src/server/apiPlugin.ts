import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Plugin, Connect } from 'vite';

const DB_FILE_PATH = path.resolve(process.cwd(), 'data/campuspass_db.json');

const RAZORPAY_KEY_ID = process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_Tggr3y70eJFfd4';
const RAZORPAY_KEY_SECRET = process.env.VITE_RAZORPAY_KEY_SECRET || 'k039KgKPjvENzG0GDewKGBUA';

interface DatabaseSchema {
  events: any[];
  tickets: any[];
  accounts: any[];
  payouts: any[];
  supabaseConfig: {
    url: string;
    anonKey: string;
    enabled: boolean;
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const initial: DatabaseSchema = {
        events: [],
        tickets: [],
        accounts: [],
        payouts: [],
        supabaseConfig: { url: '', anonKey: '', enabled: false },
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
      supabaseConfig: parsed.supabaseConfig || { url: '', anonKey: '', enabled: false },
    };
  } catch (error) {
    console.error('[API Server] Error loading database:', error);
    return {
      events: [],
      tickets: [],
      accounts: [],
      payouts: [],
      supabaseConfig: { url: '', anonKey: '', enabled: false },
    };
  }
}

function saveDatabase(data: DatabaseSchema): boolean {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[API Server] Error saving database:', error);
    return false;
  }
}

async function parseBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

export function apiServerPlugin(): Plugin {
  return {
    name: 'campuspass-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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

        const db = loadDatabase();

        // 1. Health check
        if (url === '/api/health' && req.method === 'GET') {
          return sendJson(res, 200, {
            status: 'ok',
            database: 'connected',
            eventsCount: db.events.length,
            ticketsCount: db.tickets.length,
            accountsCount: db.accounts.length,
            timestamp: new Date().toISOString(),
          });
        }

        // 2. Full synchronization: Get all cloud data
        if (url === '/api/sync' && req.method === 'GET') {
          return sendJson(res, 200, {
            events: db.events,
            tickets: db.tickets,
            accounts: db.accounts,
            payouts: db.payouts,
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
          saveDatabase(db);
          return sendJson(res, 200, {
            success: true,
            message: 'All database data (events, tickets, accounts, payouts) has been completely cleared.',
            eventsCount: 0,
            ticketsCount: 0,
            accountsCount: 0,
          });
        }

        // 3. Events endpoints
        if (url === '/api/events') {
          if (req.method === 'GET') {
            return sendJson(res, 200, db.events);
          }
          if (req.method === 'POST') {
            const newEvent = await parseBody(req);
            if (!newEvent || !newEvent.eventId) {
              return sendJson(res, 400, { error: 'Invalid event data' });
            }
            const existingIdx = db.events.findIndex((e) => e.eventId === newEvent.eventId);
            if (existingIdx >= 0) {
              db.events[existingIdx] = { ...db.events[existingIdx], ...newEvent, updatedAt: new Date().toISOString() };
            } else {
              db.events.unshift(newEvent);
            }
            saveDatabase(db);
            return sendJson(res, 200, { success: true, event: newEvent });
          }
        }

        if (url.startsWith('/api/events/')) {
          const eventId = url.replace('/api/events/', '').split('?')[0];
          if (req.method === 'PUT') {
            const updates = await parseBody(req);
            const idx = db.events.findIndex((e) => e.eventId === eventId);
            if (idx === -1) {
              return sendJson(res, 404, { error: 'Event not found' });
            }
            db.events[idx] = { ...db.events[idx], ...updates, updatedAt: new Date().toISOString() };
            saveDatabase(db);
            return sendJson(res, 200, { success: true, event: db.events[idx] });
          }
          if (req.method === 'DELETE') {
            db.events = db.events.filter((e) => e.eventId !== eventId);
            saveDatabase(db);
            return sendJson(res, 200, { success: true });
          }
        }

        // 4. Tickets endpoints
        if (url === '/api/tickets') {
          if (req.method === 'GET') {
            return sendJson(res, 200, db.tickets);
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
            saveDatabase(db);
            return sendJson(res, 200, { success: true, ticket: newTicket });
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
            db.tickets[idx] = { ...db.tickets[idx], ...updates };
            saveDatabase(db);
            return sendJson(res, 200, { success: true, ticket: db.tickets[idx] });
          }
        }

        // 5. Accounts endpoints
        if (url === '/api/accounts') {
          if (req.method === 'GET') {
            return sendJson(res, 200, db.accounts);
          }
          if (req.method === 'POST') {
            const account = await parseBody(req);
            if (!account || !account.email) {
              return sendJson(res, 400, { error: 'Invalid account data' });
            }
            const cleanEmail = account.email.toLowerCase().trim();
            const existingIdx = db.accounts.findIndex(
              (a) => a.email.toLowerCase().trim() === cleanEmail || a.uid === account.uid
            );
            if (existingIdx >= 0) {
              db.accounts[existingIdx] = { ...db.accounts[existingIdx], ...account };
            } else {
              db.accounts.push(account);
            }
            saveDatabase(db);
            return sendJson(res, 200, { success: true, account });
          }
        }

        // 6. Payouts endpoints
        if (url === '/api/payouts') {
          if (req.method === 'GET') {
            return sendJson(res, 200, db.payouts);
          }
          if (req.method === 'POST') {
            const payout = await parseBody(req);
            if (!payout || !payout.payoutId) {
              return sendJson(res, 400, { error: 'Invalid payout data' });
            }
            db.payouts.unshift(payout);
            saveDatabase(db);
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

        // 8. Razorpay Live Integration Endpoints
        if (url === '/api/razorpay/config' && req.method === 'GET') {
          return sendJson(res, 200, {
            keyId: RAZORPAY_KEY_ID,
            active: Boolean(RAZORPAY_KEY_ID),
          });
        }

        if (url === '/api/razorpay/create-order' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const amountInRupees = Number(body.amount) || 0;
            if (amountInRupees <= 0) {
              return sendJson(res, 400, { error: 'Amount must be greater than 0' });
            }

            const amountInPaise = Math.round(amountInRupees * 100);
            const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const notes = {
              eventId: String(body.eventId || ''),
              eventTitle: String(body.eventTitle || '').substring(0, 40),
              studentName: String(body.studentName || '').substring(0, 40),
              quantity: String(body.quantity || 1),
            };

            const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
            const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${basicAuth}`,
              },
              body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt,
                notes,
              }),
            });

            const rzpData: any = await rzpRes.json();
            if (!rzpRes.ok) {
              console.error('[Razorpay Order Error]', rzpData);
              return sendJson(res, rzpRes.status, {
                error: rzpData?.error?.description || 'Failed to create Razorpay live order',
              });
            }

            return sendJson(res, 200, {
              success: true,
              orderId: rzpData.id,
              amount: rzpData.amount,
              currency: rzpData.currency,
              keyId: RAZORPAY_KEY_ID,
              receipt,
            });
          } catch (err: any) {
            console.error('[Razorpay Create Order Exception]', err);
            return sendJson(res, 500, { error: err.message || 'Server error creating Razorpay order' });
          }
        }

        if (url === '/api/razorpay/verify-payment' && req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

            if (!razorpay_payment_id) {
              return sendJson(res, 400, { error: 'Missing razorpay_payment_id' });
            }

            // Cryptographic HMAC SHA256 Signature Verification
            let isSignatureValid = false;
            if (razorpay_order_id && razorpay_signature) {
              const expectedSignature = crypto
                .createHmac('sha256', RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest('hex');
              isSignatureValid = expectedSignature === razorpay_signature;
            }

            // Also check payment status directly with Razorpay Live API
            const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
            const paymentFetch = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
              headers: {
                Authorization: `Basic ${basicAuth}`,
              },
            });

            if (paymentFetch.ok) {
              const paymentInfo: any = await paymentFetch.json();
              const isCapturedOrAuthorized =
                paymentInfo.status === 'captured' || paymentInfo.status === 'authorized';

              return sendJson(res, 200, {
                success: true,
                verified: isCapturedOrAuthorized || isSignatureValid,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                status: paymentInfo.status,
                method: paymentInfo.method,
                amount: paymentInfo.amount / 100,
                vpa: paymentInfo.vpa || null,
                bank: paymentInfo.bank || null,
              });
            }

            // If direct payment fetch returned non-200, rely on cryptographic signature
            if (isSignatureValid) {
              return sendJson(res, 200, {
                success: true,
                verified: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
              });
            }

            return sendJson(res, 400, {
              success: false,
              verified: false,
              error: 'Invalid payment signature or unverified payment',
            });
          } catch (err: any) {
            console.error('[Razorpay Verification Exception]', err);
            return sendJson(res, 500, { error: err.message || 'Error verifying Razorpay payment' });
          }
        }

        // Fallback for unmatched API routes
        return sendJson(res, 404, { error: 'Endpoint not found' });
      });
    },
  };
}
