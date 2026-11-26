import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AutoScrollRow, HaatText as Text, MessageState, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import {
  api,
  BookingExhibition,
  EventFlowContent,
  HomepageMedia,
  InvitedGuest,
  getApiErrorMessage,
  resolveMediaUrl,
} from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

type HomepageHero = {
  slides: { id: string; imageUrl: string; altText: string; caption: string; sortOrder: number; isActive: boolean }[];
};

type PublicSiteSettings = {
  settings: {
    footer?: {
      newsletterTitle?: string;
      newsletterText?: string;
    };
  } | null;
};

export default function EventsScreen() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [failedPhaseImages, setFailedPhaseImages] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [expandedScheduleDay, setExpandedScheduleDay] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const programmeOffset = useRef(0);
  const heroSlideInitialized = useRef(false);
  const { width } = useWindowDimensions();
  const router = useRouter();
  const heroHeight = Math.min(290, Math.max(205, width * 0.58));
  const phaseCardHeight = Math.min(154, Math.max(130, width * 0.35));
  useRefreshOnFocus('events');

  const eventFlow = useQuery({
    queryKey: ['events-page', 'event-flow'],
    queryFn: async () => (await api.get<EventFlowContent>('/event-flow')).data,
  });
  const homepageHero = useQuery({
    queryKey: ['events-page', 'homepage-hero'],
    queryFn: async () => (await api.get<HomepageHero>('/homepage')).data,
  });
  const homepageMedia = useQuery({
    queryKey: ['events-page', 'homepage-media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
  });
  const invitedGuests = useQuery({
    queryKey: ['events-page', 'invited-guests'],
    queryFn: async () => (await api.get<InvitedGuest[]>('/invited-guests', { params: { page: 'exhibitions' } })).data,
  });
  const bookingEvents = useQuery({
    queryKey: ['events-page', 'booking-events'],
    queryFn: async () => (await api.get<BookingExhibition[]>('/bookings/exhibitions')).data,
  });
  const siteSettings = useQuery({
    queryKey: ['events-page', 'site-settings'],
    queryFn: async () => (await api.get<PublicSiteSettings>('/site-settings')).data,
  });

  const slides = useMemo(
    () => (homepageHero.data?.slides ?? [])
      .filter((slide) => slide.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    [homepageHero.data?.slides],
  );
  useEffect(() => {
    if (!slides.length || heroSlideInitialized.current) return;
    heroSlideInitialized.current = true;
    const gallerySlide = slides.findIndex((slide) => /gallery/i.test(`${slide.altText} ${slide.caption}`));
    if (gallerySlide >= 0) setActiveSlide(gallerySlide);
  }, [slides]);
  const currentSlide = slides.length ? slides[activeSlide % slides.length] : undefined;
  const activeEvent = (bookingEvents.data ?? [])
    .filter((event) => new Date(event.endsAt).getTime() >= Date.now())
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0];
  const phaseHero = eventFlow.data?.phases[0]?.imageUrl;
  const heroImage = resolveMediaUrl(currentSlide?.imageUrl ?? phaseHero ?? activeEvent?.media[0]?.url ?? homepageMedia.data?.hero?.url);
  const lastPhaseIndex = (eventFlow.data?.phases.length ?? 0) - 1;
  const ctaImage = resolveMediaUrl(
    eventFlow.data?.phases[lastPhaseIndex]?.imageUrl
      || homepageMedia.data?.highlight5?.url
      || heroImage,
  );
  const footer = siteSettings.data?.settings?.footer;
  const refreshing = [eventFlow, homepageHero, homepageMedia, invitedGuests, bookingEvents, siteSettings]
    .some((query) => query.isRefetching);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImage]);

  useEffect(() => {
    if (slides.length < 2) {
      setActiveSlide(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5_000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const newsletter = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Enter a valid email address.');
      }
      return (await api.post<{ message?: string }>('/newsletter/subscribe', { email: cleanEmail })).data;
    },
    onSuccess: (result) => {
      setNewsletterMessage(result.message || 'Thanks for subscribing to event updates.');
      setEmail('');
    },
    onError: (error) => setNewsletterMessage(getApiErrorMessage(error)),
  });

  async function refresh() {
    await Promise.all([
      eventFlow.refetch(),
      homepageHero.refetch(),
      homepageMedia.refetch(),
      invitedGuests.refetch(),
      bookingEvents.refetch(),
      siteSettings.refetch(),
    ]);
  }

  function bookStall() {
    router.push(activeEvent
      ? { pathname: '/book-stall', params: { eventId: activeEvent.id } }
      : '/book-stall');
  }

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { gap: 20, paddingTop: 8, paddingBottom: 28 }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {eventFlow.isPending ? (
          <MessageState title="Loading event programme" description="Getting the published event programme from the database." loading />
        ) : eventFlow.isError ? (
          <MessageState title="Event programme could not load" description={getApiErrorMessage(eventFlow.error)} />
        ) : (
          <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 20, borderWidth: 1, height: heroHeight, overflow: 'hidden', position: 'relative' }}>
            {heroImage && !heroImageFailed ? (
              <Image
                source={{ uri: heroImage }}
                contentFit="cover"
                transition={300}
                onError={() => setHeroImageFailed(true)}
                accessibilityLabel={currentSlide?.altText || eventFlow.data.title}
                style={{ height: '100%', position: 'absolute', width: '100%' }}
              />
            ) : null}
            <View pointerEvents="none" style={{ backgroundColor: 'rgba(24, 14, 9, 0.57)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
            <View style={{ gap: 8, left: 16, position: 'absolute', right: 16, top: 19 }}>
              <Text numberOfLines={1} style={{ color: theme.champagne, fontSize: 9, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>
                {eventFlow.data.kicker}
              </Text>
              <Text adjustsFontSizeToFit numberOfLines={3} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 25, fontStyle: 'italic', fontWeight: '600', lineHeight: 29 }}>
                {eventFlow.data.title}
              </Text>
              <Text numberOfLines={3} style={{ color: theme.cream, fontSize: 11, lineHeight: 16 }}>
                {eventFlow.data.subtitle}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => scrollRef.current?.scrollTo({ y: programmeOffset.current, animated: true })}
                  style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 40, paddingHorizontal: 13 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Explore Programmes</Text>
                  <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#FFFFFF" size={14} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/pass-register')}
                  style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 13 }}>
                  <Text style={{ color: theme.cream, fontSize: 10, fontWeight: '700' }}>Book a Visit Pass</Text>
                </Pressable>
              </View>
            </View>
            {slides.length > 1 ? (
              <View style={{ bottom: 12, flexDirection: 'row', gap: 7, position: 'absolute', right: 14 }}>
                {slides.map((slide, index) => (
                  <Pressable
                    key={slide.id}
                    accessibilityLabel={`Show hero slide ${index + 1}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === activeSlide }}
                    onPress={() => setActiveSlide(index)}
                    style={{ backgroundColor: index === activeSlide ? theme.terracotta : 'rgba(246,233,215,0.65)', borderRadius: 5, height: 8, width: 8 }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}

        <View style={{ gap: 10 }}>
          <SectionHeading title="Celebrities, Chief Guests & Luminaries" detail="Eminent personalities from our exhibition editions" />
          {invitedGuests.isPending ? (
            <MessageState title="Loading invited guests" description="Getting published guest profiles." loading />
          ) : invitedGuests.isError ? (
            <MessageState title="Invited guests could not load" description={getApiErrorMessage(invitedGuests.error)} />
          ) : invitedGuests.data.length ? (
            <AutoScrollRow gap={10} speed={0.25}>
              {invitedGuests.data.map((guest) => (
                <View key={guest.id} style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 14, borderWidth: 1, height: 135, justifyContent: 'flex-end', overflow: 'hidden', position: 'relative', width: 160 }}>
                  {guest.photoUrl ? (
                    <Image source={{ uri: resolveMediaUrl(guest.photoUrl) ?? undefined }} contentFit="cover" accessibilityLabel={guest.name} style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
                  ) : (
                    <View style={{ alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 }}>
                      <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 30, fontWeight: '700' }}>{guestMonogram(guest.name)}</Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'center', backgroundColor: 'rgba(24,14,9,0.78)', gap: 3, paddingHorizontal: 7, paddingVertical: 6 }}>
                    {guest.roleBadge ? <Text numberOfLines={1} style={{ color: theme.champagne, fontSize: 7, fontWeight: '800', textTransform: 'uppercase' }}>{guest.roleBadge}</Text> : null}
                    <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{guest.name}</Text>
                    {guest.designation ? <Text numberOfLines={1} style={{ color: theme.cream, fontSize: 8, textAlign: 'center' }}>{guest.designation}</Text> : null}
                  </View>
                </View>
              ))}
            </AutoScrollRow>
          ) : (
            <MessageState title="No invited guests published" description="Active exhibition guest records will appear here." />
          )}
        </View>

        <View onLayout={(event) => { programmeOffset.current = event.nativeEvent.layout.y; }} style={{ gap: 5 }}>
          <SectionHeading
            title={`A National Showcase, Shaped in ${eventFlow.data?.phases.length ?? 5} Acts`}
            detail={eventFlow.data?.subtitle}
          />
          {eventFlow.isPending ? (
            <MessageState title="Loading programme acts" description="Getting the published five-act programme." loading />
          ) : eventFlow.isError ? (
            <MessageState title="Programme acts could not load" description={getApiErrorMessage(eventFlow.error)} />
          ) : (
            eventFlow.data.phases.map((phase, index) => {
              const phaseSource = resolveMediaUrl(phase.imageUrl);
              const phaseFallback = resolveMediaUrl(
                homepageMedia.data?.[`highlight${index + 1}`]?.url
                  || homepageMedia.data?.hero?.url,
              );
              const phaseImage = phaseSource && failedPhaseImages[phase.id] !== phaseSource
                ? phaseSource
                : phaseFallback;
              return (
              <View key={phase.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', height: phaseCardHeight, marginTop: 9, overflow: 'hidden' }}>
                <View style={{ backgroundColor: theme.surfaceRaised, height: phaseCardHeight, position: 'relative', width: '52%' }}>
                  {phaseImage ? (
                    <Image
                      source={{ uri: phaseImage }}
                      contentFit="cover"
                      transition={200}
                      accessibilityLabel={phase.title}
                      onError={() => {
                        if (phaseSource) {
                          setFailedPhaseImages((failed) => ({ ...failed, [phase.id]: phaseSource }));
                        }
                      }}
                      style={{ height: phaseCardHeight, width: '100%' }}
                    />
                  ) : null}
                  <View style={{ backgroundColor: 'rgba(29,17,11,0.86)', borderColor: theme.champagne, borderRadius: 16, borderWidth: 1, left: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 8 }}>
                    <Text numberOfLines={1} style={{ color: theme.champagne, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>{phase.number || phase.id}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 4, height: phaseCardHeight, justifyContent: 'center', overflow: 'hidden', padding: 8 }}>
                  <Text numberOfLines={1} style={{ color: theme.terracotta, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{phase.timeframe}</Text>
                  <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 14, fontWeight: '600', lineHeight: 17 }}>{phase.title}</Text>
                  {phase.activities.slice(0, 3).map((activity, index) => (
                    <View key={`${phase.id}-${index}`} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 4 }}>
                      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.champagne} size={11} />
                      <Text numberOfLines={1} style={{ color: theme.cream, flex: 1, fontSize: 9, lineHeight: 12 }}>{activity}</Text>
                    </View>
                  ))}
                </View>
              </View>
              );
            })
          )}
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeading title="Programme at a Glance" detail="Published schedule and activities" />
          {eventFlow.isPending ? (
            <MessageState title="Loading programme schedule" description="Getting the published schedule." loading />
          ) : eventFlow.isError ? (
            <MessageState title="Programme schedule could not load" description={getApiErrorMessage(eventFlow.error)} />
          ) : eventFlow.data.schedule.length ? (
            <View style={{ gap: 7 }}>
              {eventFlow.data.schedule.map((day) => {
                const isExpanded = expandedScheduleDay === day.day;
                return (
                  <View key={`${day.day}-${day.title}`} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 11, borderWidth: 1, overflow: 'hidden' }}>
                    <Pressable
                      accessibilityLabel={`${day.day}: ${day.title}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      onPress={() => setExpandedScheduleDay((current) => current === day.day ? null : day.day)}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 54, paddingHorizontal: 11, paddingVertical: 8 }}>
                      <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={theme.terracotta} size={18} />
                      <Text numberOfLines={1} style={{ color: theme.cream, flex: 1, fontSize: 11, fontWeight: '700' }}>{day.title}</Text>
                      <Text numberOfLines={1} style={{ color: theme.champagne, fontSize: 9, fontWeight: '700' }}>{day.day}</Text>
                      <SymbolView
                        name={isExpanded
                          ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                          : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                        tintColor={theme.champagne}
                        size={13}
                      />
                    </Pressable>
                    {isExpanded ? (
                      <View style={{ borderTopColor: theme.border, borderTopWidth: 1, gap: 9, paddingHorizontal: 12, paddingVertical: 10 }}>
                        {day.items.map((item, itemIndex) => (
                          <View key={`${item.period}-${item.time}-${itemIndex}`} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 9 }}>
                            <View style={{ width: 86 }}>
                              <Text style={{ color: theme.champagne, fontSize: 8, fontWeight: '700' }}>{item.period}</Text>
                              <Text style={{ color: theme.muted, fontSize: 9 }}>{item.time}</Text>
                            </View>
                            <Text style={{ color: theme.cream, flex: 1, fontSize: 10, lineHeight: 15 }}>{item.activity}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <MessageState title="No programme dates published" description="Schedule entries will appear here when available." />
          )}
        </View>

        {eventFlow.data ? (
          <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 17, borderWidth: 1, height: 148, overflow: 'hidden', position: 'relative' }}>
            {ctaImage ? <Image source={{ uri: ctaImage }} contentFit="cover" accessibilityLabel="Exhibition programme" style={{ height: '100%', position: 'absolute', width: '100%' }} /> : null}
            <View pointerEvents="none" style={{ backgroundColor: 'rgba(24, 14, 9, 0.76)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
            <View style={{ alignItems: 'center', gap: 8, height: 148, justifyContent: 'center', padding: 14 }}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21, fontWeight: '600', textAlign: 'center' }}>
                {eventFlow.data.ctaTitle}
              </Text>
              {activeEvent ? (
                <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 10, textAlign: 'center' }}>
                  {`${activeEvent.title} · ${activeEvent.city} · ${formatDateRange(activeEvent.startsAt, activeEvent.endsAt)}`}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                <Pressable accessibilityRole="button" onPress={bookStall} style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 20, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Book a Stall →</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/pass-register')} style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 20, borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 }}>
                  <Text style={{ color: theme.cream, fontSize: 10, fontWeight: '700' }}>Attend the Exhibition</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {[homepageHero, homepageMedia, invitedGuests, bookingEvents, siteSettings, eventFlow].some((query) => query.isError) ? (
          <Text style={styles.errorText}>Some event content could not refresh. Pull down to retry.</Text>
        ) : null}

        <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 13 }}>
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 7 }}>
              <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} tintColor={theme.champagne} size={18} />
              <Text style={{ color: theme.cream, fontSize: 12, fontWeight: '700' }}>
                {footer?.newsletterTitle || 'Stay Connected with The Haat of Art'}
              </Text>
            </View>
            <Text style={{ color: theme.muted, fontSize: 9, lineHeight: 14 }}>
              {footer?.newsletterText || 'Get event updates and artist news in your inbox.'}
            </Text>
          </View>
          <View style={{ borderLeftColor: theme.border, borderLeftWidth: 1, gap: 7, paddingLeft: 12, width: '48%' }}>
            <TextInput
              accessibilityLabel="Email address for event updates"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                setNewsletterMessage('');
              }}
              onSubmitEditing={() => newsletter.mutate()}
              placeholder="Enter your email address"
              placeholderTextColor={theme.muted}
              returnKeyType="done"
              style={{ backgroundColor: theme.background, borderColor: theme.border, borderRadius: 20, borderWidth: 1, color: theme.cream, fontSize: 10, minHeight: 38, paddingHorizontal: 10 }}
              value={email}
            />
            <Pressable accessibilityRole="button" disabled={newsletter.isPending} onPress={() => newsletter.mutate()} style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 20, justifyContent: 'center', minHeight: 38, opacity: newsletter.isPending ? 0.65 : 1, paddingHorizontal: 12 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{newsletter.isPending ? 'Sending…' : 'Subscribe'}</Text>
            </Pressable>
            <Text style={{ color: theme.muted, fontSize: 8, lineHeight: 11, textAlign: 'center' }}>We respect your privacy. Unsubscribe anytime.</Text>
            {newsletterMessage ? <Text accessibilityLiveRegion="polite" style={{ color: newsletter.isError ? theme.terracottaLight : theme.success, fontSize: 10 }}>{newsletterMessage}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8, width: '100%' }}>
        <View style={{ backgroundColor: theme.champagne, flex: 1, height: 1, minWidth: 10 }} />
        <Text numberOfLines={2} style={{ color: theme.cream, flexShrink: 1, fontFamily: 'HaatDisplay', fontSize: 16, fontWeight: '600', lineHeight: 20, textAlign: 'center' }}>{title}</Text>
        <View style={{ backgroundColor: theme.champagne, flex: 1, height: 1, minWidth: 10 }} />
      </View>
      {detail ? <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' }}>{detail}</Text> : null}
    </View>
  );
}

function guestMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => !/^(dr\.?|mr\.?|mrs\.?|ms\.?|shri|smt\.?)$/i.test(word));
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || 'TH';
}
