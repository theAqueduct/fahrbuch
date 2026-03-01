import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import MileageTracker from './src/screens/MileageTracker';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <MileageTracker />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
