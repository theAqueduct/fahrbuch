import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ActivityService } from './ActivityService';
import { 
  Trip, 
  TripStatus, 
  TripPurpose, 
  ActivityType, 
  ActivityEvent, 
  Location as LocationType,
  Address 
} from '../types';

export class TripService {
  private activityService: ActivityService;
  private currentTrip: Trip | null = null;
  private isTracking = false;
  private tripCallbacks: ((trip: Trip) => void)[] = [];
  
  // Trip detection state
  private vehicleActivityCount = 0;
  private stationaryCount = 0;
  private lastSignificantLocation: LocationType | null = null;

  constructor() {
    this.activityService = new ActivityService();
    this.setupNotifications();
    this.setupActivityMonitoring();
  }

  async initialize(): Promise<boolean> {
    console.log('🚀 [TripService] Initialize called');
    
    try {
      // AGGRESSIVE: Request notification permissions first
      console.log('📢 [TripService] Requesting notification permissions...');
      await this.requestNotificationPermissionsAggressively();
      console.log('✅ [TripService] Notification permissions done');
      
      console.log('📍 [TripService] Starting ActivityService monitoring...');
      const success = await this.activityService.startMonitoring();
      console.log('📍 [TripService] ActivityService monitoring result:', success);
      
      if (success) {
        this.isTracking = true;
        console.log('✅ [TripService] TripService initialized and tracking started');
      } else {
        console.log('❌ [TripService] ActivityService monitoring failed');
      }
      
      return success;
    } catch (error) {
      console.error('💥 [TripService] Error during initialization:', error);
      console.error('💥 [TripService] Error stack:', error.stack);
      return false;
    }
  }

  // iOS-FRIENDLY notification permission strategy
  private async requestNotificationPermissionsAggressively(): Promise<void> {
    try {
      console.log('🔔 [TripService] Requesting notification permissions...');
      
      const result = await Notifications.requestPermissionsAsync();
      console.log('🔔 [TripService] Notification permission result:', JSON.stringify(result));
      
      if (result.status === 'granted') {
        console.log('✅ [TripService] Notification permissions granted');
        return;
      }
      
      // Log specific denial reason
      console.warn(`⚠️ [TripService] Notification permission denied: ${result.status}`);
      
      // Show user-friendly message
      const message = 
        `🔔 NOTIFICATIONS RECOMMENDED\n\n` +
        `Status: ${result.status}\n\n` +
        `Notifications help you:\n` +
        `• Get alerted when trips end\n` +
        `• Tag trips immediately for accuracy\n` +
        `• Maintain complete mileage logs\n\n` +
        `You can enable in Settings > Notifications > Fahrbuch later.`;
      
      console.warn(`NOTIFICATION INFO: ${message}`);
      
    } catch (error) {
      console.error('💥 [TripService] Failed to request notification permissions:', error);
      console.error('💥 [TripService] Notification error details:', error.message, error.stack);
    }
  }

  stop(): void {
    this.activityService.stopMonitoring();
    this.isTracking = false;
    if (this.currentTrip && this.currentTrip.status === TripStatus.ACTIVE) {
      this.endCurrentTrip();
    }
  }

  // Subscribe to trip events
  onTripEvent(callback: (trip: Trip) => void): void {
    this.tripCallbacks.push(callback);
  }

