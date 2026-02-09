import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SmartGym</Text>
      <Text style={styles.subtitle}>Scan a QR code on any machine to get started</Text>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push('/(tabs)/scan')}
      >
        <Text style={styles.scanButtonText}>Scan Machine QR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6c757d', textAlign: 'center', marginBottom: 32 },
  scanButton: { backgroundColor: '#4361ee', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  scanButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
});
