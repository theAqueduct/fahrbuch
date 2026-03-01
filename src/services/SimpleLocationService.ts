import * as Location from 'expo-location';

export class SimpleLocationService {
  private hasPermission = false;
  
  async requestPermission(): Promise<boolean> {
    try {
      // Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        this.hasPermission = true;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }
  
  async getCurrentLocation() {
    if (!this.hasPermission) {
      throw new Error('Location permission not granted');
    }
    
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Get location error:', error);
      throw error;
    }
  }
  
  hasLocationPermission(): boolean {
    return this.hasPermission;
  }
}