  private setupNotifications(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  private setupActivityMonitoring(): void {
    // Monitor activity changes
    this.activityService.onActivityChange((activity: ActivityEvent) => {
      this.handleActivityChange(activity);
    });

    // Monitor location changes
    this.activityService.onLocationChange((location: LocationType) => {
      this.handleLocationUpdate(location);
    });
  }

  private handleActivityChange(activity: ActivityEvent): void {
    console.log(`Activity detected: ${activity.type} (confidence: ${activity.confidence})`);

    if (activity.type === ActivityType.IN_VEHICLE && activity.confidence > 0.6) {
      this.vehicleActivityCount++;
      this.stationaryCount = 0; // Reset stationary counter

      // Start trip if we detect sustained vehicle activity
      if (this.vehicleActivityCount >= 3 && !this.currentTrip) {
        this.startTrip();
      }
    } else if (activity.type === ActivityType.STILL) {
      this.stationaryCount++;
      this.vehicleActivityCount = 0; // Reset vehicle counter

      // End trip if stationary for too long
      if (this.stationaryCount >= 6 && this.currentTrip) { // 30 seconds of being still
        this.endCurrentTrip();
      }
    } else {
      // Reset counters for other activities
      this.vehicleActivityCount = Math.max(0, this.vehicleActivityCount - 1);
      this.stationaryCount = Math.max(0, this.stationaryCount - 1);
    }
  }

  private handleLocationUpdate(location: LocationType): void {
    // Update current trip if active
    if (this.currentTrip && this.currentTrip.status === TripStatus.ACTIVE) {
      this.updateCurrentTrip(location);
    }

    // Track significant location changes
    if (this.isSignificantLocationChange(location)) {
      this.lastSignificantLocation = location;
    }
  }

  private isSignificantLocationChange(location: LocationType): boolean {
    if (!this.lastSignificantLocation) return true;

    const distance = this.calculateDistance(
      this.lastSignificantLocation.latitude,
      this.lastSignificantLocation.longitude,
      location.latitude,
      location.longitude
    );

    return distance > 50; // 50 meters
  }

  private async startTrip(): Promise<void> {
    if (this.currentTrip) return; // Already have active trip

    const currentLocation = await this.getCurrentLocation();
    if (!currentLocation) return;

    const trip: Trip = {
      id: this.generateTripId(),
      startLocation: currentLocation,
      purpose: TripPurpose.UNTAGGED,
      status: TripStatus.ACTIVE,
      route: [currentLocation],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentTrip = trip;
    console.log('Trip started:', trip.id);

    // Notify subscribers
    this.tripCallbacks.forEach(callback => callback(trip));
  }

  private async endCurrentTrip(): Promise<void> {
    if (!this.currentTrip || this.currentTrip.status !== TripStatus.ACTIVE) return;

    const currentLocation = await this.getCurrentLocation();
    if (!currentLocation) return;

    // Calculate trip metrics
    const startLoc = this.currentTrip.startLocation;
    const distance = this.calculateDistance(
      startLoc.latitude,
      startLoc.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    // Only save trips longer than 500m
    if (distance < 500) {
      console.log('Trip too short, discarding');
      this.currentTrip = null;
      return;
    }

    // Update trip with end data
    this.currentTrip.endLocation = currentLocation;
    this.currentTrip.distance = distance;
    this.currentTrip.duration = Date.now() - this.currentTrip.createdAt;
    this.currentTrip.status = TripStatus.ENDED;
    this.currentTrip.updatedAt = Date.now();

    // Add end location to route
    this.currentTrip.route.push(currentLocation);

    // Reverse geocode addresses
    await this.addAddressesToTrip(this.currentTrip);

    console.log('Trip ended:', this.currentTrip.id, `${(distance / 1000).toFixed(1)} km`);

    // Send notification for tagging
    await this.sendTripEndNotification(this.currentTrip);

    // Notify subscribers
    const completedTrip = { ...this.currentTrip };
    this.tripCallbacks.forEach(callback => callback(completedTrip));

    // Save trip (would normally save to local DB)
    await this.saveTrip(this.currentTrip);

    this.currentTrip = null;
  }

  private updateCurrentTrip(location: LocationType): void {
    if (!this.currentTrip) return;

    // Add to route if significant location change
    if (this.isSignificantLocationChange(location)) {
      this.currentTrip.route.push(location);
      this.currentTrip.updatedAt = Date.now();
    }
  }

  private async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy || undefined,
        speed: location.coords.speed || undefined,
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  private async addAddressesToTrip(trip: Trip): Promise<void> {
    try {
      // Reverse geocode start location
      const startAddress = await Location.reverseGeocodeAsync({
        latitude: trip.startLocation.latitude,
        longitude: trip.startLocation.longitude,
      });

      if (startAddress.length > 0) {
        const addr = startAddress[0];
        trip.startAddress = {
          street: addr.street || undefined,
          city: addr.city || undefined,
          postalCode: addr.postalCode || undefined,
          country: addr.country || undefined,
          formatted: this.formatAddress(addr),
        };
      }

      // Reverse geocode end location
      if (trip.endLocation) {
        const endAddress = await Location.reverseGeocodeAsync({
          latitude: trip.endLocation.latitude,
          longitude: trip.endLocation.longitude,
        });

        if (endAddress.length > 0) {
          const addr = endAddress[0];
          trip.endAddress = {
            street: addr.street || undefined,
            city: addr.city || undefined,
            postalCode: addr.postalCode || undefined,
            country: addr.country || undefined,
            formatted: this.formatAddress(addr),
          };
        }
      }
    } catch (error) {
      console.error('Failed to reverse geocode addresses:', error);
    }
  }

  private formatAddress(addr: Location.LocationGeocodedAddress): string {
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.postalCode) parts.push(addr.postalCode);
    return parts.join(', ') || 'Unknown Location';
  }

  private async sendTripEndNotification(trip: Trip): Promise<void> {
    const startAddr = trip.startAddress?.formatted || 'Unknown';
    const endAddr = trip.endAddress?.formatted || 'Unknown';
    const distance = trip.distance ? (trip.distance / 1000).toFixed(1) : '0';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📍 Trip recorded',
        body: `${startAddr} → ${endAddr}, ${distance} km`,
        data: { tripId: trip.id },
        categoryIdentifier: 'tripTagging',
      },
      trigger: null, // Send immediately
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
    // In a real app, this would save to SQLite
    console.log('Saving trip to local storage:', trip.id);
    // TODO: Implement SQLite storage
  }

  // Public methods for trip management
  async tagTrip(tripId: string, purpose: TripPurpose, note?: string): Promise<void> {
    // In a real app, would update in database
    console.log(`Tagged trip ${tripId} as ${purpose}`, note ? `with note: ${note}` : '');
  }

  getCurrentTrip(): Trip | null {
    return this.currentTrip;
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}