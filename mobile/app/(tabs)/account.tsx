import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, VisitorPass } from '@/lib/api';
import { clearStoredTokens, getRefreshToken } from '@/lib/secure-tokens';
import { useRefreshOnFocus } from '@/lib/query-refresh';
import { useSessionStore } from '@/store/session';

export default function AccountScreen() {
  useRefreshOnFocus('account');
  const user = useSessionStore((state) => state.user);
  const isReady = useSessionStore((state) => state.isReady);
  const restoreError = useSessionStore((state) => state.restoreError);
  const setUser = useSessionStore((state) => state.setUser);
  const setRestoreError = useSessionStore((state) => state.setRestoreError);
  const [logoutError, setLogoutError] = useState('');
  const retryRestore = useMutation({
    mutationFn: async () => (await api.get<{ user: NonNullable<typeof user> }>('/auth/me')).data.user,
    onSuccess: (restoredUser) => {
      setUser(restoredUser);
      setRestoreError(null);
    },
    onError: (error) => setRestoreError(getApiErrorMessage(error)),
  });
  const passes = useQuery({
    queryKey: ['account', 'passes', user?.id],
    queryFn: async () => (await api.get<{ passes: VisitorPass[] }>('/passes/visitor/passes')).data.passes,
    enabled: Boolean(user),
  });
  const bookings = useQuery({
    queryKey: ['account', 'bookings', user?.id],
    queryFn: async () => (await api.get<{
      applications: {
        id: string;
        applicationRef: string;
        status: string;
        eventTitle: string;
        eventCity: string;
        eventStartsAt: string;
        requestedStallCode: string | null;
      }[];
      bookings: {
        id: string;
        bookingRef: string;
        status: string;
        totalAmount: number;
        currency: string;
        eventTitle: string;
        stallCode: string;
        stallTypeName: string;
        invoiceNo: string | null;
      }[];
    }>('/bookings/mine')).data,
    enabled: Boolean(user),
  });

  async function signOut() {
    setLogoutError('');
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) await api.post('/auth/mobile/logout', { refreshToken });
    } catch (error) {
      setLogoutError(`Signed out on this device, but server revocation failed: ${getApiErrorMessage(error)}`);
    } finally {
      await clearStoredTokens();
      setUser(null);
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeading
          eyebrow="Your account"
          title={user ? `Hello, ${user.fullName.split(' ')[0]}` : 'My Haat'}
          description="Manage your visitor passes and account details."
        />
        <Link href="/more" asChild>
          <Pressable style={StyleSheet.flatten([styles.surface, { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }])}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.cream, fontSize: 14, fontWeight: '700' }}>More pages & support</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Blog, About Us, Contact Us and help</Text>
            </View>
            <Text style={{ color: theme.champagne, fontSize: 18 }}>→</Text>
          </Pressable>
        </Link>
        {!isReady ? (
          <MessageState title="Checking your account" description="Restoring your secure mobile session." loading />
        ) : user ? (
          <>
            <View style={[styles.surface, { gap: 7 }]}>
              <Text style={styles.label}>Signed in as</Text>
              <Text style={{ color: theme.cream, fontSize: 15, fontWeight: '700' }}>{user.fullName}</Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>{user.email}</Text>
            </View>
            {user.permissions.includes('passes:scan') ? (
              <Link href="/scanner" asChild>
                <Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.surface, { flexDirection: 'row', justifyContent: 'space-between' }])}>
                  <Text style={{ color: theme.cream, fontSize: 14, fontWeight: '700' }}>Scan visitor passes</Text>
                  <Text style={{ color: theme.terracottaLight }}>Open camera  ↗</Text>
                </Pressable>
              </Link>
            ) : null}
            {user.permissions.includes('bookings:manage') || user.roles?.includes('SUPER_ADMIN') ? (
              <Link href={'/admin-bookings' as Href} asChild>
                <Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.surface, { flexDirection: 'row', justifyContent: 'space-between' }])}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: theme.cream, fontSize: 14, fontWeight: '700' }}>Applications & bookings</Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>Review exhibitors, contact applicants and verify payments</Text>
                  </View>
                  <Text style={{ color: theme.champagne, fontSize: 18 }}>→</Text>
                </Pressable>
              </Link>
            ) : null}
            <View>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21, marginBottom: 12 }}>Your stall applications & bookings</Text>
              {bookings.isPending ? (
                <MessageState title="Loading your bookings" description="Getting your current applications and stall records." loading />
              ) : bookings.isError ? (
                <MessageState title="Bookings could not load" description={getApiErrorMessage(bookings.error)} />
              ) : bookings.data?.applications.length || bookings.data?.bookings.length ? (
                <View style={{ gap: 10 }}>
                  {bookings.data.applications.map((application) => (
                    <View key={application.id} style={[styles.surface, { gap: 5 }]}>
                      <Text style={styles.eyebrow}>APPLICATION · {application.status}</Text>
                      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 17 }}>{application.eventTitle}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{[application.eventCity, new Date(application.eventStartsAt).toLocaleDateString('en-IN')].filter(Boolean).join(' · ')}</Text>
                      <Text style={{ color: theme.terracottaLight, fontSize: 11, fontWeight: '700' }}>
                        {application.applicationRef}{application.requestedStallCode ? ` · Stall ${application.requestedStallCode}` : ''}
                      </Text>
                    </View>
                  ))}
                  {bookings.data.bookings.map((booking) => (
                    <View key={booking.id} style={[styles.surface, { gap: 5 }]}>
                      <Text style={styles.eyebrow}>STALL BOOKING · {booking.status}</Text>
                      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 17 }}>{booking.eventTitle}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{booking.stallTypeName} · Stall {booking.stallCode}</Text>
                      <Text style={{ color: theme.terracottaLight, fontSize: 11, fontWeight: '700' }}>
                        {booking.bookingRef} · {booking.currency} {Number(booking.totalAmount).toLocaleString('en-IN')}
                        {booking.invoiceNo ? ` · Invoice ${booking.invoiceNo}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <MessageState title="No stall applications yet" description="Your exhibitor applications and bookings will appear here." />
              )}
            </View>
            <View>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21, marginBottom: 12 }}>Your visitor passes</Text>
              {passes.isPending ? (
                <MessageState title="Loading your passes" description="Getting current pass information." loading />
              ) : passes.isError ? (
                <MessageState title="Passes could not load" description={getApiErrorMessage(passes.error)} />
              ) : passes.data?.length ? (
                <View style={{ gap: 12 }}>
                  {passes.data.map((pass) => (
                    <View key={pass.passId} style={[styles.surface, { gap: 7 }]}>
                      <Text style={styles.eyebrow}>{pass.status.toUpperCase()}</Text>
                      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18 }}>{pass.title}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{[pass.city, pass.venue].filter(Boolean).join(' · ')}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>{new Date(pass.startsAt).toLocaleDateString('en-IN')}</Text>
                      <Text style={{ color: theme.terracottaLight, fontSize: 12, fontWeight: '700' }}>{pass.passCode}</Text>
                      {pass.qrData ? (
                        <>
                          <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, padding: 10 }}>
                            <QRCode value={pass.qrData} size={142} />
                          </View>
                          {pass.paymentStatus === 'PENDING' ? (
                            <Text style={{ color: theme.terracottaLight, fontSize: 11 }}>
                              Entry is unavailable until payment is confirmed.
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <MessageState title="No passes yet" description="When you register for an exhibition, your passes will appear here." />
              )}
            </View>
            {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
            <HaatButton label="Sign out" onPress={() => void signOut()} variant="secondary" />
          </>
        ) : (
          <>
            {restoreError ? <Text style={styles.errorText}>{restoreError}</Text> : null}
            {restoreError ? (
              <HaatButton
                label={retryRestore.isPending ? 'Checking session…' : 'Retry account restore'}
                onPress={() => retryRestore.mutate()}
                disabled={retryRestore.isPending}
                variant="secondary"
              />
            ) : null}
            <View style={[styles.surface, { gap: 12 }]}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>Your passes, all in one place.</Text>
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>
                Sign in with your existing Haat of Art account to see your visitor passes and profile.
              </Text>
              <Link href="/login" asChild>
                <Pressable accessibilityRole="button" style={{ alignSelf: 'flex-start', backgroundColor: theme.terracotta, borderRadius: 24, minHeight: 46, justifyContent: 'center', paddingHorizontal: 20 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Sign in or create an account</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
