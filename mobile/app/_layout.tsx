import { Stack } from 'expo-router';
import axios from 'axios';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { applyWebsiteTheme, theme } from '@/constants/theme';
import { HaatHeader } from '@/components/haat-ui';
import type { WebsiteTheme } from '@/constants/theme';
import { api, AccountUser, getApiErrorMessage } from '@/lib/api';
import { clearStoredTokens, getRefreshToken, setAccessToken, setRefreshToken } from '@/lib/secure-tokens';
import { useSessionStore } from '@/store/session';

export {
  ErrorBoundary,
} from 'expo-router';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
export default function RootLayout() {
  const [, setThemeRevision] = useState(0);
  const [, fontError] = useFonts({
    HaatSans: PlusJakartaSans_400Regular,
    HaatSansMedium: PlusJakartaSans_500Medium,
    HaatSansSemibold: PlusJakartaSans_600SemiBold,
    HaatSansBold: PlusJakartaSans_700Bold,
    HaatDisplay: CormorantGaramond_400Regular,
    HaatDisplayItalic: CormorantGaramond_400Regular_Italic,
  });
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  }));
  const handleThemeChange = useCallback(() => setThemeRevision((revision) => revision + 1), []);
  const backgroundColor = theme.background;

  useEffect(() => {
    if (fontError) console.error('[mobile] Website fonts could not load', fontError);
  }, [fontError]);

  return (
    <QueryClientProvider client={queryClient}>
      <SiteThemeBootstrap onThemeChange={handleThemeChange} />
      <SessionBootstrap />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor },
          headerStyle: { backgroundColor },
          headerTintColor: theme.cream,
          header: () => <HaatHeader />,
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="exhibition" options={{ title: 'Exhibition' }} />
        <Stack.Screen name="edition-archive" options={{ title: 'Gallery archive' }} />
        <Stack.Screen name="edition" options={{ title: 'Edition' }} />
        <Stack.Screen name="artwork" options={{ title: 'Artwork' }} />
        <Stack.Screen name="artist" options={{ title: 'Artist' }} />
        <Stack.Screen name="book-stall" options={{ title: 'Book Stall' }} />
        <Stack.Screen name="stall-application" options={{ title: 'Exhibitor Application' }} />
        <Stack.Screen name="event-flow" options={{ title: 'Event Flow' }} />
        <Stack.Screen name="login" options={{ title: 'Your account', presentation: 'modal' }} />
        <Stack.Screen name="pass-register" options={{ title: 'Visitor pass', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Event reminders' }} />
        <Stack.Screen name="scanner" options={{ title: 'Pass scanner' }} />
        <Stack.Screen name="admin-bookings" options={{ title: 'Applications & bookings' }} />
      </Stack>
    </QueryClientProvider>
  );
}

function SiteThemeBootstrap({ onThemeChange }: { onThemeChange: () => void }) {
  const siteTheme = useQuery({
    queryKey: ['site-settings', 'theme'],
    queryFn: async () => (await api.get<{ settings: { theme?: WebsiteTheme } | null }>('/site-settings')).data.settings?.theme ?? null,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (siteTheme.data && applyWebsiteTheme(siteTheme.data)) onThemeChange();
  }, [onThemeChange, siteTheme.data]);

  useEffect(() => {
    if (siteTheme.error) console.error('[mobile] Website theme could not load', getApiErrorMessage(siteTheme.error));
  }, [siteTheme.error]);

  return null;
}

function SessionBootstrap() {
  const setUser = useSessionStore((state) => state.setUser);
  const setReady = useSessionStore((state) => state.setReady);
  const setRestoreError = useSessionStore((state) => state.setRestoreError);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return;
        const { data: tokens } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/mobile/refresh', { refreshToken });
        setAccessToken(tokens.accessToken);
        await setRefreshToken(tokens.refreshToken);
        const { data } = await api.get<{ user: AccountUser }>('/auth/me');
        if (active) setUser(data.user);
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)) {
          await clearStoredTokens();
        }
        if (active) setRestoreError(getApiErrorMessage(error));
      } finally {
        if (active) setReady(true);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, [setReady, setRestoreError, setUser]);

  return null;
}
