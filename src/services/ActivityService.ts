import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import * as Location from 'expo-location';
import { ActivityType, ActivityEvent, Location as LocationType } from '../types';

export class ActivityService {
  private isMonitoring = false;
  private activityCallbacks: ((activity: ActivityEvent) => void)[] = [];
  private locationCallbacks: ((location: LocationType) => void)[] = [];
  
  // Motion and speed tracking
  private recentSpeeds: number[] = [];
  private motionData: DeviceMotionMeasurement[] = [];
  private locationSubscription: Location.LocationSubscription | null = null;
  
  constructor() {
    this.setupMotionDetection();
  }

  // Check and log current permission status for debugging
  private async logCurrentPermissionStatus(): Promise<void> {
    try {
      console.log('🔍 [ActivityService] Checking current permission status...');
      
      // Check foreground location permission
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      console.log('📍 [ActivityService] Current foreground location status:', JSON.stringify(foregroundStatus));
      
      // Check background location permission  
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      console.log('🔒 [ActivityService] Current background location status:', JSON.stringify(backgroundStatus));
      
      // Check if location services are enabled on device
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      console.log('🌍 [ActivityService] Location services enabled on device:', isLocationEnabled);
      
    } catch (error) {
      console.error('💥 [ActivityService] Error checking permission status:', error);
    }
  }

  // iOS-FRIENDLY permission strategy - single request with clear messaging  
  private async requestPermissionAggressively(
    type: 'foreground' | 'background',
    requestFunction: () => Promise<{ status: string }>
  ): Promise<boolean> {
    console.log(`🔄 [ActivityService] Requesting ${type} permission (iOS-friendly)...`);
    
    try {
      const result = await requestFunction();
      console.log(`📋 [ActivityService] Permission result for ${type}:`, JSON.stringify(result));
      
      if (result.status === 'granted') {
        console.log(`✅ [ActivityService] ${type} permission granted!`);
        return true;
      }
      
      // Log the specific denial reason
      console.warn(`⚠️ [ActivityService] ${type} permission denied:`, result.status);
      
      // Different messages based on permission type and status
      if (result.status === 'denied') {
        console.error(`❌ [ActivityService] ${type} permission permanently denied by user`);
      } else if (result.status === 'undetermined') {
        console.error(`❓ [ActivityService] ${type} permission undetermined - user hasn't decided yet`);
      } else {
        console.error(`⚠️ [ActivityService] ${type} permission status: ${result.status}`);
      }
      
      // Show user-friendly message
      const permissionName = type === 'foreground' ? 'Location Access' : 'Background Location';
      const settingsMessage = 
        `❌ ${permissionName.toUpperCase()} REQUIRED\n\n` +
        `Status: ${result.status}\n\n` +
        `Fahrbuch needs location access for German tax-compliant mileage tracking.\n\n` +
        `To enable:\n` +
        `1. Open iOS Settings\n` +
        `2. Find "Fahrbuch" app\n` +
        `3. Tap "Location"\n` +
        `4. Select "Always" (for background tracking)\n\n` +
        `The app will work once permissions are granted.`;
      
      console.error(`SETTINGS REQUIRED: ${settingsMessage}`);
      return false;
      
    } catch (error) {
      console.error(`💥 [ActivityService] Error requesting ${type} permission:`, error);
      console.error(`💥 [ActivityService] Error message:`, error.message);
      console.error(`💥 [ActivityService] Error stack:`, error.stack);
      
      // Permission API itself failed
      console.error(`💥 [ActivityService] Permission API failed for ${type} - this suggests a code issue`);
      return false;
    }
  }

  // Start monitoring device activity - iOS-FRIENDLY PERMISSION STRATEGY
  async startMonitoring(): Promise<boolean> {
    console.log('🔍 [ActivityService] Starting monitoring, checking current permissions...');
    
    try {
      // Check current permission status first
      await this.logCurrentPermissionStatus();
      
      // Request foreground permissions
      console.log('📍 [ActivityService] Requesting foreground location permissions...');
      const foregroundResult = await this.requestPermissionAggressively(
        'foreground', 
        () => Location.requestForegroundPermissionsAsync()
      );
      
      console.log('📍 [ActivityService] Foreground result:', foregroundResult);
      
      if (!foregroundResult) {
        console.log('❌ [ActivityService] Foreground permission denied - app cannot track location');
        return false; // Return false instead of throwing
      }

      console.log('🔒 [ActivityService] Requesting background location permissions...');
      const backgroundResult = await this.requestPermissionAggressively(
        'background',
        () => Location.requestBackgroundPermissionsAsync()
      );
      
      console.log('🔒 [ActivityService] Background result:', backgroundResult);
      
      if (!backgroundResult) {
        console.log('⚠️ [ActivityService] Background permission denied - trips may not auto-detect when app is closed');
        // Continue without background - app can still work in foreground
      }

      console.log('✅ [ActivityService] Permissions processed, starting services...');
    } catch (permissionError) {
      console.error('💥 [ActivityService] Permission error:', permissionError);
      return false; // Return false instead of throwing
    }

    try {

      // Start location tracking
      console.log('🌍 [ActivityService] Starting location tracking...');
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
        },
        this.handleLocationUpdate.bind(this)
      );
      console.log('✅ [ActivityService] Location tracking started');

