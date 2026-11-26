import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AutoScrollRow, HaatText as Text, MessageState, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import {
  api,
  BookingExhibition,
  EventFlowContent,
  HomepageContent,
  HomepageMedia,
  InvitedGuest,
  MediaPartner,
  SiteContent,
  StallType,
  getApiErrorMessage,
  resolveMediaUrl,
} from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

type HomepageHero = {
  slides: { id: string; imageUrl: string; altText: string; caption: string; sortOrder: number; isActive: boolean }[];
};

type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
  isActive: boolean;
  isFeaturedMentor: boolean;
};

type PublicSiteSettings = {
  settings: {
    footer?: {
      newsletterTitle?: string;
      newsletterText?: string;
    };
  } | null;
};

const homepageIcons = {
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  users: { ios: 'person.2', android: 'groups', web: 'groups' },
  accessibility: { ios: 'figure.roll', android: 'accessible', web: 'accessible' },
  palette: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  image: { ios: 'photo', android: 'image', web: 'image' },
  landmark: { ios: 'building.columns', android: 'account_balance', web: 'account_balance' },
  brush: { ios: 'paintbrush.pointed', android: 'brush', web: 'brush' },
  archive: { ios: 'archivebox', android: 'inventory_2', web: 'inventory_2' },
} as const;

