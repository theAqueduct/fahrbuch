import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Trip, Location as LocationType } from '../types';
import { TripService } from '../services/TripService';
import { WebTripService } from '../services/WebTripService';

interface TripDetailProps {
  trip: Trip;
  onBack: () => void;
}

export default function TripDetail({ trip, onBack }: TripDetailProps) {
  const [tripService] = useState(() => 
    Platform.OS === 'web' ? new WebTripService() : new TripService()
  );
  const [gpsPoints, setGpsPoints] = useState<LocationType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGpsPoints();
  }, [trip.id]);

  const loadGpsPoints = async () => {
    try {
      setLoading(true);
      console.log(`📍 Loading GPS points for trip ${trip.id}...`);
      const points = await tripService.getTripGpsPoints(trip.id);
      setGpsPoints(points);
      console.log(`📍 Loaded ${points.length} GPS points`);
    } catch (error) {
      console.error('Error loading GPS points:', error);
      Alert.alert('Error', 'Failed to load GPS tracking data');
    } finally {
      setLoading(false);
    }
  };

  const formatCoordinate = (coord: number): string => {
    return coord.toFixed(6);
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
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

  const getPurposeEmoji = (purpose: string) => {
    switch (purpose) {
      case 'business': return '🏢';
      case 'private': return '🏠';
      case 'commute': return '🔄';
      case 'untagged': return '❓';
      default: return '❓';
    }
  };

  const calculatePointDistance = (point1: LocationType, point2: LocationType): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateTimeBetweenPoints = (point1: LocationType, point2: LocationType): number => {
    return Math.abs(point2.timestamp - point1.timestamp);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trip Details</Text>
      </View>

      {/* Trip Summary */}
      <View style={styles.summaryCard}>
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
          </View>
        </View>
      </View>

      {/* GPS Tracking Data */}
      <View style={styles.gpsCard}>
        <Text style={styles.cardTitle}>GPS Tracking Data</Text>
        
        {loading ? (
          <Text style={styles.loadingText}>Loading GPS points...</Text>
        ) : (
          <>
            <Text style={styles.gpsSubtitle}>
              📍 {gpsPoints.length} GPS points recorded every 15 seconds
            </Text>
            
            {gpsPoints.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No GPS tracking data available for this trip.
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  This trip was recorded before GPS breadcrumb tracking was enabled, or GPS data collection failed.
                </Text>
              </View>
            ) : (
              <>
                {/* GPS Points List */}
                <View style={styles.pointsList}>
                  {gpsPoints.map((point, index) => {
                    const prevPoint = index > 0 ? gpsPoints[index - 1] : null;
                    const distanceFromPrev = prevPoint ? calculatePointDistance(prevPoint, point) : 0;
                    const timeFromPrev = prevPoint ? calculateTimeBetweenPoints(prevPoint, point) : 0;
                    
                    return (
                      <View key={index} style={styles.gpsPoint}>
                        <View style={styles.pointHeader}>
                          <Text style={styles.pointIndex}>#{index + 1}</Text>
                          <Text style={styles.pointTime}>{formatTimestamp(point.timestamp)}</Text>
                        </View>
                        
                        <View style={styles.pointDetails}>
                          <Text style={styles.coordinates}>
                            {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
                          </Text>
                          
                          <View style={styles.pointMetrics}>
                            {point.speed && (
                              <Text style={styles.metric}>
                                🏃 {Math.round(point.speed * 3.6)} km/h
                              </Text>
                            )}
                            {point.accuracy && (
                              <Text style={styles.metric}>
                                🎯 ±{Math.round(point.accuracy)}m
                              </Text>
                            )}
                          </View>
                          
                          {index > 0 && (
                            <View style={styles.deltaInfo}>
                              <Text style={styles.delta}>
                                📏 {Math.round(distanceFromPrev)}m from previous
                              </Text>
                              <Text style={styles.delta}>
                                ⏱️ {Math.round(timeFromPrev / 1000)}s elapsed
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Summary Stats */}
                <View style={styles.statsCard}>
                  <Text style={styles.statsTitle}>Tracking Statistics</Text>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total GPS Points:</Text>
                    <Text style={styles.statValue}>{gpsPoints.length}</Text>
                  </View>
                  {gpsPoints.length > 1 && (
                    <>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Average Interval:</Text>
                        <Text style={styles.statValue}>
                          {Math.round((gpsPoints[gpsPoints.length - 1].timestamp - gpsPoints[0].timestamp) / (gpsPoints.length - 1) / 1000)}s
                        </Text>
                      </View>
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>GPS Accuracy Range:</Text>
                        <Text style={styles.statValue}>
                          {Math.min(...gpsPoints.map(p => p.accuracy || 0))}m - {Math.max(...gpsPoints.map(p => p.accuracy || 0))}m
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  tripInfo: {
    flex: 1,
  },
  tripDistance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tripTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tripRoute: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    lineHeight: 16,
  },
  gpsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  gpsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  pointsList: {
    marginTop: 8,
  },
  gpsPoint: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pointIndex: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  pointTime: {
    fontSize: 14,
    color: '#666',
  },
  pointDetails: {
    marginLeft: 8,
  },
  coordinates: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  pointMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  metric: {
    fontSize: 11,
    color: '#666',
  },
  deltaInfo: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  delta: {
    fontSize: 10,
    color: '#999',
  },
  statsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
});