import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SimpleLocationService } from '../services/SimpleLocationService';

export default function SimpleLocationDemo() {
  const [locationService] = useState(() => new SimpleLocationService());
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [location, setLocation] = useState<any>(null);

  const requestPermission = async () => {
    setStatus('requesting');
    
    const granted = await locationService.requestPermission();
    
    if (granted) {
      setStatus('granted');
      Alert.alert('Success!', 'Location permission granted');
    } else {
      setStatus('denied');
      Alert.alert('Permission Denied', 'Location access is required for mileage tracking');
    }
  };

  const getLocation = async () => {
    if (!locationService.hasLocationPermission()) {
      Alert.alert('Error', 'Location permission required');
      return;
    }

    try {
      const currentLocation = await locationService.getCurrentLocation();
      setLocation(currentLocation);
      Alert.alert('Location Found!', `Lat: ${currentLocation.latitude.toFixed(6)}, Lng: ${currentLocation.longitude.toFixed(6)}`);
    } catch (error) {
      Alert.alert('Error', `Failed to get location: ${error.message}`);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'granted': return '#4CAF50';
      case 'denied': return '#F44336';
      case 'requesting': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Location Test</Text>
      
      <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
        <Text style={styles.statusTitle}>Status: {status.toUpperCase()}</Text>
        <Text style={styles.statusDescription}>
          {status === 'idle' && 'Ready to request location permission'}
          {status === 'requesting' && 'Requesting location permission...'}
          {status === 'granted' && 'Location permission granted ✅'}
          {status === 'denied' && 'Location permission denied ❌'}
        </Text>
      </View>

      {status === 'idle' && (
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Request Location Permission</Text>
        </TouchableOpacity>
      )}

      {status === 'granted' && (
        <TouchableOpacity style={[styles.button, styles.getLocationButton]} onPress={getLocation}>
          <Text style={styles.buttonText}>Get Current Location</Text>
        </TouchableOpacity>
      )}

      {status === 'denied' && (
        <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      )}

      {location && (
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>📍 Current Location</Text>
          <Text style={styles.locationText}>Latitude: {location.latitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Longitude: {location.longitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Time: {new Date(location.timestamp).toLocaleTimeString()}</Text>
        </View>
      )}

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>How This Works</Text>
        <Text style={styles.instructionText}>
          1. Tap "Request Location Permission"
        </Text>
        <Text style={styles.instructionText}>
          2. Allow location access when prompted
        </Text>
        <Text style={styles.instructionText}>
          3. Tap "Get Current Location" to test
        </Text>
        <Text style={styles.note}>
          This is a simplified test to verify location services work on your device.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  statusDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  getLocationButton: {
    backgroundColor: '#4CAF50',
  },
  retryButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  locationCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 6,
    borderLeftColor: '#4CAF50',
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2E7D32',
  },
  locationText: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#E65100',
  },
  instructionText: {
    fontSize: 14,
    color: '#BF360C',
    marginBottom: 6,
  },
  note: {
    fontSize: 12,
    color: '#8D6E63',
    fontStyle: 'italic',
    marginTop: 8,
  },
});