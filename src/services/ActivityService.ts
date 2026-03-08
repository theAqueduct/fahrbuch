import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import * as Location from 'expo-location';
import { ActivityType, ActivityEvent, Location as LocationType } from '../types';

// Global debug logger that components can subscribe to
class DebugLogger {
  private listeners: ((message: string) => void)[] = [];
  
  addListener(callback: (message: string) => void) {
    this.listeners.push(callback);
  }
  
  log(message: string) {
    console.log(message);
    this.listeners.forEach(callback => callback(message));
  }
}

export const debugLogger = new DebugLogger();

export class ActivityService {
  private isMonitoring = false;
  private activityCallbacks: ((activity: ActivityEvent) => void)[] = [];
  private locationCallbacks: ((location: LocationType) => void)[] = [];
  
  // Motion and speed tracking
  private recentSpeeds: number[] = [];
  private motionData: DeviceMotionMeasurement[] = [];
  private locationSubscription: Location.LocationSubscription | null = null;
  
  constructor() {
    console.log('🏗️ [ActivityService] === CONSTRUCTOR CALLED ===');
    try {
      console.log('📱 [ActivityService] Setting up motion detection...');
      this.setupMotionDetection();
      console.log('✅ [ActivityService] Constructor completed successfully');
    } catch (error) {
      console.error('💀 [ActivityService] Constructor failed:', error);
      throw error;
    }
  }

  // Check and log current permission status for debugging
  private async logCurrentPermissionStatus(): Promise<void> {
    console.log('🔍 [ActivityService] === CHECKING PERMISSION STATUS ===');
    
    try {
      // Check foreground location permission
      console.log('📍 [ActivityService] Getting foreground permissions...');
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      console.log(`📍 [ActivityService] Foreground status: ${JSON.stringify(foregroundStatus)}`);
      
      // Check background location permission  
      console.log('🔒 [ActivityService] Getting background permissions...');
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      console.log(`🔒 [ActivityService] Background status: ${JSON.stringify(backgroundStatus)}`);
      
    } catch (error) {
      console.error(`💥 [ActivityService] Error checking permission status:`, error);
    }
  }

  // iOS-FRIENDLY permission strategy - single request with clear messaging  
  private async requestPermissionAggressively(
    type: 'foreground' | 'background',
    requestFunction: () => Promise<{ status: string }>
  ): Promise<boolean> {
    debugLogger.log(`🔄 [ActivityService] Requesting ${type} permission (iOS-friendly)...`);
    
    try {
      const result = await requestFunction();
      debugLogger.log(`📋 [ActivityService] Permission result for ${type}: ${JSON.stringify(result)}`);
      
      if (result.status === 'granted') {
        debugLogger.log(`✅ [ActivityService] ${type} permission granted!`);
        return true;
      }
      
      // Log the specific denial reason
      debugLogger.log(`⚠️ [ActivityService] ${type} permission denied: ${result.status}`);
      
      // Different messages based on permission type and status
      if (result.status === 'denied') {
        debugLogger.log(`❌ [ActivityService] ${type} permission permanently denied by user`);
      } else if (result.status === 'undetermined') {
        debugLogger.log(`❓ [ActivityService] ${type} permission undetermined - user hasn't decided yet`);
      } else {
        debugLogger.log(`⚠️ [ActivityService] ${type} permission status: ${result.status}`);
      }
      
      return false;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLogger.log(`💥 [ActivityService] Error requesting ${type} permission: ${errorMessage}`);
      debugLogger.log(`💥 [ActivityService] Permission API failed for ${type} - this suggests a code issue`);
      return false;
    }
  }

  // Start monitoring device activity - COMPLETELY REWRITTEN WITH STEP-BY-STEP LOGGING
  async startMonitoring(): Promise<boolean> {
    console.log('🚀 [ActivityService] === START MONITORING CALLED ===');
    
    try {
      console.log('🔍 [ActivityService] Step 1: Checking current permissions...');
      await this.logCurrentPermissionStatus();
      
      debugLogger.log('📍 [ActivityService] Step 2: Requesting foreground location permissions...');
      const foregroundResult = await this.requestPermissionAggressively(
        'foreground', 
        () => Location.requestForegroundPermissionsAsync()
      );
      
      debugLogger.log(`📍 [ActivityService] Step 3: Foreground result: ${foregroundResult}`);
      
      if (!foregroundResult) {
        debugLogger.log('❌ [ActivityService] Step 4: Foreground permission denied - CANNOT CONTINUE');
        return false;
      }

      debugLogger.log('🔒 [ActivityService] Step 5: Requesting background location permissions...');
      const backgroundResult = await this.requestPermissionAggressively(
        'background',
        () => Location.requestBackgroundPermissionsAsync()
      );
      
      debugLogger.log(`🔒 [ActivityService] Step 6: Background result: ${backgroundResult}`);
      
      if (!backgroundResult) {
        debugLogger.log('⚠️ [ActivityService] Step 7: Background denied but continuing with foreground-only');
      }

      debugLogger.log('✅ [ActivityService] Step 8: Permissions OK, starting location tracking...');
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
        },
        this.handleLocationUpdate.bind(this)
      );
      debugLogger.log('✅ [ActivityService] Step 9: Location tracking started successfully');

      debugLogger.log('📱 [ActivityService] Step 10: Starting motion sensor...');
      DeviceMotion.setUpdateInterval(1000); // 1 second
      DeviceMotion.addListener(this.handleMotionUpdate.bind(this));
      debugLogger.log('✅ [ActivityService] Step 11: Motion sensor started successfully');

      this.isMonitoring = true;
      debugLogger.log('🎉 [ActivityService] Step 12: === MONITORING STARTED SUCCESSFULLY ===');
      return true;
      
    } catch (error) {
      debugLogger.log(`💀 [ActivityService] === CRITICAL ERROR OCCURRED ===`);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      debugLogger.log(`💀 [ActivityService] Error message: ${errorObj.message || 'No message'}`);
      debugLogger.log(`💀 [ActivityService] Error name: ${errorObj.name || 'No name'}`);
      debugLogger.log(`💀 [ActivityService] Error toString: ${errorObj.toString() || 'Cannot convert to string'}`);
      if (errorObj.stack) {
        debugLogger.log(`💀 [ActivityService] Stack (first 300 chars): ${errorObj.stack.substring(0, 300)}...`);
      }
      debugLogger.log(`💀 [ActivityService] === RETURNING FALSE DUE TO ERROR ===`);
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