import { DatabaseService } from './DatabaseService';
import { 
  Trip, 
  TripStatus, 
  TripPurpose, 
  Location as LocationType,
  Address 
} from '../types';

export class WebTripService {
  private databaseService: DatabaseService;
  private currentTrip: Trip | null = null;
  private tripCallbacks: ((trip: Trip) => void)[] = [];
  private locationTrackingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🌐 [WebTripService] Constructor - Web-compatible trip service');
    this.databaseService = new DatabaseService();
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🌐 [WebTripService] Initializing web trip service...');
      const dbSuccess = await this.databaseService.initialize();
      if (!dbSuccess) {
        console.error('❌ [WebTripService] Database initialization failed');
        return false;
      }
      console.log('✅ [WebTripService] Web trip service initialized');
      return true;
    } catch (error) {
      console.error('💥 [WebTripService] Error during initialization:', error);
      return false;
    }
  }

  // Subscribe to trip events
  onTripEvent(callback: (trip: Trip) => void): void {
    this.tripCallbacks.push(callback);
  }

  // Manual trip start (for web version)
  async startManualTrip(startLocation?: LocationType): Promise<Trip | null> {
    if (this.currentTrip) {
      console.warn('⚠️ [WebTripService] Trip already active');
      return null;
    }

    const location = startLocation || await this.getCurrentLocationWeb();
    if (!location) {
      console.error('❌ [WebTripService] Cannot start trip without location');
      return null;
    }

    const trip: Trip = {
      id: this.generateTripId(),
      startLocation: location,
      purpose: TripPurpose.UNTAGGED,
      status: TripStatus.ACTIVE,
      route: [location],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentTrip = trip;
    console.log('🚗 [WebTripService] Manual trip started:', trip.id);

    // Start continuous GPS tracking every 15 seconds
    this.startLocationTracking();

    // Notify subscribers
    this.tripCallbacks.forEach(callback => callback(trip));

    return trip;
  }

  // Manual trip end (for web version)
  async endManualTrip(endLocation?: LocationType, distance?: number): Promise<Trip | null> {
    if (!this.currentTrip || this.currentTrip.status !== TripStatus.ACTIVE) {
      console.warn('⚠️ [WebTripService] No active trip to end');
      return null;
    }

    const location = endLocation || await this.getCurrentLocationWeb();
    if (!location) {
      console.error('❌ [WebTripService] Cannot end trip without location');
      return null;
    }

    // Stop GPS tracking
    this.stopLocationTracking();

    // Calculate trip metrics using actual route waypoints
    const calculatedDistance = distance || this.calculateRouteDistance(this.currentTrip.route);

    // Update trip with end data
    this.currentTrip.endLocation = location;
    this.currentTrip.distance = calculatedDistance;
    this.currentTrip.duration = Date.now() - this.currentTrip.createdAt;
    this.currentTrip.status = TripStatus.ENDED;
    this.currentTrip.updatedAt = Date.now();

    // Add end location to route
    this.currentTrip.route.push(location);

    // Try to get addresses (will be limited on web without API keys)
    await this.addAddressesToTripWeb(this.currentTrip);

    console.log('🏁 [WebTripService] Trip ended:', this.currentTrip.id, `${(calculatedDistance / 1000).toFixed(1)} km`);

    // Notify subscribers
    const completedTrip = { ...this.currentTrip };
    this.tripCallbacks.forEach(callback => callback(completedTrip));

    // Save trip to database
    await this.saveTrip(this.currentTrip);

    this.currentTrip = null;
    return completedTrip;
  }

  private async getCurrentLocationWeb(): Promise<LocationType | null> {
    try {
      if (!navigator.geolocation) {
        console.error('❌ [WebTripService] Geolocation not supported');
        return null;
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location: LocationType = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: Date.now(),
              accuracy: position.coords.accuracy || undefined,
              speed: position.coords.speed || undefined,
            };
            resolve(location);
          },
          (error) => {
            console.error('❌ [WebTripService] Geolocation error:', error);
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      });
    } catch (error) {
      console.error('💥 [WebTripService] Error getting location:', error);
      return null;
    }
  }

  private startLocationTracking(): void {
    if (this.locationTrackingInterval) {
      clearInterval(this.locationTrackingInterval);
    }

    this.locationTrackingInterval = setInterval(async () => {
      if (!this.currentTrip || this.currentTrip.status !== TripStatus.ACTIVE) {
        this.stopLocationTracking();
        return;
      }

      const location = await this.getCurrentLocationWeb();
      if (location) {
        // Add to route if moved significantly (>10m from last point)
        const lastLocation = this.currentTrip.route[this.currentTrip.route.length - 1];
        const distance = this.calculateStraightLineDistance(
          lastLocation.latitude, lastLocation.longitude,
          location.latitude, location.longitude
        );
        
        if (distance > 10) { // Only add if moved more than 10 meters
          this.currentTrip.route.push(location);
          console.log(`📍 [WebTripService] Added waypoint: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);
        }
      }
    }, 15000); // Track every 15 seconds

    console.log('🛰️ [WebTripService] Started GPS tracking every 15s');
  }

  private stopLocationTracking(): void {
    if (this.locationTrackingInterval) {
      clearInterval(this.locationTrackingInterval);
      this.locationTrackingInterval = null;
      console.log('🛑 [WebTripService] Stopped GPS tracking');
    }
  }

  private calculateRouteDistance(route: LocationType[]): number {
    if (route.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const current = route[i];
      totalDistance += this.calculateStraightLineDistance(
        prev.latitude, prev.longitude,
        current.latitude, current.longitude
      );
    }
    
    console.log(`📏 [WebTripService] Route distance: ${(totalDistance / 1000).toFixed(1)}km from ${route.length} waypoints`);
    return totalDistance;
  }

  private async addAddressesToTripWeb(trip: Trip): Promise<void> {
    // For web version, we'd need to use a reverse geocoding API
    // For now, just create placeholder addresses based on coordinates
    try {
      trip.startAddress = {
        formatted: `${trip.startLocation.latitude.toFixed(4)}, ${trip.startLocation.longitude.toFixed(4)}`
      };

      if (trip.endLocation) {
        trip.endAddress = {
          formatted: `${trip.endLocation.latitude.toFixed(4)}, ${trip.endLocation.longitude.toFixed(4)}`
        };
      }
    } catch (error) {
      console.warn('⚠️ [WebTripService] Could not add addresses:', error);
    }
  }

  private calculateStraightLineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateTripId(): string {
    return `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveTrip(trip: Trip): Promise<void> {
    try {
      console.log(`💾 [WebTripService] Saving trip to database: ${trip.id}`);
      const success = await this.databaseService.saveTrip(trip);
      if (success) {
        console.log(`✅ [WebTripService] Trip saved successfully: ${trip.id}`);
      } else {
        console.error(`❌ [WebTripService] Failed to save trip: ${trip.id}`);
      }
    } catch (error) {
      console.error(`💥 [WebTripService] Error saving trip ${trip.id}:`, error);
    }
  }

  // Public methods for trip management
  async tagTrip(tripId: string, purpose: TripPurpose, note?: string): Promise<boolean> {
    try {
      console.log(`🏷️ [WebTripService] Tagging trip ${tripId} as ${purpose}`, note ? `with note: ${note}` : '');
      const success = await this.databaseService.updateTripPurpose(tripId, purpose, note);
      if (success) {
        console.log(`✅ [WebTripService] Trip tagged successfully: ${tripId}`);
      } else {
        console.error(`❌ [WebTripService] Failed to tag trip: ${tripId}`);
      }
      return success;
    } catch (error) {
      console.error(`💥 [WebTripService] Error tagging trip ${tripId}:`, error);
      return false;
    }
  }

  getCurrentTrip(): Trip | null {
    return this.currentTrip;
  }

  isCurrentlyTracking(): boolean {
    return this.currentTrip !== null;
  }

  // Database retrieval methods
  async getTrips(limit: number = 50, offset: number = 0): Promise<Trip[]> {
    try {
      return await this.databaseService.getTrips(limit, offset);
    } catch (error) {
      console.error(`💥 [WebTripService] Error retrieving trips:`, error);
      return [];
    }
  }

  async getTripById(tripId: string): Promise<Trip | null> {
    try {
      return await this.databaseService.getTripById(tripId);
    } catch (error) {
      console.error(`💥 [WebTripService] Error retrieving trip ${tripId}:`, error);
      return null;
    }
  }

  async deleteTrip(tripId: string): Promise<boolean> {
    try {
      return await this.databaseService.deleteTrip(tripId);
    } catch (error) {
      console.error(`💥 [WebTripService] Error deleting trip ${tripId}:`, error);
      return false;
    }
  }

  async getTripGpsPoints(tripId: string): Promise<LocationType[]> {
    try {
      // For web version, try to get GPS points from database first
      const gpsPoints = await this.databaseService.getTripGpsPoints(tripId);
      if (gpsPoints.length > 0) {
        return gpsPoints;
      }

      // Fallback: return the route points as GPS data
      const trip = await this.databaseService.getTripById(tripId);
      if (trip && trip.route) {
        console.log(`📍 [WebTripService] Using route points as GPS data for trip ${tripId} (${trip.route.length} points)`);
        return trip.route;
      }

      console.log(`⚠️ [WebTripService] No GPS data found for trip ${tripId}`);
      return [];
    } catch (error) {
      console.error(`💥 [WebTripService] Error retrieving GPS points for trip ${tripId}:`, error);
      return [];
    }
  }

  // Clean up resources
  async close(): Promise<void> {
    this.stopLocationTracking();
    await this.databaseService.close();
    this.currentTrip = null;
    console.log('🛑 [WebTripService] Service closed');
  }
}