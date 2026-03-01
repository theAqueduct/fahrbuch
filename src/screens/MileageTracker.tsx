import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SimpleLocationService } from '../services/SimpleLocationService';

interface Trip {
  id: string;
  startTime: Date;
  startLocation: { lat: number; lng: number };
  endTime?: Date;
  endLocation?: { lat: number; lng: number };
  distance?: number;
  status: 'active' | 'completed';
  purpose?: 'business' | 'private' | 'commute';
}

export default function MileageTracker() {
  const [locationService] = useState(() => new SimpleLocationService());
  const [hasPermission, setHasPermission] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeLocationService();
  }, []);

  const initializeLocationService = async () => {
    const granted = await locationService.requestPermission();
    setHasPermission(granted);
    setIsInitializing(false);
    
    if (!granted) {
      Alert.alert(
        'Location Required',
        'Fahrbuch needs location access for German tax-compliant mileage tracking.\n\nPlease enable location permissions in Settings.',
        [{ text: 'OK' }]
      );
    }
  };

  const calculateDistance = (start: { lat: number; lng: number }, end: { lat: number; lng: number }): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (end.lat - start.lat) * Math.PI / 180;
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(start.lat * Math.PI / 180) * Math.cos(end.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startTrip = async () => {
    if (!hasPermission) {
      Alert.alert('Error', 'Location permission required');
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      
      const newTrip: Trip = {
        id: `trip_${Date.now()}`,
        startTime: new Date(),
        startLocation: { lat: location.latitude, lng: location.longitude },
        status: 'active'
      };
      
      setCurrentTrip(newTrip);
      Alert.alert('Trip Started!', `Started tracking at ${newTrip.startTime.toLocaleTimeString()}`);
    } catch (error) {
      Alert.alert('Error', `Failed to start trip: ${error.message}`);
    }
  };

  const endTrip = async () => {
    if (!currentTrip) return;

    try {
      const location = await locationService.getCurrentLocation();
      
      const distance = calculateDistance(
        currentTrip.startLocation,
        { lat: location.latitude, lng: location.longitude }
      );

      const completedTrip: Trip = {
        ...currentTrip,
        endTime: new Date(),
        endLocation: { lat: location.latitude, lng: location.longitude },
        distance,
        status: 'completed'
      };

      setTrips(prev => [completedTrip, ...prev]);
      setCurrentTrip(null);
      
      Alert.alert(
        'Trip Completed!',
        `Distance: ${distance.toFixed(2)} km\nDuration: ${Math.round((completedTrip.endTime!.getTime() - completedTrip.startTime.getTime()) / 60000)} minutes`,
        [
          { text: 'Business', onPress: () => tagTrip(completedTrip.id, 'business') },
          { text: 'Private', onPress: () => tagTrip(completedTrip.id, 'private') },
          { text: 'Commute', onPress: () => tagTrip(completedTrip.id, 'commute') },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to end trip: ${error.message}`);
    }
  };

  const tagTrip = (tripId: string, purpose: 'business' | 'private' | 'commute') => {
    setTrips(prev => prev.map(trip => 
      trip.id === tripId ? { ...trip, purpose } : trip
    ));
  };

  const formatDuration = (start: Date, end?: Date) => {
    if (!end) return 'Active';
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${minutes} min`;
  };

  const getPurposeEmoji = (purpose?: string) => {
    switch (purpose) {
      case 'business': return '🏢';
      case 'private': return '🏠';
      case 'commute': return '🔄';
      default: return '❓';
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Fahrbuch...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Location Permission Required</Text>
        <Text style={styles.errorMessage}>
          Fahrbuch needs location access for automatic mileage tracking.
          {'\n\n'}Please enable location permissions in Settings.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeLocationService}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fahrbuch Mileage Tracker</Text>
      
      {/* Current Trip Status */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Current Status</Text>
        {currentTrip ? (
          <>
            <Text style={styles.statusText}>🚗 Trip in progress</Text>
            <Text style={styles.statusDetail}>
              Started: {currentTrip.startTime.toLocaleTimeString()}
            </Text>
            <TouchableOpacity style={[styles.button, styles.endButton]} onPress={endTrip}>
              <Text style={styles.buttonText}>End Trip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.statusText}>✅ Ready to track</Text>
            <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startTrip}>
              <Text style={styles.buttonText}>Start Trip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Trip History */}
      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>Recent Trips</Text>
        {trips.length === 0 ? (
          <Text style={styles.emptyState}>No trips recorded yet</Text>
        ) : (
          trips.map((trip) => (
            <View key={trip.id} style={styles.tripItem}>
              <View style={styles.tripHeader}>
                <Text style={styles.tripEmoji}>{getPurposeEmoji(trip.purpose)}</Text>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripDistance}>
                    {trip.distance ? `${trip.distance.toFixed(2)} km` : 'Distance calculating...'}
                  </Text>
                  <Text style={styles.tripTime}>
                    {trip.startTime.toLocaleDateString()} • {formatDuration(trip.startTime, trip.endTime)}
                  </Text>
                  <Text style={styles.tripPurpose}>
                    {trip.purpose ? trip.purpose.charAt(0).toUpperCase() + trip.purpose.slice(1) : 'Untagged'}
                  </Text>
                </View>
              </View>
              {!trip.purpose && (
                <View style={styles.tagButtons}>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#4CAF50' }]}
                    onPress={() => tagTrip(trip.id, 'business')}
                  >
                    <Text style={styles.tagButtonText}>🏢 Business</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => tagTrip(trip.id, 'private')}
                  >
                    <Text style={styles.tagButtonText}>🏠 Private</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#FF9800' }]}
                    onPress={() => tagTrip(trip.id, 'commute')}
                  >
                    <Text style={styles.tagButtonText}>🔄 Commute</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  statusDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  tripItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 16,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  tripInfo: {
    flex: 1,
  },
  tripDistance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tripTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tripPurpose: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 2,
    fontWeight: '500',
  },
  tagButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
  },
  tagButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});