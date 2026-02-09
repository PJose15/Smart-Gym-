import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { parseQrCode } from '@smartgym/utils';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset scan state every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setError(null);
    }, []),
  );

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const slug = parseQrCode(data);
    if (slug) {
      router.push(`/machine/${slug}`);
    } else {
      setError('Invalid QR code. Please scan a SmartGym machine QR code.');
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.message}>SmartGym needs your camera to scan QR codes on gym machines.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <Text style={styles.hint}>Point at a machine QR code</Text>
        </View>
      </CameraView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => { setScanned(false); setError(null); }}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanArea: { width: 250, height: 250, borderWidth: 2, borderColor: '#4361ee', borderRadius: 16, backgroundColor: 'transparent' },
  hint: { color: '#fff', fontSize: 16, marginTop: 24, textAlign: 'center' },
  message: { fontSize: 16, color: '#6c757d', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  button: { backgroundColor: '#4361ee', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 24, alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  errorText: { color: '#e63946', fontSize: 16, marginBottom: 12, textAlign: 'center' },
});
