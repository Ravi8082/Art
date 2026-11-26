import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, PageHeading, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type Exhibition } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

type PassPlan = 'FREE' | 'PAID';
type EventOffer = {
  id: string;
  slug: string;
  title: string;
  description: string;
  city: string;
  state: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  passConfig: {
    passMode: 'FREE' | 'PAID' | 'BOTH';
    freeRemaining: number | null;
    paidPrice: number;
    paidRemaining: number | null;
    freePerks: string[];
    paidPerks: string[];
  };
};
type RegistrationPayload = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  passPlan: PassPlan;
  preferredVisitDay: string;
  quantity: number;
};
type VerificationResponse = {
  email: string;
  message: string;
  verificationRequired: boolean;
};
type RegistrationResponse = {
  pass: {
    passCode: string;
    qrData: string;
    eventTitle: string;
    passTier: PassPlan;
    paymentStatus: string;
    amount: number;
    quantity: number;
    preferredVisitDay: string;
  };
  emailSent: boolean;
  message: string;
};

export default function PassRegisterScreen() {
  const { eventSlug } = useLocalSearchParams<{ eventSlug: string }>();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const registerOffset = useRef(0);
  const [selectedSlug, setSelectedSlug] = useState(eventSlug ?? '');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [preferredVisitDay, setPreferredVisitDay] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [passPlan, setPassPlan] = useState<PassPlan>('FREE');
  const [formError, setFormError] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [registrationPayload, setRegistrationPayload] = useState<RegistrationPayload | null>(null);
  const [resendUntil, setResendUntil] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  useRefreshOnFocus('passes');

  const eventQuery = useQuery({
    queryKey: ['passes', 'open-events'],
    queryFn: async () => (await api.get<{ events: EventOffer[] }>('/exhibitions/nearest')).data.events,
    refetchInterval: 30_000,
  });
  const mediaQuery = useQuery({
    queryKey: ['passes', 'event-media'],
    queryFn: async () => (await api.get<{ events: Exhibition[] }>('/events', {
      params: { page: 1, pageSize: 50, upcoming: 'true' },
    })).data.events,
    refetchInterval: 30_000,
  });

  const activeSlug = selectedSlug || eventSlug || eventQuery.data?.[0]?.slug || '';
  const event = eventQuery.data?.find((item) => item.slug === activeSlug);
  const eventMedia = mediaQuery.data?.find((item) => item.slug === event?.slug);
  const heroImage = resolveMediaUrl(eventMedia?.media.find((item) => item.mediaType === 'IMAGE')?.url);
  const plans = useMemo(() => {
    if (!event) return [];
    if (event.passConfig.passMode === 'FREE') return ['FREE'] as PassPlan[];
    if (event.passConfig.passMode === 'PAID') return ['PAID'] as PassPlan[];
    return ['FREE', 'PAID'] as PassPlan[];
  }, [event]);
  const visitDays = useMemo(
    () => event ? getVisitDays(event.startsAt, event.endsAt) : [],
    [event?.startsAt, event?.endsAt],
  );

  useEffect(() => {
    if (!event) return;
    setPreferredVisitDay(event.startsAt.slice(0, 10));
    setPassPlan(event.passConfig.passMode === 'PAID' ? 'PAID' : 'FREE');
  }, [event]);

  useEffect(() => {
    if (!resendUntil) {
      setResendSeconds(0);
      return;
    }
    const updateCountdown = () => setResendSeconds(Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000)));
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [resendUntil]);

  const requestOtp = useMutation({
    mutationFn: async (payload: RegistrationPayload) => {
      if (!event) throw new Error('This exhibition is not open for pass registration.');
      return (await api.post<VerificationResponse>(
        `/passes/public/events/${encodeURIComponent(event.slug)}/register`,
        payload,
      )).data;
    },
    onSuccess: (result, payload) => {
      setRegistrationPayload(payload);
      setOtpEmail(result.email);
      setOtpCode('');
      setOtpMessage(result.message);
      setResendUntil(Date.now() + 60_000);
      setFormError('');
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async (code: string) => {
      if (!event || !otpEmail) throw new Error('Request an email verification code first.');
      return (await api.post<RegistrationResponse>(
        `/passes/public/events/${encodeURIComponent(event.slug)}/verify`,
        { email: otpEmail, code },
      )).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['passes'] });
    },
  });

  const verifiedRegistration = verifyOtp.data;
  const maxRemaining = passPlan === 'FREE' ? event?.passConfig.freeRemaining : event?.passConfig.paidRemaining;
  const unavailable = maxRemaining !== null && maxRemaining !== undefined && maxRemaining <= 0;
  const planAvailable = (plan: PassPlan) => {
    const remaining = plan === 'FREE' ? event?.passConfig.freeRemaining : event?.passConfig.paidRemaining;
    return remaining === null || remaining === undefined || remaining > 0;
  };

  function chooseEvent(slug: string) {
    setSelectedSlug(slug);
    setFormError('');
    setOtpEmail('');
    setOtpCode('');
    setOtpMessage('');
    setRegistrationPayload(null);
    requestOtp.reset();
    verifyOtp.reset();
  }

  function buildPayload(): RegistrationPayload | null {
    setFormError('');
    if (!event) {
      setFormError('Choose an exhibition that is open for visitor registration.');
      return null;
    }
    if (!fullName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9+() -]{10,18}$/.test(phone) ||
      city.trim().length < 2 || state.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(preferredVisitDay)) {
      setFormError('Enter your name, valid contact details, city, state and visit date.');
      return null;
    }
    const passQuantity = Number(quantity);
    if (!Number.isInteger(passQuantity) || passQuantity < 1 || passQuantity > 10) {
      setFormError('Choose between 1 and 10 visitor passes.');
      return null;
    }
    if (unavailable) {
      setFormError('This pass type has reached capacity. Choose another available option.');
      return null;
    }
    return {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      city: city.trim(),
      state: state.trim(),
      passPlan,
      preferredVisitDay,
      quantity: passQuantity,
    };
  }

  function requestVerificationCode(payload = buildPayload()) {
    if (!payload) return;
    requestOtp.reset();
    verifyOtp.reset();
    requestOtp.mutate(payload);
  }

  function verifyEmail() {
    setFormError('');
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setFormError('Enter the 6-digit code sent to your email.');
      return;
    }
    verifyOtp.mutate(otpCode.trim());
  }

  function scrollToRegistration() {
    scrollRef.current?.scrollTo({ y: registerOffset.current, animated: true });
  }

  const refreshing = eventQuery.isRefetching || mediaQuery.isRefetching;
  async function refresh() {
    await Promise.all([eventQuery.refetch(), mediaQuery.refetch()]);
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { flexGrow: 1, gap: 18, paddingBottom: 28 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.terracotta} />}
          showsVerticalScrollIndicator={false}>
          <PageHeading
            eyebrow="A place at the Haat"
            title={verifiedRegistration ? 'Your pass is ready' : 'Plan your visit'}
            description="Choose an upcoming exhibition, verify your email, and get your visitor pass from the official registration system."
          />

          {eventQuery.isPending ? (
            <MessageState title="Checking upcoming exhibitions" description="Getting event dates and pass options from the database." loading />
          ) : eventQuery.isError ? (
            <MessageState title="Visitor details could not load" description={getApiErrorMessage(eventQuery.error)} action={<HaatButton label="Retry" onPress={() => void eventQuery.refetch()} />} />
          ) : !eventQuery.data?.length ? (
            <MessageState title="No open visitor registrations" description="Visitor pass registration will appear here when an exhibition opens." />
          ) : !event ? (
            <MessageState title="Registration is not open" description="This exhibition is no longer accepting visitor pass registrations." />
          ) : verifiedRegistration ? (
            <View style={[styles.surface, { alignItems: 'center', gap: 16, paddingVertical: 24 }]}>
              <Text style={styles.eyebrow}>{verifiedRegistration.pass.eventTitle}</Text>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 }}>
                <QRCode value={verifiedRegistration.pass.qrData} size={208} />
              </View>
              <Text style={{ color: theme.cream, fontSize: 17, fontWeight: '800' }}>{verifiedRegistration.pass.passCode}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>
                {verifiedRegistration.pass.quantity} pass(es) · {verifiedRegistration.pass.passTier} · {verifiedRegistration.pass.preferredVisitDay}
              </Text>
              {verifiedRegistration.pass.paymentStatus === 'PENDING' ? (
                <Text style={{ color: theme.terracottaLight, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                  Payment is not enabled yet. This reservation QR is not valid for entry until payment is confirmed.
                </Text>
              ) : null}
              <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{verifiedRegistration.message}</Text>
              <HaatButton label="Register another visitor" onPress={() => {
                verifyOtp.reset();
                setOtpEmail('');
                setOtpCode('');
                setOtpMessage('');
                setRegistrationPayload(null);
              }} />
            </View>
          ) : (
            <>
              <View style={[styles.surface, { overflow: 'hidden', padding: 0 }]}>
                <View style={{ height: 245, justifyContent: 'flex-end', overflow: 'hidden', padding: 18 }}>
                  {heroImage ? (
                    <Image
                      source={{ uri: heroImage }}
                      contentFit="cover"
                      transition={250}
                      accessibilityLabel={`${event.title} exhibition`}
                      style={{ height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' }}
                    />
                  ) : null}
                  <View pointerEvents="none" style={{ backgroundColor: 'rgba(24, 14, 9, 0.62)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
                  <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(198,154,85,0.2)', borderColor: theme.champagne, borderRadius: 18, borderWidth: 1, marginBottom: 9, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: theme.champagne, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }}>
                      {formatDateRange(event.startsAt, event.endsAt)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 27, fontWeight: '700', lineHeight: 31 }}>
                    {event.title}
                  </Text>
                  <Text style={{ color: theme.cream, fontSize: 11, lineHeight: 17, marginTop: 6 }}>
                    {[event.venue, event.city, event.state].filter(Boolean).join(' · ')}
                  </Text>
                  {event.description ? (
                    <Text numberOfLines={3} style={{ color: theme.cream, fontSize: 10, lineHeight: 15, marginTop: 5 }}>
                      {event.description}
                    </Text>
                  ) : null}
                  {mediaQuery.isError ? <Text style={{ color: theme.terracottaLight, fontSize: 10, marginTop: 6 }}>Event artwork could not be loaded.</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 9, padding: 14 }}>
                  <HaatButton label="Get visitor pass" onPress={scrollToRegistration} />
                  <Link href="/(tabs)/contact" asChild>
                    <Pressable style={{ alignItems: 'center', borderColor: theme.border, borderRadius: 24, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 }}>
                      <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '700' }}>Contact us</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>

              {eventQuery.data.length > 1 ? (
                <View style={{ gap: 10 }}>
                  <Text style={styles.label}>Choose an exhibition</Text>
                  <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {eventQuery.data.map((offer) => {
                      const selected = offer.slug === event.slug;
                      return (
                        <Pressable
                          key={offer.id}
                          onPress={() => chooseEvent(offer.slug)}
                          style={{
                            backgroundColor: selected ? theme.terracotta : theme.surface,
                            borderColor: selected ? theme.terracotta : theme.border,
                            borderRadius: 14,
                            borderWidth: 1,
                            gap: 5,
                            minWidth: 210,
                            padding: 12,
                          }}>
                          <Text numberOfLines={2} style={{ color: selected ? theme.background : theme.cream, fontFamily: 'HaatDisplay', fontSize: 16, fontWeight: '700' }}>
                            {offer.title}
                          </Text>
                          <Text style={{ color: selected ? theme.background : theme.muted, fontSize: 10 }}>
                            {formatDateRange(offer.startsAt, offer.endsAt)} · {offer.city}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <View style={[styles.surface, { gap: 12 }]}>
                <Text style={styles.eyebrow}>Your visit, made simple</Text>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21, fontWeight: '700' }}>A celebration of art and artists</Text>
                <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 19 }}>
                  Discover original works, meet the creative community, and enjoy live demonstrations at the exhibition.
                </Text>
                <View style={{ gap: 9 }}>
                  <Benefit title="Explore the exhibition" text="Browse art and discover new artists in person." />
                  <Benefit title="Meet the community" text="Connect with artists, collectors, and fellow art lovers." />
                  <Benefit title="Plan with confidence" text="Your selected dates, venue, and pass options come from the published event." />
                </View>
              </View>

              <View
                onLayout={(layout) => { registerOffset.current = layout.nativeEvent.layout.y; }}
                style={[styles.surface, { gap: 14 }]}
              >
                <Text style={styles.eyebrow}>Visitor registration</Text>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 23, fontWeight: '700' }}>Reserve your visit</Text>
                <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>
                  Your pass is issued only after the email OTP is verified. Current pricing, capacity, and dates are checked again by the server.
                </Text>

                <View style={{ backgroundColor: theme.surfaceRaised, borderRadius: 13, gap: 5, padding: 12 }}>
                  <Text style={{ color: theme.cream, fontSize: 12, fontWeight: '700' }}>{event.title}</Text>
                  <Text style={{ color: theme.muted, fontSize: 10 }}>{formatDateRange(event.startsAt, event.endsAt)} · {[event.venue, event.city].filter(Boolean).join(' · ')}</Text>
                </View>

                {!otpEmail ? (
                  <>
                    <Text style={styles.label}>Choose your pass</Text>
                    <View style={{ flexDirection: 'row', gap: 9 }}>
                      {plans.map((plan) => {
                        const selected = passPlan === plan;
                        const available = planAvailable(plan);
                        const perks = plan === 'FREE' ? event.passConfig.freePerks : event.passConfig.paidPerks;
                        return (
                          <Pressable
                            key={plan}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: !available }}
                            disabled={!available}
                            onPress={() => setPassPlan(plan)}
                            style={{
                              backgroundColor: selected ? theme.terracotta : theme.surfaceRaised,
                              borderColor: selected ? theme.terracotta : theme.border,
                              borderRadius: 13,
                              borderWidth: 1,
                              flex: 1,
                              gap: 5,
                              minHeight: 88,
                              opacity: available ? 1 : 0.5,
                              padding: 11,
                            }}>
                            <Text style={{ color: selected ? theme.background : theme.cream, fontSize: 11, fontWeight: '800' }}>
                              {plan === 'FREE' ? 'General Entry · Free' : `VIP · ₹${event.passConfig.paidPrice.toLocaleString('en-IN')}`}
                            </Text>
                            <Text style={{ color: selected ? theme.background : theme.muted, fontSize: 9 }}>
                              {plan === 'FREE'
                                ? event.passConfig.freeRemaining === null ? 'Availability from the event' : `${event.passConfig.freeRemaining} left`
                                : event.passConfig.paidRemaining === null ? 'Availability from the event' : `${event.passConfig.paidRemaining} left`}
                            </Text>
                            {!available ? <Text style={{ color: theme.danger, fontSize: 9 }}>Currently unavailable</Text> : null}
                            {perks.length ? <Text numberOfLines={2} style={{ color: selected ? theme.background : theme.muted, fontSize: 9 }}>{perks[0]}</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, gap: 6, padding: 11 }}>
                      <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '800' }}>
                        {passPlan === 'FREE' ? 'General entry includes' : 'VIP reservation includes'}
                      </Text>
                      {(passPlan === 'FREE' ? event.passConfig.freePerks : event.passConfig.paidPerks).map((perk) => (
                        <Text key={perk} style={{ color: theme.cream, fontSize: 10, lineHeight: 15 }}>• {perk}</Text>
                      ))}
                      {passPlan === 'PAID' ? (
                        <Text style={{ color: theme.terracottaLight, fontSize: 9, lineHeight: 14 }}>
                          Payment is not enabled yet; the reservation QR remains invalid for entry until payment is confirmed.
                        </Text>
                      ) : null}
                    </View>

                    {visitDays.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.label}>Choose a visit day</Text>
                        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {visitDays.map((day) => {
                            const selected = preferredVisitDay === day;
                            return (
                              <Pressable
                                key={day}
                                onPress={() => setPreferredVisitDay(day)}
                                style={{
                                  backgroundColor: selected ? theme.terracotta : theme.surfaceRaised,
                                  borderColor: selected ? theme.terracotta : theme.border,
                                  borderRadius: 11,
                                  borderWidth: 1,
                                  minWidth: 86,
                                  paddingHorizontal: 10,
                                  paddingVertical: 9,
                                }}>
                                <Text style={{ color: selected ? theme.background : theme.cream, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{formatVisitDay(day)}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : (
                      <Field label="Visit date (YYYY-MM-DD)" value={preferredVisitDay} onChangeText={setPreferredVisitDay} placeholder="YYYY-MM-DD" />
                    )}

                    <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
                    <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                    <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="10-digit phone number" keyboardType="phone-pad" />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}><Field label="City" value={city} onChangeText={setCity} placeholder="Your city" /></View>
                      <View style={{ flex: 1 }}><Field label="State" value={state} onChangeText={setState} placeholder="Your state" /></View>
                    </View>
                    <Field label="Number of passes (1–10)" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="number-pad" />
                    {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                    {requestOtp.isError ? <Text style={styles.errorText}>{getApiErrorMessage(requestOtp.error)}</Text> : null}
                    <HaatButton
                      label={requestOtp.isPending ? 'Sending verification code…' : 'Send email verification code'}
                      onPress={() => requestVerificationCode()}
                      disabled={requestOtp.isPending || unavailable}
                    />
                  </>
                ) : (
                  <View style={{ gap: 13 }}>
                    <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>{otpMessage}</Text>
                    <Text style={{ color: theme.champagne, fontSize: 12, fontWeight: '700' }}>{otpEmail}</Text>
                    <Field
                      label="6-digit email verification code"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      placeholder="000000"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                    {verifyOtp.isError ? <Text style={styles.errorText}>{getApiErrorMessage(verifyOtp.error)}</Text> : null}
                    <HaatButton
                      label={verifyOtp.isPending ? 'Verifying your email…' : 'Verify email and get pass'}
                      onPress={verifyEmail}
                      disabled={verifyOtp.isPending}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={resendSeconds > 0 || requestOtp.isPending}
                      onPress={() => registrationPayload && requestVerificationCode(registrationPayload)}
                      style={{ alignItems: 'center', minHeight: 40, justifyContent: 'center', opacity: resendSeconds > 0 ? 0.55 : 1 }}>
                      <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '700' }}>
                        {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend verification code'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setOtpEmail('');
                        setOtpCode('');
                        setOtpMessage('');
                        setFormError('');
                        setResendUntil(0);
                        requestOtp.reset();
                        verifyOtp.reset();
                      }}
                      style={{ alignItems: 'center', minHeight: 40, justifyContent: 'center' }}>
                      <Text style={{ color: theme.muted, fontSize: 10, textDecorationLine: 'underline' }}>Change pass or visit details</Text>
                    </Pressable>
                    {requestOtp.isError ? <Text style={styles.errorText}>{getApiErrorMessage(requestOtp.error)}</Text> : null}
                  </View>
                )}
              </View>

              <View style={[styles.surface, { gap: 10 }]}>
                <Text style={styles.eyebrow}>How it works</Text>
                <Step number="01" title="Choose your exhibition and pass" />
                <Step number="02" title="Verify the email address with OTP" />
                <Step number="03" title="Show your confirmed QR pass at entry" />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'email-address' | 'phone-pad' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.subtle}
        style={styles.field}
        value={value}
      />
    </View>
  );
}

function Benefit({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, gap: 4, padding: 11 }}>
      <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 16 }}>{text}</Text>
    </View>
  );
}

function Step({ number, title }: { number: string; title: string }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 12, flexDirection: 'row', gap: 11, padding: 11 }}>
      <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '800' }}>{number}</Text>
      <Text style={{ color: theme.cream, flex: 1, fontSize: 11 }}>{title}</Text>
    </View>
  );
}

function getVisitDays(startsAt: string, endsAt: string) {
  const firstDay = startsAt.slice(0, 10);
  const lastDay = endsAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDay) || !/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) return [];
  const days: string[] = [];
  const current = new Date(`${firstDay}T00:00:00.000Z`);
  const end = new Date(`${lastDay}T00:00:00.000Z`);
  while (current <= end && days.length < 31) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function formatVisitDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
