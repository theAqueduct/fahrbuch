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

  // AGGRESSIVE permission strategy - retry until granted
  private async requestPermissionAggressively(
    type: 'foreground' | 'background',
    requestFunction: () => Promise<{ status: string }>
  ): Promise<boolean> {
    const maxRetries = 5;
    let attempts = 0;
    
    while (attempts < maxRetries) {
      attempts++;
      
      const { status } = await requestFunction();
      
      if (status === 'granted') {
        return true;
      }
      
      // Permission denied - show critical message and retry
      const permissionName = type === 'foreground' ? 'Location Access' : 'Background Location';
      const criticalMessage = 
        `❗ FAHRBUCH CANNOT WORK WITHOUT ${permissionName.toUpperCase()}\n\n` +
        `German tax law requires automatic mileage tracking.\n` +
        `Without location access, you'll have to log trips manually.\n\n` +
        `Attempt ${attempts}/${maxRetries}\n\n` +
        `Please tap "Allow" to continue.`;
      
      // In a real app, you'd show a modal here
      console.error(`CRITICAL PERMISSION NEEDED: ${criticalMessage}`);
      
      // Add delay between retries
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Final attempt failed - show settings redirect message
    const settingsMessage = 
      `❌ PERMISSION REQUIRED\n\n` +
      `Fahrbuch requires location access to automatically track your drives.\n\n` +
      `Please:\n` +
      `1. Open Settings\n` +
      `2. Find Fahrbuch app\n` +
      `3. Enable Location permissions\n` +
      `4. Set to "Always" for background tracking\n\n` +
      `The app will restart when you return.`;
    
    console.error(`SETTINGS REDIRECT NEEDED: ${settingsMessage}`);
    return false;
  }

  // Start monitoring device activity - AGGRESSIVE PERMISSION STRATEGY
  async startMonitoring(): Promise<boolean> {
    // Critical permissions required - app cannot function without them
    const foregroundResult = await this.requestPermissionAggressively(
      'foreground', 
      () => Location.requestForegroundPermissionsAsync()
    );
    
    if (!foregroundResult) {
      throw new Error('CRITICAL: Location access required for mileage tracking');
    }

    const backgroundResult = await this.requestPermissionAggressively(
      'background',
      () => Location.requestBackgroundPermissionsAsync()
    );
    
    if (!backgroundResult) {
      throw new Error('CRITICAL: Background location required for automatic trip detection');
    }

    try {

      // Start location tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
        },
        this.handleLocationUpdate.bind(this)
      );

      // Start motion sensor
      DeviceMotion.setUpdateInterval(1000); // 1 second
      DeviceMotion.addListener(this.handleMotionUpdate.bind(this));

      this.isMonitoring = true;
      console.log('Activity monitoring started');
      return true;
    } catch (error) {
      console.error('Failed to start activity monitoring:', error);
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