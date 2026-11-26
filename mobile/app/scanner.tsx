import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { useSessionStore } from '@/store/session';

type CheckInResult = {
  status: number;
  attendee?: { name: string; email: string; event: string };
  error?: string;
  checkedInAt?: string;
};

export default function PassScannerScreen() {
  const canScan = useSessionStore((state) => Boolean(state.user?.permissions.includes('passes:scan')));
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanLock = useRef(false);
  const checkIn = useMutation({
    mutationFn: async (token: string) =>
      (await api.post<CheckInResult>('/passes/check-in', { token })).data,
  });

  if (!canScan) {
    return (
      <SafeAreaView style={[styles.page, { justifyContent: 'center', padding: 22 }]}>
        <MessageState
          title="Staff access required"
          description="Your account does not have permission to scan visitor passes."
        />
      </SafeAreaView>
    );
  }

  if (!permission) {
    return <SafeAreaView style={styles.page}><MessageState title="Checking camera permission" description="Opening the device camera." loading /></SafeAreaView>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.page, { justifyContent: 'center', padding: 22 }]}>
        <MessageState
          title="Camera access is needed"
          description="Allow camera access to scan visitor passes. Only staff accounts with pass-scanning permission can use this screen."
          action={<HaatButton label="Allow camera access" onPress={() => void requestPermission()} />}
        />
      </SafeAreaView>
    );
  }

  function scan(data: string) {
    if (scanLock.current || !data) return;
    scanLock.current = true;
    setScanned(true);
    checkIn.mutate(data);
  }

  function scanAgain() {
    checkIn.reset();
    scanLock.current = false;
    setScanned(false);
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <View style={{ flex: 1, gap: 18, padding: 22 }}>
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>
          Align a visitor’s QR pass within the frame. Check-in is verified by the existing Haat of Art system.
        </Text>
        <View style={{ borderColor: theme.terracotta, borderRadius: 24, borderWidth: 2, flex: 1, minHeight: 300, overflow: 'hidden' }}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : ({ data }) => scan(data)}
            style={{ flex: 1 }}
          />
        </View>
        {checkIn.isPending ? <MessageState title="Checking pass" description="Verifying the pass with the backend." loading /> : null}
        {checkIn.isSuccess ? (
          <MessageState
            title={checkIn.data.attendee ? `Welcome, ${checkIn.data.attendee.name}` : 'Pass checked in'}
            description={[
              checkIn.data.attendee?.event,
              checkIn.data.checkedInAt && new Date(checkIn.data.checkedInAt).toLocaleString('en-IN'),
            ].filter(Boolean).join(' · ') || 'The pass was verified successfully.'}
          />
        ) : null}
        {checkIn.isError ? <MessageState title="Pass could not be checked in" description={getApiErrorMessage(checkIn.error)} /> : null}
        {scanned ? (
          <Pressable accessibilityRole="button" onPress={scanAgain} style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={{ color: theme.terracottaLight, fontSize: 13, fontWeight: '700' }}>Scan another pass</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
