import { Platform } from 'react-native';
import { WebStorageService } from './WebStorageService';
import { Trip, TripPurpose, TripStatus, Location, Address } from '../types';

// Conditionally import SQLite only for native platforms
let SQLite: any;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

export class DatabaseService {
  private db: any | null = null;
  private webStorage: WebStorageService | null = null;
  private isWeb: boolean;

  constructor() {
    this.isWeb = Platform.OS === 'web';
    if (this.isWeb) {
      this.webStorage = new WebStorageService();
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.isWeb) {
        console.log('🌐 [DatabaseService] Initializing web storage...');
        return await this.webStorage!.initialize();
      } else {
        console.log('🗄️ [DatabaseService] Initializing SQLite database...');
        
        this.db = await SQLite.openDatabaseAsync('fahrbuch.db');
        
        await this.createTables();
        console.log('✅ [DatabaseService] Database initialized successfully');
        return true;
      }
    } catch (error) {
      console.error('💥 [DatabaseService] Failed to initialize database:', error);
      return false;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const createTripsTable = `
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        start_latitude REAL NOT NULL,
        start_longitude REAL NOT NULL,
        start_timestamp INTEGER NOT NULL,
        start_accuracy REAL,
        start_speed REAL,
        end_latitude REAL,
        end_longitude REAL,
        end_timestamp INTEGER,
        end_accuracy REAL,
        end_speed REAL,
        start_address_street TEXT,
        start_address_city TEXT,
        start_address_postal_code TEXT,
        start_address_country TEXT,
        start_address_formatted TEXT,
        end_address_street TEXT,
        end_address_city TEXT,
        end_address_postal_code TEXT,
        end_address_country TEXT,
        end_address_formatted TEXT,
        purpose TEXT NOT NULL DEFAULT 'untagged',
        status TEXT NOT NULL,
        distance REAL,
        duration INTEGER,
        route_json TEXT,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `;

    const createGpsPointsTable = `
      CREATE TABLE IF NOT EXISTS trip_gps_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        accuracy REAL,
        speed REAL,
        heading REAL,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      )
    `;

    try {
      await this.db.execAsync(createTripsTable);
      await this.db.execAsync(createGpsPointsTable);
      console.log('✅ Tables created successfully');
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  async saveTrip(trip: Trip): Promise<boolean> {
    if (this.isWeb) {
      return await this.webStorage!.saveTrip(trip);
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return false;
    }

    const insertSQL = `
      INSERT OR REPLACE INTO trips (
        id, start_latitude, start_longitude, start_timestamp, start_accuracy, start_speed,
        end_latitude, end_longitude, end_timestamp, end_accuracy, end_speed,
        start_address_street, start_address_city, start_address_postal_code, 
        start_address_country, start_address_formatted,
        end_address_street, end_address_city, end_address_postal_code,
        end_address_country, end_address_formatted,
        purpose, status, distance, duration, route_json, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      trip.id,
      trip.startLocation.latitude,
      trip.startLocation.longitude,
      trip.startLocation.timestamp,
      trip.startLocation.accuracy || null,
      trip.startLocation.speed || null,
      trip.endLocation?.latitude || null,
      trip.endLocation?.longitude || null,
      trip.endLocation?.timestamp || null,
      trip.endLocation?.accuracy || null,
      trip.endLocation?.speed || null,
      trip.startAddress?.street || null,
      trip.startAddress?.city || null,
      trip.startAddress?.postalCode || null,
      trip.startAddress?.country || null,
      trip.startAddress?.formatted || null,
      trip.endAddress?.street || null,
      trip.endAddress?.city || null,
      trip.endAddress?.postalCode || null,
      trip.endAddress?.country || null,
      trip.endAddress?.formatted || null,
      trip.purpose,
      trip.status,
      trip.distance || null,
      trip.duration || null,
      JSON.stringify(trip.route),
      trip.note || null,
      trip.createdAt,
      trip.updatedAt,
    ];

    try {
      await this.db.runAsync(insertSQL, values);
      console.log(`✅ Trip saved: ${trip.id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save trip ${trip.id}:`, error);
      return false;
    }
  }

  async getTrips(limit: number = 50, offset: number = 0): Promise<Trip[]> {
    if (this.isWeb) {
      return await this.webStorage!.getTrips(limit, offset);
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return [];
    }

    const selectSQL = `
      SELECT * FROM trips 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    try {
      const result = await this.db.getAllAsync(selectSQL, [limit, offset]);
      const trips: Trip[] = result.map((row: any) => this.rowToTrip(row));
      console.log(`📋 Retrieved ${trips.length} trips from database`);
      return trips;
    } catch (error) {
      console.error('Failed to fetch trips:', error);
      return [];
    }
  }

  async getTripById(tripId: string): Promise<Trip | null> {
    if (this.isWeb) {
      return await this.webStorage!.getTripById(tripId);
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return null;
    }

    try {
      const result = await this.db.getFirstAsync('SELECT * FROM trips WHERE id = ?', [tripId]);
      if (!result) {
        return null;
      }
      return this.rowToTrip(result);
    } catch (error) {
      console.error(`Failed to fetch trip ${tripId}:`, error);
      return null;
    }
  }

  async updateTripPurpose(tripId: string, purpose: TripPurpose, note?: string): Promise<boolean> {
    if (this.isWeb) {
      return await this.webStorage!.updateTripPurpose(tripId, purpose, note);
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return false;
    }

    const updateSQL = `
      UPDATE trips 
      SET purpose = ?, note = ?, updated_at = ?
      WHERE id = ?
    `;

    try {
      const result = await this.db.runAsync(updateSQL, [purpose, note || null, Date.now(), tripId]);
      if (result.changes > 0) {
        console.log(`✅ Trip ${tripId} tagged as ${purpose}`);
        return true;
      } else {
        console.warn(`⚠️ No trip found with id ${tripId}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to update trip ${tripId}:`, error);
      return false;
    }
  }

  async deleteTrip(tripId: string): Promise<boolean> {
    if (this.isWeb) {
      return await this.webStorage!.deleteTrip(tripId);
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return false;
    }

    try {
      const result = await this.db.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
      if (result.changes > 0) {
        console.log(`🗑️ Trip ${tripId} deleted`);
        return true;
      } else {
        console.warn(`⚠️ No trip found with id ${tripId}`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to delete trip ${tripId}:`, error);
      return false;
    }
  }

  private rowToTrip(row: any): Trip {
    const startLocation: Location = {
      latitude: row.start_latitude,
      longitude: row.start_longitude,
      timestamp: row.start_timestamp,
      accuracy: row.start_accuracy || undefined,
      speed: row.start_speed || undefined,
    };

    const endLocation: Location | undefined = row.end_latitude && row.end_longitude ? {
      latitude: row.end_latitude,
      longitude: row.end_longitude,
      timestamp: row.end_timestamp,
      accuracy: row.end_accuracy || undefined,
      speed: row.end_speed || undefined,
    } : undefined;

    const startAddress: Address | undefined = row.start_address_formatted ? {
      street: row.start_address_street || undefined,
      city: row.start_address_city || undefined,
      postalCode: row.start_address_postal_code || undefined,
      country: row.start_address_country || undefined,
      formatted: row.start_address_formatted,
    } : undefined;

    const endAddress: Address | undefined = row.end_address_formatted ? {
      street: row.end_address_street || undefined,
      city: row.end_address_city || undefined,
      postalCode: row.end_address_postal_code || undefined,
      country: row.end_address_country || undefined,
      formatted: row.end_address_formatted,
    } : undefined;

    let route: Location[] = [];
    try {
      if (row.route_json) {
        route = JSON.parse(row.route_json);
      }
    } catch (error) {
      console.warn(`Failed to parse route for trip ${row.id}:`, error);
      route = [startLocation];
      if (endLocation) route.push(endLocation);
    }

    return {
      id: row.id,
      startLocation,
      endLocation,
      startAddress,
      endAddress,
      purpose: row.purpose as TripPurpose,
      status: row.status as TripStatus,
      distance: row.distance || undefined,
      duration: row.duration || undefined,
      route,
      note: row.note || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async saveGpsPoint(tripId: string, location: Location): Promise<boolean> {
    if (this.isWeb) {
      // TODO: Implement GPS points in web storage
      console.log('⚠️ GPS points not yet implemented for web storage');
      return true;
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return false;
    }

    const insertSQL = `
      INSERT INTO trip_gps_points (
        trip_id, latitude, longitude, timestamp, accuracy, speed, heading
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      tripId,
      location.latitude,
      location.longitude,
      location.timestamp,
      location.accuracy || null,
      location.speed || null,
      location.heading || null
    ];

    try {
      await this.db.runAsync(insertSQL, values);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save GPS point for trip ${tripId}:`, error);
      return false;
    }
  }

  async getTripGpsPoints(tripId: string): Promise<Location[]> {
    if (this.isWeb) {
      // TODO: Implement GPS points in web storage
      console.log('⚠️ GPS points not yet implemented for web storage');
      return [];
    }

    if (!this.db) {
      console.error('❌ [DatabaseService] Database not initialized');
      return [];
    }

    const selectSQL = `
      SELECT * FROM trip_gps_points 
      WHERE trip_id = ? 
      ORDER BY timestamp ASC
    `;

    try {
      const result = await this.db.getAllAsync(selectSQL, [tripId]);
      const gpsPoints: Location[] = result.map((row: any) => ({
        latitude: row.latitude,
        longitude: row.longitude,
        timestamp: row.timestamp,
        accuracy: row.accuracy || undefined,
        speed: row.speed || undefined,
        heading: row.heading || undefined,
      }));
      console.log(`📍 Retrieved ${gpsPoints.length} GPS points for trip ${tripId}`);
      return gpsPoints;
    } catch (error) {
      console.error(`Failed to fetch GPS points for trip ${tripId}:`, error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.isWeb) {
      await this.webStorage!.close();
    } else if (this.db) {
      // Note: expo-sqlite doesn't have explicit close method
      // The database will be closed automatically when the app is closed
      this.db = null;
      console.log('🗄️ Database connection closed');
    }
  }
}