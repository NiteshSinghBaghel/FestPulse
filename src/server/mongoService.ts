import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';

interface MongoDatabaseSnapshot {
  events: any[];
  tickets: any[];
  accounts: any[];
  payouts: any[];
  payments: any[];
  razorpayConfig?: any;
  passwordResetTokens?: Record<string, any>;
  hostPayoutProfiles?: Record<string, any>;
  supabaseConfig?: any;
  flushedAt?: number;
}

function readEnvValue(key: string): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const match = fs
        .readFileSync(envPath, 'utf8')
        .match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm'));
      if (match?.[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {}
  return (process.env[key] || '').trim();
}

export class MongoDbService {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;
  private static connected = false;
  private static lastFailureAt = 0;
  private static connectInFlight: Promise<boolean> | null = null;
  private static saveQueue: Promise<void> = Promise.resolve();

  static getConnected(): boolean {
    return this.connected && this.client !== null && this.db !== null;
  }

  static getUri(): string {
    return readEnvValue('MONGODB_URI');
  }

  static getDatabaseName(): string {
    return readEnvValue('MONGODB_DB_NAME') || 'festpulse';
  }

  static async connect(uri?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const connectionUri = (uri || this.getUri()).trim();
    if (!connectionUri) {
      return { success: false, error: 'MONGODB_URI is not configured.' };
    }

    try {
      if (this.client) {
        await this.disconnect();
      }
      const client = new MongoClient(connectionUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        tls: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true,
        retryWrites: true,
        retryReads: true,
      });
      await client.connect();
      await client.db(this.getDatabaseName()).command({ ping: 1 });
      this.client = client;
      this.db = client.db(this.getDatabaseName());
      this.connected = true;
      await this.ensureCollections(this.db);
      return { success: true, message: 'Connected to MongoDB Atlas.' };
    } catch (error: any) {
      if (this.client) {
        await this.client.close().catch(() => {});
      }
      this.client = null;
      this.db = null;
      this.connected = false;
      return { success: false, error: error.message || 'MongoDB connection failed.' };
    }
  }

  static async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {}
    }
    this.client = null;
    this.db = null;
    this.connected = false;
  }

  static async ensureConnected(): Promise<boolean> {
    if (this.getConnected()) return true;
    // Cooldown for 30s after a failed connection attempt so API requests (e.g. gate scan) stay instant
    if (this.lastFailureAt && Date.now() - this.lastFailureAt < 30000) {
      return false;
    }
    if (this.connectInFlight) {
      return this.connectInFlight;
    }
    this.connectInFlight = this.connect()
      .then((result) => {
        this.lastFailureAt = result.success ? 0 : Date.now();
        return result.success;
      })
      .finally(() => {
        this.connectInFlight = null;
      });
    return this.connectInFlight;
  }

  static async getStatus(): Promise<{ connected: boolean; database?: string; error?: string }> {
    if (!this.getConnected()) {
      return { connected: false };
    }
    try {
      await this.db!.command({ ping: 1 });
      return { connected: true, database: this.getDatabaseName() };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  static async hydrateAll(): Promise<MongoDatabaseSnapshot | null> {
    if (!this.getConnected()) return null;
    await this.dropLegacyCollection();

    const [events, tickets, accounts, payouts, payments, hostPayoutProfiles, settings] = await Promise.all([
      this.readCollection('events'),
      this.readCollection('tickets'),
      this.readCollection('accounts'),
      this.readCollection('payouts'),
      this.readCollection('payments'),
      this.readCollection('host_payout_profiles'),
      this.db!.collection('settings').findOne({ _id: 'main' } as any),
    ]);

    const hasData = events.length + tickets.length + accounts.length + payouts.length +
      payments.length + hostPayoutProfiles.length > 0 || Boolean(settings);
    if (!hasData) return null;

    return {
      events,
      tickets,
      accounts,
      payouts,
      payments,
      razorpayConfig: settings?.razorpayConfig,
      passwordResetTokens: settings?.passwordResetTokens || {},
      hostPayoutProfiles: Object.fromEntries(
        hostPayoutProfiles.map((profile: any) => [profile.hostId, profile])
      ),
      supabaseConfig: settings?.supabaseConfig,
      flushedAt: settings?.flushedAt,
    };
  }

  static async getEvents(): Promise<any[]> {
    if (!(await this.ensureConnected())) {
      throw new Error('MongoDB is not connected; unable to refresh events.');
    }
    await this.saveQueue;
    return this.readCollection('events');
  }

  static async saveSnapshot(snapshot: MongoDatabaseSnapshot): Promise<boolean> {
    const operation = this.saveQueue.then(async () => {
      if (!(await this.ensureConnected())) return false;
      try {
        await Promise.all([
          this.replaceCollection('events', snapshot.events, 'eventId'),
          this.replaceCollection('tickets', snapshot.tickets, 'ticketId'),
          this.replaceCollection('accounts', snapshot.accounts, 'uid', 'email'),
          this.replaceCollection('payouts', snapshot.payouts, 'payoutId'),
          this.replaceCollection('payments', snapshot.payments, 'paymentId'),
          this.replaceCollection(
            'host_payout_profiles',
            Object.entries(snapshot.hostPayoutProfiles || {}).map(([hostId, profile]) => ({
              ...profile,
              hostId: profile?.hostId || hostId,
            })),
            'hostId'
          ),
        ]);
        await this.db!.collection('settings').replaceOne(
          { _id: 'main' } as any,
          {
            _id: 'main',
            razorpayConfig: snapshot.razorpayConfig,
            passwordResetTokens: snapshot.passwordResetTokens || {},
            supabaseConfig: snapshot.supabaseConfig,
            flushedAt: snapshot.flushedAt,
            updatedAt: new Date(),
          },
          { upsert: true }
        );
        return true;
      } catch (error: any) {
        console.warn('[MongoDB] Collection save failed:', error.message);
        return false;
      }
    });
    this.saveQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  static async migrateSnapshot(snapshot: MongoDatabaseSnapshot): Promise<boolean> {
    return this.saveSnapshot(snapshot);
  }

  static async clearDatabase(): Promise<void> {
    if (!(await this.ensureConnected())) return;
    await Promise.all([
      'events',
      'tickets',
      'accounts',
      'payouts',
      'payments',
      'host_payout_profiles',
      'settings',
    ].map((name) => this.db!.collection(name).deleteMany({})));
  }

  private static async readCollection(name: string): Promise<any[]> {
    const records = await this.db!.collection(name).find({}).toArray();
    return records.map(({ _id, ...record }: any) => record);
  }

  private static async ensureCollections(db: Db): Promise<void> {
    const collectionNames = [
      'accounts',
      'events',
      'tickets',
      'payments',
      'payouts',
      'host_payout_profiles',
      'settings',
    ];
    for (const name of collectionNames) {
      try {
        await db.createCollection(name);
      } catch (error: any) {
        if (error.code !== 48 && error.codeName !== 'NamespaceExists') {
          throw error;
        }
      }
    }
  }

  private static async replaceCollection(
    name: string,
    records: any[],
    key: string,
    alternateKey?: string
  ): Promise<void> {
    const collection = this.db!.collection(name);
    const validRecords = (Array.isArray(records) ? records : []).filter(
      (record) => record && (record[key] || (alternateKey && record[alternateKey]))
    );
    if (validRecords.length > 0) {
      await collection.bulkWrite(
        validRecords.map((record) => {
          const identityKey = record[key] ? key : alternateKey!;
          const identity = record[identityKey];
          const { _id, ...document } = record;
          return {
            updateOne: {
              filter: { [identityKey]: identity },
              update: { $set: document },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
    }
    if (alternateKey) {
      const primaryIds = validRecords.filter((record) => record[key]).map((record) => record[key]);
      const alternateIds = validRecords.filter((record) => !record[key]).map((record) => record[alternateKey]);
      await collection.deleteMany({
        $and: [
          { [key]: { $nin: primaryIds } },
          { [alternateKey]: { $nin: alternateIds } },
        ],
      });
    } else {
      const identities = validRecords.map((record) => record[key]);
      await collection.deleteMany(
        identities.length > 0 ? { [key]: { $nin: identities } } : {}
      );
    }
  }

  private static async dropLegacyCollection(): Promise<void> {
    try {
      await this.db!.collection('app_state').drop();
    } catch (error: any) {
      if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
    }
  }
}
