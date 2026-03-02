import { Trip, TripPurpose } from '../types';

export class WebStorageService {
  private dbName = 'fahrbuch_db';
  private version = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<boolean> {
    try {
      console.log('🌐 [WebStorageService] Initializing IndexedDB...');
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          console.error('❌ [WebStorageService] Failed to open IndexedDB');
          resolve(false);
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          console.log('✅ [WebStorageService] IndexedDB initialized');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains('trips')) {
            const store = db.createObjectStore('trips', { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            console.log('🏗️ [WebStorageService] Created trips object store');
          }
        };
      });
    } catch (error) {
      console.error('💥 [WebStorageService] Error initializing:', error);
      return false;
    }
  }

  async saveTrip(trip: Trip): Promise<boolean> {
    if (!this.db) {
      console.error('❌ [WebStorageService] Database not initialized');
      return false;
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['trips'], 'readwrite');
        const store = transaction.objectStore('trips');
        const request = store.put(trip);

        request.onsuccess = () => {
          console.log(`✅ [WebStorageService] Trip saved: ${trip.id}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`❌ [WebStorageService] Failed to save trip: ${trip.id}`);
          resolve(false);
        };
      });
    } catch (error) {
      console.error(`💥 [WebStorageService] Error saving trip ${trip.id}:`, error);
      return false;
    }
  }

  async getTrips(limit: number = 50, offset: number = 0): Promise<Trip[]> {
    if (!this.db) {
      console.error('❌ [WebStorageService] Database not initialized');
      return [];
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['trips'], 'readonly');
        const store = transaction.objectStore('trips');
        const index = store.index('createdAt');
        const request = index.openCursor(null, 'prev'); // Newest first

        const trips: Trip[] = [];
        let count = 0;
        let skipped = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && count < limit) {
            if (skipped >= offset) {
              trips.push(cursor.value);
              count++;
            } else {
              skipped++;
            }
            cursor.continue();
          } else {
            console.log(`📋 [WebStorageService] Retrieved ${trips.length} trips`);
            resolve(trips);
          }
        };

        request.onerror = () => {
          console.error('❌ [WebStorageService] Failed to retrieve trips');
          resolve([]);
        };
      });
    } catch (error) {
      console.error('💥 [WebStorageService] Error retrieving trips:', error);
      return [];
    }
  }

  async getTripById(tripId: string): Promise<Trip | null> {
    if (!this.db) {
      console.error('❌ [WebStorageService] Database not initialized');
      return null;
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['trips'], 'readonly');
        const store = transaction.objectStore('trips');
        const request = store.get(tripId);

        request.onsuccess = () => {
          const trip = request.result;
          resolve(trip || null);
        };

        request.onerror = () => {
          console.error(`❌ [WebStorageService] Failed to retrieve trip: ${tripId}`);
          resolve(null);
        };
      });
    } catch (error) {
      console.error(`💥 [WebStorageService] Error retrieving trip ${tripId}:`, error);
      return null;
    }
  }

  async updateTripPurpose(tripId: string, purpose: TripPurpose, note?: string): Promise<boolean> {
    const trip = await this.getTripById(tripId);
    if (!trip) {
      console.warn(`⚠️ [WebStorageService] Trip not found: ${tripId}`);
      return false;
    }

    trip.purpose = purpose;
    if (note) trip.note = note;
    trip.updatedAt = Date.now();

    return await this.saveTrip(trip);
  }

  async deleteTrip(tripId: string): Promise<boolean> {
    if (!this.db) {
      console.error('❌ [WebStorageService] Database not initialized');
      return false;
    }

    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['trips'], 'readwrite');
        const store = transaction.objectStore('trips');
        const request = store.delete(tripId);

        request.onsuccess = () => {
          console.log(`🗑️ [WebStorageService] Trip deleted: ${tripId}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`❌ [WebStorageService] Failed to delete trip: ${tripId}`);
          resolve(false);
        };
      });
    } catch (error) {
      console.error(`💥 [WebStorageService] Error deleting trip ${tripId}:`, error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🌐 [WebStorageService] Database connection closed');
    }
  }
}