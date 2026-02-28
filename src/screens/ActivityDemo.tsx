import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TripService } from '../services/TripService';
import { Trip, ActivityType, TripStatus, TripPurpose } from '../types';

interface ActivityState {
  isTracking: boolean;
  currentTrip: Trip | null;
  tripHistory: Trip[];
  lastActivity: string;
  currentSpeed: number;
}

export default function ActivityDemo() {
  const [tripService] = useState(() => new TripService());
  const [state, setState] = useState<ActivityState>({
    isTracking: false,
    currentTrip: null,
    tripHistory: [],
    lastActivity: 'Unknown',
    currentSpeed: 0,
  });

  useEffect(() => {
    initializeTracking();
    
    return () => {
      tripService.stop();
    };
  }, []);

  const initializeTracking = async () => {
    try {
      const success = await tripService.initialize();
      
      if (success) {
        setState(prev => ({ ...prev, isTracking: true }));
        
        // Listen for trip events
        tripService.onTripEvent((trip: Trip) => {
          setState(prev => ({
            ...prev,
            currentTrip: trip.status === TripStatus.ACTIVE ? trip : null,
            tripHistory: trip.status === TripStatus.ENDED 
              ? [trip, ...prev.tripHistory.slice(0, 9)] // Keep last 10 trips
              : prev.tripHistory,
          }));
        });

        // Simulate activity updates (since we can't fully test on simulator)
        startActivitySimulation();
      } else {
        Alert.alert('Error', 'Failed to start location tracking. Please check permissions.');
      }
    } catch (error) {
      console.error('Failed to initialize tracking:', error);
      Alert.alert('Error', 'Failed to initialize trip tracking.');
    }
  };

  const startActivitySimulation = () => {
    // This simulates activity detection for demo purposes
    let activityIndex = 0;
    const activities = [
      { type: 'STILL', speed: 0 },
      { type: 'WALKING', speed: 5 },
      { type: 'IN_VEHICLE', speed: 30 },
      { type: 'IN_VEHICLE', speed: 45 },
      { type: 'IN_VEHICLE', speed: 35 },
      { type: 'STILL', speed: 0 },
    ];

    setInterval(() => {
      const activity = activities[activityIndex % activities.length];
      setState(prev => ({
        ...prev,
        lastActivity: activity.type,
        currentSpeed: activity.speed,
      }));
      activityIndex++;
    }, 3000); // Update every 3 seconds
  };

  const handleTagTrip = (trip: Trip, purpose: TripPurpose) => {
    tripService.tagTrip(trip.id, purpose);
    Alert.alert('Trip Tagged', `Trip tagged as ${purpose}`);
  };

  const formatDistance = (meters: number): string => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    return `${minutes} min`;
  };

  const getActivityColor = (activity: string): string => {
    switch (activity) {
      case 'IN_VEHICLE': return '#4CAF50';
      case 'WALKING': return '#2196F3';
      case 'STILL': return '#9E9E9E';
      default: return '#FF9800';
    }
  };

  const getTripPurposeEmoji = (purpose: TripPurpose): string => {
    switch (purpose) {
      case TripPurpose.BUSINESS: return '🏢';
      case TripPurpose.PRIVATE: return '🏠';
      case TripPurpose.COMMUTE: return '🔄';
      default: return '❓';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fahrbuch - Activity Demo</Text>
      
      {/* Current Status */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Current Status</Text>
        <View style={styles.statusRow}>
          <Text>Tracking: </Text>
          <Text style={[styles.status, { color: state.isTracking ? '#4CAF50' : '#F44336' }]}>
            {state.isTracking ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text>Activity: </Text>
          <Text style={[styles.status, { color: getActivityColor(state.lastActivity) }]}>
            {state.lastActivity}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text>Speed: </Text>
          <Text style={styles.status}>{state.currentSpeed} km/h</Text>
        </View>
      </View>

      {/* Current Trip */}
      {state.currentTrip && (
        <View style={styles.tripCard}>
          <Text style={styles.cardTitle}>🚗 Current Trip</Text>
          <Text>Started: {new Date(state.currentTrip.createdAt).toLocaleTimeString()}</Text>
          <Text>Route points: {state.currentTrip.route.length}</Text>
          <Text style={styles.tripStatus}>Status: Active</Text>
        </View>
      )}

      {/* Trip History */}
      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>Recent Trips</Text>
        {state.tripHistory.length === 0 ? (
          <Text style={styles.emptyState}>No trips recorded yet</Text>
        ) : (
          state.tripHistory.map((trip) => (
            <View key={trip.id} style={styles.tripItem}>
              <View style={styles.tripHeader}>
                <Text style={styles.tripEmoji}>{getTripPurposeEmoji(trip.purpose)}</Text>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripRoute}>
                    {trip.startAddress?.formatted || 'Start'} → {trip.endAddress?.formatted || 'End'}
                  </Text>
                  <Text style={styles.tripDetails}>
                    {trip.distance ? formatDistance(trip.distance) : '0 km'} • 
                    {trip.duration ? formatDuration(trip.duration) : '0 min'}
                  </Text>
                </View>
              </View>
              
              {trip.purpose === TripPurpose.UNTAGGED && (
                <View style={styles.tagButtons}>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#4CAF50' }]}
                    onPress={() => handleTagTrip(trip, TripPurpose.BUSINESS)}
                  >
                    <Text style={styles.tagButtonText}>🏢 Business</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => handleTagTrip(trip, TripPurpose.PRIVATE)}
                  >
                    <Text style={styles.tagButtonText}>🏠 Private</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#FF9800' }]}
                    onPress={() => handleTagTrip(trip, TripPurpose.COMMUTE)}
                  >
                    <Text style={styles.tagButtonText}>🔄 Commute</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Text style={styles.instruction}>
          • The app monitors your device's motion and location
        </Text>
        <Text style={styles.instruction}>
          • When vehicle motion is detected (speed {'>'}15 km/h), a trip starts
        </Text>
        <Text style={styles.instruction}>
          • When you become stationary, the trip ends
        </Text>
        <Text style={styles.instruction}>
          • You'll get a notification to tag the trip purpose
        </Text>
        <Text style={styles.note}>
          Note: This demo simulates activity detection since motion sensors work best on real devices.
        </Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  status: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyState: {
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  tripItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
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
  tripRoute: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  tripDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tagButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
  },
  tagButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instruction: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 8,
  },
});