const stepIcons = [
  { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  { ios: 'person.text.rectangle', android: 'assignment_ind', web: 'assignment_ind' },
  { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
] as const;

const exhibitionSteps = [
  { title: 'Choose Your Stall', detail: 'Select a space that fits your needs' },
  { title: 'Complete Registration', detail: 'Share your details and artwork information' },
  { title: 'Set Up & Exhibit', detail: 'Showcase your work at the event' },
];

export default function ExhibitionsScreen() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [email, setEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const benefitCardWidth = Math.min(155, Math.max(130, width * 0.39));
  const stepCardWidth = Math.min(230, Math.max(190, width * 0.58));
  const stallCardWidth = Math.max(135, (width - 48) / 2);
  useRefreshOnFocus('exhibitions');

  const exhibitions = useQuery({
    queryKey: ['exhibitions', 'live'],
    queryFn: async () => (await api.get<BookingExhibition[]>('/bookings/exhibitions')).data,
  });
  const homepage = useQuery({
    queryKey: ['exhibitions', 'homepage'],
    queryFn: async () => (await api.get<{ homepage: HomepageContent | null }>('/site-settings/homepage')).data.homepage,
  });
  const homepageMedia = useQuery({
    queryKey: ['exhibitions', 'homepage-media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
  });
  const homepageHero = useQuery({
    queryKey: ['exhibitions', 'homepage-hero'],
    queryFn: async () => (await api.get<HomepageHero>('/homepage')).data,
  });
  const siteContent = useQuery({
    queryKey: ['exhibitions', 'site-content'],
    queryFn: async () => (await api.get<SiteContent>('/content')).data,
  });
  const siteSettings = useQuery({
    queryKey: ['exhibitions', 'site-settings'],
    queryFn: async () => (await api.get<PublicSiteSettings>('/site-settings')).data,
  });
  const invitedGuests = useQuery({
    queryKey: ['exhibitions', 'invited-guests'],
    queryFn: async () => (await api.get<InvitedGuest[]>('/invited-guests', { params: { page: 'exhibitions' } })).data,
  });
  const eventFlow = useQuery({
    queryKey: ['exhibitions', 'event-flow'],
    queryFn: async () => (await api.get<EventFlowContent>('/event-flow')).data,
  });
  const partners = useQuery({
    queryKey: ['exhibitions', 'partners'],
    queryFn: async () => (await api.get<MediaPartner[]>('/media-partners', { params: { page: 'exhibitions' } })).data,
  });
  const stallTypes = useQuery({
    queryKey: ['exhibitions', 'stall-types'],
    queryFn: async () => (await api.get<StallType[]>('/bookings/stall-types')).data,
  });
  const about = useQuery({
    queryKey: ['exhibitions', 'about-mentor'],
    queryFn: async () => (await api.get<{ published: { state: { team: AboutTeamMember[] } } | null }>('/about')).data.published,
  });

  const items = exhibitions.data ?? [];
  const selectedExhibition = items.find((event) => event.id === selectedEventId) ?? items[0];
  const heroSlides = useMemo(
    () => (homepageHero.data?.slides ?? [])
      .filter((slide) => slide.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    [homepageHero.data?.slides],
  );
  const currentSlide = heroSlides.length ? heroSlides[activeSlide % heroSlides.length] : undefined;
  const eventImage = selectedExhibition?.media.find((media) => media.mediaType === 'IMAGE')?.url;
  const heroImage = resolveMediaUrl(currentSlide?.imageUrl ?? eventImage);
  const siteText = siteContent.data?.text ?? {};
  const heroTitle = siteText.heroLine1?.trim() || currentSlide?.caption?.trim() || selectedExhibition?.title || 'Showcase Your Art';
  const heroAccent = siteText.heroAccent?.trim();
  const heroIntro = siteText.heroIntro?.trim();
  const guests = invitedGuests.data ?? [];
  const mediaPartners = partners.data ?? [];
  const highlights = homepage.data?.highlights ?? [];
  const categories = homepage.data?.categories ?? [];
  const heroFeatures = homepage.data?.heroFeatures ?? [];
  const aboutTeam = about.data?.state.team ?? [];
  const featuredMentor = aboutTeam.find((member) => member.isActive && member.isFeaturedMentor);
  const mentorConfig = homepage.data?.mentor;
  const mentorImage = resolveMediaUrl(homepageMedia.data?.mentor?.url ?? featuredMentor?.photoUrl);
  const galleryImages = useMemo(
    () => Object.entries(homepageMedia.data ?? {})
      .filter(([key, media]) => /^gallery\d+$/.test(key) && Boolean(media.url))
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([, media]) => resolveMediaUrl(media.url))
      .filter((url): url is string => Boolean(url)),
    [homepageMedia.data],
  );
  const newsletterSettings = siteSettings.data?.settings?.footer;
  const refreshing = [
    exhibitions,
    homepage,
    homepageMedia,
    homepageHero,
    siteContent,
    siteSettings,
    invitedGuests,
    eventFlow,
    partners,
    stallTypes,
    about,
  ].some((query) => query.isRefetching);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImage]);

  useEffect(() => {
    if (!items.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(items[0]?.id ?? '');
    }
  }, [items, selectedEventId]);

  useEffect(() => {
    if (heroSlides.length < 2) {
      setActiveSlide(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5_000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const newsletter = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Enter a valid email address.');
      }
      return (await api.post<{ message?: string }>('/newsletter/subscribe', { email: cleanEmail })).data;
    },
    onSuccess: (result) => {
      setNewsletterMessage(result.message || 'Thanks for subscribing to exhibition updates.');
      setEmail('');
    },
    onError: (error) => setNewsletterMessage(getApiErrorMessage(error)),
  });

  async function refresh() {
    await Promise.all([
      exhibitions.refetch(),
      homepage.refetch(),
      homepageMedia.refetch(),
      homepageHero.refetch(),
      siteContent.refetch(),
      siteSettings.refetch(),
      invitedGuests.refetch(),
      eventFlow.refetch(),
      partners.refetch(),
      stallTypes.refetch(),
      about.refetch(),
    ]);
  }

  function bookSelectedExhibition() {
    router.push(selectedExhibition
      ? { pathname: '/book-stall', params: { eventId: selectedExhibition.id } }
      : '/book-stall');
  }

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 22, paddingTop: 8, paddingBottom: 28 }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 22, borderWidth: 1, height: Math.min(300, Math.max(265, width * 0.72)), overflow: 'hidden', position: 'relative' }}>
          {heroImage && !heroImageFailed ? (
            <Image
              source={{ uri: heroImage }}
              contentFit="cover"
              transition={300}
              onError={() => setHeroImageFailed(true)}
              accessibilityLabel={currentSlide?.altText || selectedExhibition?.title || 'The Haat of Art exhibition'}
              style={{ height: '100%', position: 'absolute', width: '100%' }}
            />
          ) : null}
          <View pointerEvents="none" style={{ backgroundColor: 'rgba(24, 14, 9, 0.52)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }} />
          <View style={{ gap: 7, left: 16, position: 'absolute', right: 56, top: 20 }}>
            <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>
              {siteText.heroKicker?.trim() || 'EXHIBITIONS'}
            </Text>
            <Text adjustsFontSizeToFit numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 28, fontStyle: 'italic', fontWeight: '600', lineHeight: 32 }}>
              {heroTitle}
            </Text>
            {heroAccent ? <Text style={{ color: theme.terracottaLight, fontFamily: 'HaatDisplay', fontSize: 24, fontStyle: 'italic', lineHeight: 28 }}>{heroAccent}</Text> : null}
            {heroIntro ? <Text numberOfLines={3} style={{ color: theme.cream, fontSize: 12, lineHeight: 18 }}>{heroIntro}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                onPress={bookSelectedExhibition}
                style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 42, paddingHorizontal: 13 }}>
                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Book Your Stall</Text>
                <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#FFFFFF" size={14} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/pass-register')}
                style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 13 }}>
                <Text numberOfLines={1} style={{ color: theme.cream, fontSize: 11, fontWeight: '700' }}>Visitor Pass</Text>
              </Pressable>
            </View>
          </View>
          {heroSlides.length > 1 ? (
            <View style={{ bottom: 12, flexDirection: 'row', gap: 7, position: 'absolute', right: 14 }}>
              {heroSlides.map((slide, index) => (
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

        <View style={{ gap: 11 }}>
          <SectionHeading title="Why Exhibit With Us?" action="Swipe to explore →" />
          {homepage.isPending ? (
            <MessageState title="Loading exhibition benefits" description="Getting the published highlights." loading />
          ) : homepage.isError ? (
            <MessageState title="Exhibition benefits could not load" description={getApiErrorMessage(homepage.error)} />
          ) : heroFeatures.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 9, paddingBottom: 4 }} nestedScrollEnabled showsHorizontalScrollIndicator>
              {heroFeatures.map((feature, index) => (
                <View key={`${feature.title}-${index}`} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, gap: 9, justifyContent: 'center', minHeight: 96, paddingHorizontal: 11, paddingVertical: 12, width: benefitCardWidth }}>
                  <SymbolView name={homepageIcons[feature.icon]} tintColor={theme.terracotta} size={22} />
                  <Text numberOfLines={3} style={{ color: theme.cream, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                    {[feature.title, feature.subtitle].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <MessageState title="No exhibition benefits published" description="Published benefits will appear here." />
          )}
        </View>

        <View style={{ gap: 11 }}>
          <SectionHeading title="Invited Guests & Luminaries" action="Swipe to see all →" />
          {invitedGuests.isPending ? (
            <MessageState title="Loading invited guests" description="Getting all published exhibition guest profiles." loading />
          ) : invitedGuests.isError ? (
            <MessageState title="Invited guests could not load" description={getApiErrorMessage(invitedGuests.error)} />
          ) : guests.length ? (
            <AutoScrollRow gap={10} speed={0.25}>
              {guests.map((guest) => (
                <View key={guest.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, gap: 5, justifyContent: 'center', minHeight: 132, padding: 10, width: 155 }}>
                  {guest.photoUrl ? (
                    <Image source={{ uri: resolveMediaUrl(guest.photoUrl) ?? undefined }} contentFit="cover" accessibilityLabel={guest.name} style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.champagne, borderRadius: 32, borderWidth: 1, height: 58, width: 58 }} />
                  ) : (
                    <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.champagne, borderRadius: 32, borderWidth: 1, height: 58, justifyContent: 'center', width: 58 }}>
                      <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 19, fontWeight: '700' }}>{guestMonogram(guest.name)}</Text>
                    </View>
                  )}
                  {guest.roleBadge ? <Text numberOfLines={1} style={{ color: theme.terracotta, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{guest.roleBadge}</Text> : null}
                  <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{guest.name}</Text>
                  {guest.designation ? <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 10, textAlign: 'center' }}>{guest.designation}</Text> : null}
                  {guest.editionTag ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 9, textAlign: 'center' }}>{guest.editionTag}</Text> : null}
                </View>
              ))}
            </AutoScrollRow>
          ) : (
            <MessageState title="No invited guests published" description="Active exhibition guests from the database will appear here." />
          )}
        </View>

        <View style={{ gap: 11 }}>
          <SectionHeading title="More Than a Space to Show Your Work" action="Swipe to explore →" />
          {homepage.isPending ? (
            <MessageState title="Loading artist benefits" description="Getting published exhibition highlights." loading />
          ) : homepage.isError ? (
            <MessageState title="Artist benefits could not load" description={getApiErrorMessage(homepage.error)} />
          ) : highlights.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 9, paddingBottom: 5 }} nestedScrollEnabled showsHorizontalScrollIndicator>
              {highlights.map((highlight, index) => (
                <View key={`${highlight.title}-${index}`} style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 68, padding: 11, width: Math.min(235, Math.max(205, width * 0.6)) }}>
                  <SymbolView name={homepageIcons[['calendar', 'users', 'image', 'landmark', 'brush'][index % 5] as keyof typeof homepageIcons]} tintColor={theme.terracotta} size={20} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: theme.cream, fontSize: 11, fontWeight: '700' }}>{highlight.title}</Text>
                    {highlight.description ? <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 10, lineHeight: 14 }}>{highlight.description}</Text> : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <MessageState title="No artist benefits published" description="Published exhibition highlights will appear here." />
          )}
        </View>

        <View style={{ gap: 11 }}>
          <SectionHeading title="How Exhibiting Works" detail="3 simple steps" />
          <ScrollView horizontal contentContainerStyle={{ alignItems: 'center', gap: 8, paddingBottom: 5 }} nestedScrollEnabled showsHorizontalScrollIndicator>
            {exhibitionSteps.map((step, index) => (
              <View key={step.title} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 82, padding: 11, width: stepCardWidth }}>
                <View style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 20, height: 38, justifyContent: 'center', width: 38 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 12, fontWeight: '700' }}>{step.title}</Text>
                  <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>{step.detail}</Text>
                </View>
                <SymbolView name={stepIcons[index]} tintColor={theme.champagne} size={18} />
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 11 }}>
          <SectionHeading title="Stall Categories & Specifications" detail="City-specific rates are not shown here." />
          {items.length > 1 ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingBottom: 2 }} nestedScrollEnabled showsHorizontalScrollIndicator>
              {items.map((event) => {
                const selected = event.id === selectedExhibition?.id;
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedEventId(event.id)}
                    style={{ backgroundColor: selected ? theme.terracotta : theme.surface, borderColor: selected ? theme.terracotta : theme.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text numberOfLines={1} style={{ color: selected ? '#FFFFFF' : theme.cream, fontSize: 10, fontWeight: '700' }}>
                      {[getCityLabel(event.city), formatDateRange(event.startsAt, event.endsAt)].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {stallTypes.isPending ? (
            <MessageState title="Loading stall categories" description="Getting active stall specifications from the database." loading />
          ) : stallTypes.isError ? (
            <MessageState title="Stall categories could not load" description={getApiErrorMessage(stallTypes.error)} />
          ) : stallTypes.data.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stallTypes.data.map((stall, index) => {
                const image = galleryImages[index % Math.max(galleryImages.length, 1)] || resolveMediaUrl(eventImage);
                return (
                  <View key={stall.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, overflow: 'hidden', width: stallCardWidth }}>
                    {image ? <Image source={{ uri: image }} contentFit="cover" accessibilityLabel={`${stall.name} exhibition space`} style={{ aspectRatio: 1.2, backgroundColor: theme.surfaceRaised, width: '100%' }} /> : null}
                    <View style={{ gap: 5, padding: 10 }}>
                      <Text numberOfLines={1} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 15, fontWeight: '600' }}>{stall.name}</Text>
                      <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700' }}>
                        {stall.widthM}m × {stall.depthM}m · {(stall.widthM * stall.depthM).toFixed(0)} SQM
                      </Text>
                      {stall.includes ? <Text numberOfLines={3} style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>{stall.includes}</Text> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={bookSelectedExhibition}
                        style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 18, justifyContent: 'center', marginTop: 3, minHeight: 36 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Book This Stall →</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <MessageState title="Stall categories are being updated" description="Published stall specifications will appear here when available." />
          )}
        </View>

        <View style={{ gap: 11 }}>
          <SectionHeading title="Media, Press & Outdoor Alliances" action="Swipe to see all →" />
          {partners.isPending ? (
            <MessageState title="Loading media partners" description="Getting all published exhibition partners." loading />
          ) : partners.isError ? (
            <MessageState title="Media partners could not load" description={getApiErrorMessage(partners.error)} />
          ) : mediaPartners.length ? (
            <AutoScrollRow gap={10} speed={0.25}>
              {mediaPartners.map((partner) => (
                <View key={partner.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, gap: 7, justifyContent: 'center', minHeight: 76, paddingHorizontal: 12, paddingVertical: 10, width: 150 }}>
                  {partner.logoUrl ? (
                    <Image source={{ uri: resolveMediaUrl(partner.logoUrl) ?? undefined }} contentFit="contain" accessibilityLabel={partner.name} style={{ height: 34, width: 126 }} />
                  ) : (
                    <Text numberOfLines={1} style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{partner.name}</Text>
                  )}
                  {partner.logoUrl ? <Text numberOfLines={1} style={{ color: theme.cream, fontSize: 9, textAlign: 'center' }}>{partner.name}</Text> : null}
                  {partner.category ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 9, textAlign: 'center' }}>{partner.category}</Text> : null}
                </View>
              ))}
            </AutoScrollRow>
          ) : (
            <MessageState title="No media partners published" description="Active exhibition media and outdoor partners will appear here." />
          )}
        </View>

        {mentorConfig?.visible ? (
          <View style={{ gap: 11 }}>
            <SectionHeading title={mentorConfig.title || 'Our Mentor'} />
            {about.isPending ? (
              <MessageState title="Loading mentor profile" description="Getting the published mentor profile." loading />
            ) : about.isError ? (
              <MessageState title="Mentor profile could not load" description={getApiErrorMessage(about.error)} />
            ) : (
              <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 13 }}>
                {mentorImage ? (
                  <Image source={{ uri: mentorImage }} contentFit="cover" accessibilityLabel={featuredMentor?.name || mentorConfig.name} style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, height: 76, width: 76 }} />
                ) : (
                  <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 12, height: 76, justifyContent: 'center', width: 76 }}>
                    <SymbolView name={{ ios: 'person.crop.square', android: 'account_box', web: 'account_box' }} tintColor={theme.champagne} size={34} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 16, fontWeight: '600' }}>{featuredMentor?.name || mentorConfig.name}</Text>
                  {featuredMentor?.role ? <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700' }}>{featuredMentor.role}</Text> : null}
                  <Text numberOfLines={3} style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>{featuredMentor?.bio || mentorConfig.bio}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => router.push('/about')}>
                  <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700' }}>Profile →</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ gap: 11 }}>
          <SectionHeading title="Why Participate?" action="Swipe to explore →" />
          {homepage.isPending ? (
            <MessageState title="Loading art categories" description="Getting published art categories." loading />
          ) : homepage.isError ? (
            <MessageState title="Art categories could not load" description={getApiErrorMessage(homepage.error)} />
          ) : categories.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 9, paddingBottom: 5 }} nestedScrollEnabled showsHorizontalScrollIndicator>
              {categories.map((category, index) => (
                <View key={`${category.title}-${index}`} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, gap: 8, justifyContent: 'center', minHeight: 94, padding: 10, width: benefitCardWidth }}>
                  <SymbolView name={homepageIcons[category.icon]} tintColor={theme.terracotta} size={21} />
                  <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{category.title}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <MessageState title="No art categories published" description="Published categories will appear here." />
          )}
        </View>

        <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20, fontStyle: 'italic', fontWeight: '600' }}>
              {eventFlow.data?.ctaTitle || 'Be a Part of The Haat of Art'}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>
              {selectedExhibition ? `${selectedExhibition.title} · ${formatDateRange(selectedExhibition.startsAt, selectedExhibition.endsAt)}` : 'Reserve your place at an upcoming exhibition.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={bookSelectedExhibition}
            style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, justifyContent: 'center', minHeight: 42, paddingHorizontal: 12 }}>
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Book Your Stall →</Text>
          </Pressable>
        </View>

        {[homepage, homepageMedia, homepageHero, siteContent, siteSettings, invitedGuests, eventFlow, partners, stallTypes, about, exhibitions].some((query) => query.isError) ? (
          <Text style={styles.errorText}>Some exhibition content could not refresh. Pull down to retry.</Text>
        ) : null}

        <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 }}>
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 7 }}>
              <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} tintColor={theme.champagne} size={18} />
              <Text style={{ color: theme.cream, fontSize: 13, fontWeight: '700' }}>
                {newsletterSettings?.newsletterTitle || 'Stay Connected with The Haat of Art'}
              </Text>
            </View>
            <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>
              {newsletterSettings?.newsletterText || 'Get exhibition updates, artist opportunities, and event invites.'}
            </Text>
          </View>
          <View style={{ borderLeftColor: theme.border, borderLeftWidth: 1, gap: 7, paddingLeft: 12, width: '48%' }}>
            <TextInput
              accessibilityLabel="Email address for exhibition updates"
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
            <Pressable
              accessibilityRole="button"
              disabled={newsletter.isPending}
              onPress={() => newsletter.mutate()}
              style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 20, justifyContent: 'center', minHeight: 36, opacity: newsletter.isPending ? 0.65 : 1, paddingHorizontal: 10 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{newsletter.isPending ? 'Sending…' : 'Subscribe'}</Text>
            </Pressable>
            <Text style={{ color: theme.muted, fontSize: 8, lineHeight: 11, textAlign: 'center' }}>We respect your privacy. Unsubscribe anytime.</Text>
            {newsletterMessage ? <Text accessibilityLiveRegion="polite" style={{ color: newsletter.isError ? theme.terracottaLight : theme.success, fontSize: 10 }}>{newsletterMessage}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: string }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
      <View style={{ backgroundColor: theme.terracotta, borderRadius: 2, height: 25, width: 3 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18, fontWeight: '600', lineHeight: 23 }}>{title}</Text>
        {detail ? <Text style={{ color: theme.muted, fontSize: 10 }}>{detail}</Text> : null}
      </View>
      {action ? <Text style={{ color: theme.terracotta, fontSize: 9, fontWeight: '700' }}>{action}</Text> : null}
    </View>
  );
}

function guestMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => !/^(dr\.?|mr\.?|mrs\.?|ms\.?|shri|smt\.?)$/i.test(word));
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || 'TH';
}

function getCityLabel(city: string) {
  return city.split(/[—–]/, 1)[0]?.trim() || city.trim();
}
