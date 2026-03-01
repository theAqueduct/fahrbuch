import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import SimpleLocationDemo from './src/screens/SimpleLocationDemo';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <SimpleLocationDemo />
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
