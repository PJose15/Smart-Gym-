import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { parseQrCode } from '@smartgym/utils';
import { Button, Text } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

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
        <Text variant="body" color="textSecondary">
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <AnimatedScreen>
      <View style={styles.permissionContainer}>
        <Text variant="heading" style={styles.permissionTitle}>
          Camera Access Required
        </Text>
        <Text variant="body" color="textSecondary" style={styles.message}>
          SmartGym needs your camera to scan QR codes on gym machines.
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
      </AnimatedScreen>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <Text variant="body" color="white" style={styles.hint}>
            Point at a machine QR code
          </Text>
        </View>
      </CameraView>

      {error && (
        <View style={styles.errorContainer}>
          <Text variant="body" color="error" style={styles.errorText}>
            {error}
          </Text>
          <Button
            title="Scan Again"
            onPress={() => { setScanned(false); setError(null); }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    marginBottom: spacing.md,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.lg,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  errorText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
