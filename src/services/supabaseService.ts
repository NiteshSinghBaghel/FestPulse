import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CollegeEvent, Ticket, RegisteredAccount } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

const SUPABASE_STORAGE_KEY = 'campuspass_supabase_config_v1';

class SupabaseServiceManager {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig = {
    url: '',
    anonKey: '',
    enabled: false,
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = parsed;
        if (this.config.enabled && this.config.url && this.config.anonKey) {
          this.client = createClient(this.config.url, this.config.anonKey);
        }
      }
    } catch (e) {
      console.warn('Supabase local config error:', e);
    }

    // Also fetch remote server-persisted supabase config
    this.fetchRemoteConfig();
  }

  public async fetchRemoteConfig(): Promise<SupabaseConfig> {
    try {
      const res = await fetch('/api/supabase-config');
      if (res.ok) {
        const remoteConfig = await res.json();
        if (remoteConfig?.url && remoteConfig?.anonKey) {
          this.config = remoteConfig;
          localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(remoteConfig));
          if (remoteConfig.enabled) {
            this.client = createClient(remoteConfig.url, remoteConfig.anonKey);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch remote Supabase config:', err);
    }
    return this.config;
  }

  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public isConnected(): boolean {
    return Boolean(this.config.enabled && this.client);
  }

  public async updateConfig(newConfig: SupabaseConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (newConfig.enabled) {
        if (!newConfig.url.startsWith('https://')) {
          return { success: false, error: 'Supabase URL must start with https://' };
        }
        if (!newConfig.anonKey || newConfig.anonKey.length < 20) {
          return { success: false, error: 'Please enter a valid Supabase Anon Public Key.' };
        }

        // Test connection
        const testClient = createClient(newConfig.url, newConfig.anonKey);
        this.client = testClient;
      } else {
        this.client = null;
      }

      this.config = newConfig;
      localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(newConfig));

      // Persist to server API database so all other devices share this configuration
      await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      }).catch((e) => console.warn('Sync supabase config to API error:', e));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to initialize Supabase client.' };
    }
  }

  // ================= EVENTS =================
  public async syncEvent(event: CollegeEvent): Promise<boolean> {
    if (!this.client || !this.config.enabled) return false;
    try {
      const { error } = await this.client
        .from('events')
        .upsert(
          {
            event_id: event.eventId,
            title: event.title,
            category: event.category,
            capacity: event.capacity,
            available_tickets: event.availableTickets,
            tickets_sold: event.ticketsSold,
            ticket_price: event.price,
            host_id: event.hostId,
            host_name: event.hostName,
            status: event.status,
            date: event.date,
            start_time: event.startTime,
            venue: event.venue,
            raw_data: event,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'event_id' }
        );
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase syncEvent error:', err);
      return false;
    }
  }

  public async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.client || !this.config.enabled) return false;
    try {
      const { error } = await this.client.from('events').delete().eq('event_id', eventId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase deleteEvent error:', err);
      return false;
    }
  }

  public async fetchEvents(): Promise<CollegeEvent[]> {
    if (!this.client || !this.config.enabled) return [];
    try {
      const { data, error } = await this.client.from('events').select('*');
      if (error || !data) return [];
      return data.map((row: any) => row.raw_data || row);
    } catch (err) {
      console.warn('Supabase fetchEvents error:', err);
      return [];
    }
  }

  // ================= TICKETS =================
  public async syncTicket(ticket: Ticket): Promise<boolean> {
    if (!this.client || !this.config.enabled) return false;
    try {
      const { error } = await this.client
        .from('tickets')
        .upsert(
          {
            ticket_id: ticket.ticketId,
            event_id: ticket.eventId,
            user_id: ticket.userId,
            user_name: ticket.userName,
            user_email: ticket.userEmail,
            entry_status: ticket.entryStatus,
            entry_time: ticket.entryTime,
            status: ticket.status,
            raw_data: ticket,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'ticket_id' }
        );
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase syncTicket error:', err);
      return false;
    }
  }

  public async fetchTickets(): Promise<Ticket[]> {
    if (!this.client || !this.config.enabled) return [];
    try {
      const { data, error } = await this.client.from('tickets').select('*');
      if (error || !data) return [];
      return data.map((row: any) => row.raw_data || row);
    } catch (err) {
      console.warn('Supabase fetchTickets error:', err);
      return [];
    }
  }
}

export const SupabaseService = new SupabaseServiceManager();
