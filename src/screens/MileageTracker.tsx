import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { TripService } from '../services/TripService';
import { WebTripService } from '../services/WebTripService';
import { Trip, TripPurpose, TripStatus } from '../types';
import TripDetail from './TripDetail';

export default function MileageTracker() {
  const [tripService] = useState(() => 
    Platform.OS === 'web' ? new WebTripService() : new TripService()
  );
  const isWeb = Platform.OS === 'web';
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  useEffect(() => {
    initializeTripService();
    
    // Subscribe to trip events from TripService
    const unsubscribe = tripService.onTripEvent((trip: Trip) => {
      console.log('📱 [MileageTracker] Received trip event:', trip.id, trip.status);
      
      if (trip.status === TripStatus.ACTIVE) {
        setCurrentTrip(trip);
      } else if (trip.status === TripStatus.ENDED) {
        setCurrentTrip(null);
        // Refresh trips list to show the new completed trip
        loadTrips();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 [MileageTracker] Cleaning up...');
      tripService.close();
    };
  }, []);

  const initializeTripService = async () => {
    try {
      console.log('🚀 [MileageTracker] Initializing TripService...');
      const success = await tripService.initialize();
      
      if (success) {
        setIsInitialized(true);
        console.log('✅ [MileageTracker] TripService initialized successfully');
        
        // Load existing trips from database
        await loadTrips();
        
        // Check if there's currently an active trip
        const activeTrip = tripService.getCurrentTrip();
        setCurrentTrip(activeTrip);
      } else {
        setIsInitialized(false);
        Alert.alert(
          'Initialization Failed',
          'Failed to initialize location and activity tracking. Please check permissions and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('💥 [MileageTracker] Error initializing TripService:', error);
      setIsInitialized(false);
      Alert.alert(
        'Error',
        'An error occurred during initialization. Please restart the app.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrips = async () => {
    try {
      console.log('📋 [MileageTracker] Loading trips from database...');
      const loadedTrips = await tripService.getTrips(50, 0);
      setTrips(loadedTrips);
      console.log(`📋 [MileageTracker] Loaded ${loadedTrips.length} trips`);
    } catch (error) {
      console.error('💥 [MileageTracker] Error loading trips:', error);
      Alert.alert('Error', 'Failed to load trips from database.');
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadTrips();
    setIsRefreshing(false);
  };

  const manualStartTrip = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Trip service not initialized');
      return;
    }

    if (currentTrip) {
      Alert.alert('Active Trip', 'You already have an active trip. End it first before starting a new one.');
      return;
    }

    if (isWeb) {
      // Web version allows manual trip start
      try {
        const trip = await (tripService as WebTripService).startManualTrip();
        if (trip) {
          Alert.alert('Trip Started!', `Trip started at ${new Date().toLocaleTimeString()}`);
        } else {
          Alert.alert('Error', 'Failed to start trip. Make sure location access is enabled.');
        }
      } catch (error) {
        console.error('Error starting manual trip:', error);
        Alert.alert('Error', 'Failed to start trip');
      }
    } else {
      // Mobile version uses automatic detection
      Alert.alert(
        'Manual Trip Start',
        'Normally trips are detected automatically. Are you sure you want to manually start a trip?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Start Trip', onPress: () => {
            Alert.alert('Info', 'Start driving and the trip will be detected automatically.');
          }},
        ]
      );
    }
  };

  const manualEndTrip = async () => {
    if (!currentTrip) {
      Alert.alert('No Active Trip', 'There is no active trip to end.');
      return;
    }

    if (isWeb) {
      // Web version allows manual trip end
      Alert.alert(
        'End Trip',
        'Are you sure you want to end the current trip?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Trip', onPress: async () => {
            try {
              const trip = await (tripService as WebTripService).endManualTrip();
              if (trip) {
                const distance = trip.distance ? (trip.distance / 1000).toFixed(1) : 'Unknown';
                Alert.alert('Trip Ended!', `Distance: ${distance} km`);
              } else {
                Alert.alert('Error', 'Failed to end trip');
              }
            } catch (error) {
              console.error('Error ending manual trip:', error);
              Alert.alert('Error', 'Failed to end trip');
            }
          }},
        ]
      );
    } else {
      // Mobile version uses automatic detection
      Alert.alert(
        'End Trip',
        'Are you sure you want to manually end the current trip?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Trip', onPress: async () => {
            Alert.alert('Info', 'Stop driving and the trip will end automatically.');
          }},
        ]
      );
    }
  };

  const tagTrip = async (tripId: string, purpose: TripPurpose) => {
    try {
      const success = await tripService.tagTrip(tripId, purpose);
      if (success) {
        // Refresh the trips to show the updated purpose
        await loadTrips();
        Alert.alert('Success', `Trip tagged as ${purpose}`);
      } else {
        Alert.alert('Error', 'Failed to tag trip');
      }
    } catch (error) {
      console.error('💥 [MileageTracker] Error tagging trip:', error);
      Alert.alert('Error', 'Failed to tag trip');
    }
  };

  const deleteTrip = async (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const success = await tripService.deleteTrip(tripId);
            if (success) {
              await loadTrips();
              Alert.alert('Success', 'Trip deleted');
            } else {
              Alert.alert('Error', 'Failed to delete trip');
            }
          } catch (error) {
            console.error('💥 [MileageTracker] Error deleting trip:', error);
            Alert.alert('Error', 'Failed to delete trip');
          }
        }},
      ]
    );
  };

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return 'Unknown';
    const minutes = Math.round(durationMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDistance = (distanceM?: number) => {
    if (!distanceM) return 'Unknown';
    if (distanceM < 1000) return `${Math.round(distanceM)}m`;
    return `${(distanceM / 1000).toFixed(1)}km`;
  };

  const getPurposeEmoji = (purpose: TripPurpose) => {
    switch (purpose) {
      case TripPurpose.BUSINESS: return '🏢';
      case TripPurpose.PRIVATE: return '🏠';
      case TripPurpose.COMMUTE: return '🔄';
      case TripPurpose.UNTAGGED: return '❓';
      default: return '❓';
    }
  };

  const getPurposeColor = (purpose: TripPurpose) => {
    switch (purpose) {
      case TripPurpose.BUSINESS: return '#4CAF50';
      case TripPurpose.PRIVATE: return '#2196F3';
      case TripPurpose.COMMUTE: return '#FF9800';
      case TripPurpose.UNTAGGED: return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const viewTripDetails = (trip: Trip) => {
    setSelectedTrip(trip);
  };

  const closeTripDetails = () => {
    setSelectedTrip(null);
  };

  // Show trip detail screen if a trip is selected
  if (selectedTrip) {
    return (
      <TripDetail 
        trip={selectedTrip} 
        onBack={closeTripDetails} 
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Fahrbuch...</Text>
        <Text style={styles.loadingSubtext}>Setting up location tracking and database...</Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Setup Required</Text>
        <Text style={styles.errorMessage}>
          Fahrbuch needs location and activity permissions for automatic mileage tracking.
          {'\n\n'}Please enable all permissions and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeTripService}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Fahrbuch Mileage Tracker</Text>
      
      {/* Current Trip Status */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Current Status</Text>
        {currentTrip ? (
          <>
            <Text style={styles.statusText}>🚗 Trip in progress</Text>
            <Text style={styles.statusDetail}>
              Started: {new Date(currentTrip.createdAt).toLocaleTimeString()}
            </Text>
            <Text style={styles.statusDetail}>
              From: {currentTrip.startAddress?.formatted || 'Getting location...'}
            </Text>
            <Text style={styles.infoText}>
              {isWeb ? '🌐 Manual trip mode - click to end trip' : 'ℹ️ Trip will end automatically when you stop driving'}
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.endButton]} 
              onPress={manualEndTrip}
            >
              <Text style={styles.buttonText}>{isWeb ? 'End Trip' : 'Force End Trip'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.statusText}>✅ Ready to track</Text>
            <Text style={styles.infoText}>
              {isWeb ? '🌐 Web version - click to start manual trip' : '🤖 Trips are detected automatically when you start driving'}
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.startButton]} 
              onPress={manualStartTrip}
            >
              <Text style={styles.buttonText}>{isWeb ? 'Start Trip' : 'Manual Start Info'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Trip History */}
      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>Recent Trips ({trips.length})</Text>
        {trips.length === 0 ? (
          <Text style={styles.emptyState}>No trips recorded yet</Text>
        ) : (
          trips.map((trip) => (
            <View key={trip.id} style={styles.tripItem}>
              <View style={styles.tripHeader}>
                <Text style={styles.tripEmoji}>{getPurposeEmoji(trip.purpose)}</Text>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripDistance}>
                    {formatDistance(trip.distance)} • {formatDuration(trip.duration)}
                  </Text>
                  <Text style={styles.tripTime}>
                    {new Date(trip.createdAt).toLocaleDateString()} at {new Date(trip.createdAt).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.tripRoute}>
                    {trip.startAddress?.formatted || 'Unknown'} → {trip.endAddress?.formatted || 'Unknown'}
                  </Text>
                  <View style={styles.purposeContainer}>
                    <View style={[styles.purposeBadge, { backgroundColor: getPurposeColor(trip.purpose) }]}>
                      <Text style={styles.purposeText}>
                        {trip.purpose.charAt(0).toUpperCase() + trip.purpose.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              
              {trip.purpose === TripPurpose.UNTAGGED && (
                <View style={styles.tagButtons}>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#4CAF50' }]}
                    onPress={() => tagTrip(trip.id, TripPurpose.BUSINESS)}
                  >
                    <Text style={styles.tagButtonText}>🏢 Business</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => tagTrip(trip.id, TripPurpose.PRIVATE)}
                  >
                    <Text style={styles.tagButtonText}>🏠 Private</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagButton, { backgroundColor: '#FF9800' }]}
                    onPress={() => tagTrip(trip.id, TripPurpose.COMMUTE)}
                  >
                    <Text style={styles.tagButtonText}>🔄 Commute</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                  onPress={() => viewTripDetails(trip)}
                >
                  <Text style={styles.actionButtonText}>📍 View GPS Details</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#f44336' }]}
                  onPress={() => deleteTrip(trip.id)}
                >
                  <Text style={styles.actionButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
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
    fontWeight: 'bold',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 16,
    fontStyle: 'italic',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tripEmoji: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 4,
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
  tripRoute: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    lineHeight: 16,
  },
  purposeContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  purposeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  purposeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});