import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import MotorDexCamera from './components/motorDexCamera';

export default function App() {
  return (
    <View style={styles.container}>
      <MotorDexCamera />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