      // Start motion sensor
      console.log('📱 [ActivityService] Starting motion sensor...');
      DeviceMotion.setUpdateInterval(1000); // 1 second
      DeviceMotion.addListener(this.handleMotionUpdate.bind(this));
      console.log('✅ [ActivityService] Motion sensor started');

      this.isMonitoring = true;
      console.log('✅ [ActivityService] Activity monitoring started successfully');
      return true;
    } catch (serviceError) {
      console.error('💥 [ActivityService] Failed to start activity monitoring services:', serviceError);
      console.error('💥 [ActivityService] Service error stack:', serviceError.stack);
      return false;
    }
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    
    DeviceMotion.removeAllListeners();
    this.recentSpeeds = [];
    this.motionData = [];
    
    console.log('Activity monitoring stopped');
  }

  // Subscribe to activity changes
  onActivityChange(callback: (activity: ActivityEvent) => void): void {
    this.activityCallbacks.push(callback);
  }

  // Subscribe to location updates
  onLocationChange(callback: (location: LocationType) => void): void {
    this.locationCallbacks.push(callback);
  }

  private setupMotionDetection(): void {
    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available) {
        console.warn('Device motion not available');
      }
    });
  }

  private handleLocationUpdate(locationData: Location.LocationObject): void {
    const location: LocationType = {
      latitude: locationData.coords.latitude,
      longitude: locationData.coords.longitude,
      timestamp: locationData.timestamp,
      accuracy: locationData.coords.accuracy || undefined,
      speed: locationData.coords.speed || undefined,
    };

    // Track speed for activity detection
    if (location.speed !== undefined) {
      this.recentSpeeds.push(location.speed * 3.6); // Convert m/s to km/h
      
      // Keep only last 10 speed readings (about 50 seconds)
      if (this.recentSpeeds.length > 10) {
        this.recentSpeeds.shift();
      }
    }

    // Notify location subscribers
    this.locationCallbacks.forEach(callback => callback(location));

    // Analyze activity based on speed and motion
    this.analyzeActivity();
  }

  private handleMotionUpdate(motionData: DeviceMotionMeasurement): void {
    if (!this.isMonitoring) return;

    // Store recent motion data
    this.motionData.push(motionData);
    
    // Keep only last 30 seconds of motion data (keep last 30 entries)
    if (this.motionData.length > 30) {
      this.motionData = this.motionData.slice(-30);
    }
  }

  private analyzeActivity(): void {
    const currentActivity = this.detectCurrentActivity();
    
    const activityEvent: ActivityEvent = {
      type: currentActivity.type,
      confidence: currentActivity.confidence,
      timestamp: Date.now(),
    };

    // Notify activity subscribers
    this.activityCallbacks.forEach(callback => callback(activityEvent));
  }

  private detectCurrentActivity(): { type: ActivityType; confidence: number } {
    // If we don't have enough data, return unknown
    if (this.recentSpeeds.length < 3) {
      return { type: ActivityType.UNKNOWN, confidence: 0.1 };
    }

    const averageSpeed = this.recentSpeeds.reduce((a, b) => a + b, 0) / this.recentSpeeds.length;
    const maxSpeed = Math.max(...this.recentSpeeds);

    // Analyze motion patterns
    const motionVariability = this.calculateMotionVariability();

    // Vehicle detection logic
    if (averageSpeed > 15 && maxSpeed > 25) {
      // High speed sustained = likely in vehicle
      const confidence = Math.min(0.9, 0.5 + (averageSpeed / 100));
      return { type: ActivityType.IN_VEHICLE, confidence };
    }
    
    if (averageSpeed > 8 && averageSpeed < 15 && motionVariability > 0.3) {
      // Medium speed with motion = possibly cycling
      return { type: ActivityType.ON_BICYCLE, confidence: 0.6 };
    }
    
    if (averageSpeed < 8 && averageSpeed > 3) {
      // Walking speed
      return { type: ActivityType.WALKING, confidence: 0.7 };
    }
    
    if (averageSpeed < 2) {
      // Stationary
      return { type: ActivityType.STILL, confidence: 0.8 };
    }

    return { type: ActivityType.UNKNOWN, confidence: 0.3 };
  }

  private calculateMotionVariability(): number {
    if (this.motionData.length < 5) return 0;

    // Calculate variability in accelerometer data
    const accelerations = this.motionData.map(data => {
      if (!data.acceleration) return 0;
      return Math.sqrt(
        Math.pow(data.acceleration.x, 2) +
        Math.pow(data.acceleration.y, 2) +
        Math.pow(data.acceleration.z, 2)
      );
    });

    const average = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - average, 2), 0) / accelerations.length;
    
    return Math.sqrt(variance);
  }

  // Utility method to check if currently in vehicle
  isCurrentlyInVehicle(): boolean {
    const activity = this.detectCurrentActivity();
    return activity.type === ActivityType.IN_VEHICLE && activity.confidence > 0.6;
  }

  // Get current speed in km/h
  getCurrentSpeed(): number {
    return this.recentSpeeds.length > 0 ? this.recentSpeeds[this.recentSpeeds.length - 1] : 0;
  }
}