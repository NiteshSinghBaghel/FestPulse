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
      const client = new MongoClient(connectionUri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      await client.db(this.getDatabaseName()).command({ ping: 1 });
      this.client = client;
      this.db = client.db(this.getDatabaseName());
      this.connected = true;
      return { success: true, message: 'Connected to MongoDB Atlas.' };
    } catch (error: any) {
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
    const result = await this.connect();
    return result.success;
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
    const snapshot = await this.db!.collection('app_state').findOne({ _id: 'main' } as any);
    if (!snapshot) return null;
    return {
      events: Array.isArray(snapshot.events) ? snapshot.events : [],
      tickets: Array.isArray(snapshot.tickets) ? snapshot.tickets : [],
      accounts: Array.isArray(snapshot.accounts) ? snapshot.accounts : [],
      payouts: Array.isArray(snapshot.payouts) ? snapshot.payouts : [],
      payments: Array.isArray(snapshot.payments) ? snapshot.payments : [],
      razorpayConfig: snapshot.razorpayConfig,
      passwordResetTokens: snapshot.passwordResetTokens || {},
      hostPayoutProfiles: snapshot.hostPayoutProfiles || {},
      supabaseConfig: snapshot.supabaseConfig,
      flushedAt: snapshot.flushedAt,
    };
  }

  static async saveSnapshot(snapshot: MongoDatabaseSnapshot): Promise<boolean> {
    if (!(await this.ensureConnected())) return false;
    try {
      await this.db!.collection('app_state').updateOne(
        { _id: 'main' } as any,
        {
          $set: {
            ...snapshot,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return true;
    } catch (error: any) {
      console.warn('[MongoDB] Snapshot save failed:', error.message);
      return false;
    }
  }

  static async migrateSnapshot(snapshot: MongoDatabaseSnapshot): Promise<boolean> {
    return this.saveSnapshot(snapshot);
  }

  static async clearDatabase(): Promise<void> {
    if (!(await this.ensureConnected())) return;
    await this.db!.collection('app_state').deleteMany({});
  }
}
