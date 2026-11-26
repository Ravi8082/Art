import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AutoScrollRow,
  ArtistCard,
  EventImage,
  HaatText as Text,
  MessageState,
  formatDateRange,
  styles,
} from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { formatBlogDate } from '@/lib/blog-storage';
import {
  api,
  type BlogSummary,
  Exhibition,
  HomepageContent,
  HomepageMedia,
  PublicArtist,
  SiteContent,
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

const homepageIcons = {
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  users: { ios: 'person.2', android: 'groups', web: 'groups' },
  accessibility: { ios: 'figure.roll', android: 'accessible', web: 'accessible' },
  palette: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  image: { ios: 'photo', android: 'image', web: 'image' },
  landmark: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  ticket: { ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' },
  handshake: { ios: 'hand.wave', android: 'handshake', web: 'handshake' },
  brush: { ios: 'paintbrush.pointed', android: 'brush', web: 'brush' },
  archive: { ios: 'archivebox', android: 'inventory_2', web: 'inventory_2' },
} as const;

const homeSectionSpacing = {
  paddingBottom: 0,
  paddingTop: 24,
};

async function loadArtists() {
  return (await api.get<PublicArtist[]>('/artist-profile/public')).data;
}

export default function DiscoverScreen() {
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [email, setEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const heroImageHeight = Math.min(270, Math.max(210, screenWidth * 0.57));
  const heroTitleSize = screenWidth < 380 ? 24 : 27;
  const quickActionWidth = Math.min(150, Math.max(68, (screenWidth - 64) / 4));
  const exhibitionCardWidth = Math.min(540, Math.max(300, screenWidth - 40));
  const categoryCardWidth = Math.min(78, Math.max(58, screenWidth * 0.16));
  useRefreshOnFocus('home');

  const eventsQuery = useQuery({
    queryKey: ['home', 'events'],
    queryFn: async () => (await api.get<{ events: Exhibition[] }>('/events', {
      params: { page: 1, pageSize: 20, upcoming: 'true' },
    })).data.events,
    refetchInterval: 30_000,
  });
  const artistsQuery = useQuery({
    queryKey: ['home', 'artists'],
    queryFn: loadArtists,
    refetchInterval: 30_000,
  });
  const homepageQuery = useQuery({
    queryKey: ['home', 'settings'],
    queryFn: async () => (await api.get<{ homepage: HomepageContent | null }>('/site-settings/homepage')).data.homepage,
    refetchInterval: 30_000,
  });
  const homepageMediaQuery = useQuery({
    queryKey: ['home', 'media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
    refetchInterval: 30_000,
  });
  const homepageHeroQuery = useQuery({
    queryKey: ['home', 'hero'],
    queryFn: async () => (await api.get<HomepageHero>('/homepage')).data,
    refetchInterval: 30_000,
  });
  const siteContentQuery = useQuery({
    queryKey: ['home', 'content'],
    queryFn: async () => (await api.get<SiteContent>('/content')).data,
    refetchInterval: 30_000,
  });
  const blogQuery = useQuery({
    queryKey: ['home', 'published-blogs'],
    queryFn: async () => (await api.get<{ posts: BlogSummary[] }>('/content/blog')).data.posts,
    refetchInterval: 30_000,
  });
  const siteSettingsQuery = useQuery({
    queryKey: ['home', 'site-settings'],
    queryFn: async () => (await api.get<PublicSiteSettings>('/site-settings')).data,
    refetchInterval: 30_000,
  });

  const events = eventsQuery.data ?? [];
  const blogPosts = blogQuery.data ?? [];
  const artists = artistsQuery.data ?? [];
  const media = homepageMediaQuery.data ?? {};
  const homepage = homepageQuery.data;
  const heroFeatures = homepage?.heroFeatures ?? [];
  const siteText = siteContentQuery.data?.text ?? {};
  const heroText = {
    heroKicker: siteText.heroKicker?.trim() || 'ART · CULTURE · CREATIVITY',
    heroLine1: siteText.heroLine1?.trim() || 'A Platform for Artists,',
    heroAccent: siteText.heroAccent?.trim() || 'Collectors & Art Lovers',
    heroIntro: siteText.heroIntro?.trim() || 'Exhibitions, collaborations and a vibrant community that celebrates art in all its forms.',
  };
  const heroTitle = [heroText.heroLine1, heroText.heroAccent].filter(Boolean).join(' ');
  const heroSlides = useMemo(
    () => (homepageHeroQuery.data?.slides ?? [])
      .filter((slide) => slide.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    [homepageHeroQuery.data?.slides],
  );
  const currentSlide = heroSlides.length ? heroSlides[activeSlide % heroSlides.length] : undefined;
  const fallbackEventImage = events[0]?.media.find((item) => item.mediaType === 'IMAGE')?.url;
  const heroImage = resolveMediaUrl(currentSlide?.imageUrl ?? fallbackEventImage);
  const refreshing = [
    eventsQuery,
    artistsQuery,
    homepageQuery,
    homepageMediaQuery,
    homepageHeroQuery,
    siteContentQuery,
    blogQuery,
    siteSettingsQuery,
  ].some((query) => query.isRefetching);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImage]);

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
      eventsQuery.refetch(),
      artistsQuery.refetch(),
      homepageQuery.refetch(),
      homepageMediaQuery.refetch(),
      homepageHeroQuery.refetch(),
      siteContentQuery.refetch(),
      blogQuery.refetch(),
      siteSettingsQuery.refetch(),
    ]);
  }

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 0, paddingBottom: 32, paddingTop: 8 }]}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        {homepage?.visibility?.hero !== false ? (
          <View style={{ backgroundColor: theme.nav, borderRadius: 22, height: heroImageHeight, overflow: 'hidden', position: 'relative' }}>
            {heroImage && !heroImageFailed ? (
              <Image
                source={{ uri: heroImage }}
                contentFit="cover"
                transition={350}
                onError={() => setHeroImageFailed(true)}
                accessibilityLabel={currentSlide?.altText || 'The Haat of Art exhibition'}
                style={{ height: '100%', position: 'absolute', width: '100%' }}
              />
            ) : null}
            <View style={{ ...StyleSheetAbsoluteFill, backgroundColor: 'rgba(24, 14, 9, 0.43)' }} />
            <View style={{ backgroundColor: 'rgba(24,14,9,0.2)', borderRadius: 14, gap: 7, left: 14, maxWidth: '82%', padding: 6, position: 'absolute', top: 16, width: '82%' }}>
              <Text numberOfLines={1} style={{ color: theme.champagne, fontFamily: typography.sansSemibold, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 }}>
                {heroText.heroKicker}
              </Text>
              <Text adjustsFontSizeToFit numberOfLines={3} style={{ color: '#FFFFFF', fontFamily: typography.displayItalic, fontSize: heroTitleSize, fontStyle: 'italic', fontWeight: '700', lineHeight: heroTitleSize + 2, maxWidth: '80%', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { height: 1, width: 1 }, textShadowRadius: 4 }}>
                {heroTitle}
              </Text>
              <Text numberOfLines={3} style={{ color: theme.cream, fontSize: 10, lineHeight: 15 }}>
                {heroText.heroIntro}
              </Text>
              <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/(tabs)/exhibitions')}
                  style={({ pressed }) => ({ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 20, flexDirection: 'row', flexShrink: 0, gap: 4, minHeight: 32, paddingHorizontal: 8, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>Explore Exhibitions</Text>
                  <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#FFFFFF" size={13} />
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/stall-application')}
                  style={({ pressed }) => ({ alignItems: 'center', borderColor: theme.champagne, borderRadius: 20, borderWidth: 1, flexShrink: 0, justifyContent: 'center', minHeight: 32, paddingHorizontal: 8, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '600' }}>Join as Artist</Text>
                </Pressable>
              </View>
            </View>
            {heroSlides.length > 1 ? (
              <View style={{ alignItems: 'center', bottom: 9, flexDirection: 'row', gap: 6, justifyContent: 'center', left: 0, position: 'absolute', right: 0 }}>
                {heroSlides.map((slide, index) => (
                  <Pressable
                    key={slide.id}
                    accessibilityLabel={`Show hero slide ${index + 1}`}
                    accessibilityRole="button"
                    onPress={() => setActiveSlide(index)}
                    style={{ backgroundColor: index === activeSlide ? theme.champagne : 'rgba(246,233,215,0.65)', borderRadius: 5, height: 7, width: index === activeSlide ? 18 : 7 }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 3, paddingTop: 14 }}
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}>
          {([
            { title: 'Book a Stall', subtitle: 'Exhibit your art', icon: 'landmark', onPress: () => router.push('/book-stall') },
            { title: 'Artist Registration', subtitle: 'Be part of our shows', icon: 'palette', onPress: () => router.push('/stall-application') },
            { title: 'Visitor Pass', subtitle: 'Get your free / VIP pass', icon: 'ticket', onPress: () => router.push('/pass-register') },
            { title: 'Become a Partner', subtitle: 'Collaborate with us', icon: 'handshake', onPress: () => router.push('/contact') },
          ] as const).map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="link"
              onPress={action.onPress}
              style={({ pressed }) => ({ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, gap: 4, justifyContent: 'center', minHeight: 76, opacity: pressed ? 0.82 : 1, paddingHorizontal: 4, paddingVertical: 7, width: quickActionWidth })}>
              <SymbolView name={homepageIcons[action.icon]} tintColor={theme.champagne} size={19} />
              <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: theme.cream, fontSize: 10, fontWeight: '600', lineHeight: 14, textAlign: 'center' }}>
                {action.title}
              </Text>
              <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: theme.muted, fontSize: 8, lineHeight: 11, textAlign: 'center' }}>
                {action.subtitle}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {homepage?.visibility?.upcomingExhibitions !== false ? (
          <View style={homeSectionSpacing}>
            <HomeSectionHeading title="Upcoming Exhibitions" onPress={() => router.push('/(tabs)/exhibitions')} />
            {eventsQuery.isPending ? (
              <MessageState title="Loading exhibitions" description="Getting current exhibitions." loading />
            ) : eventsQuery.isError ? (
              <MessageState title="Exhibitions could not load" description={getApiErrorMessage(eventsQuery.error)} />
            ) : events.length ? (
              <ScrollView horizontal contentContainerStyle={{ display: 'flex', flexDirection: 'row', gap: 12, paddingBottom: 4 }} nestedScrollEnabled showsHorizontalScrollIndicator>
                {events.map((event) => (
                  <HomeExhibitionCard
                    key={event.id}
                    event={event}
                    width={exhibitionCardWidth}
                  />
                ))}
              </ScrollView>
            ) : (
              <MessageState title="No upcoming exhibitions" description="New exhibition dates will appear here when published." />
            )}
          </View>
        ) : null}

        {homepage?.visibility?.gallery !== false && homepage?.categories?.length ? (
          <View style={homeSectionSpacing}>
            <HomeSectionHeading title="Explore by Category" onPress={() => router.push('/(tabs)/gallery')} />
            <ScrollView
              horizontal
              contentContainerStyle={{ flexDirection: 'row', gap: 9, paddingBottom: 4 }}
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}>
              {homepage.categories.map((category, index) => {
                const image = media[categoryMediaKey(category.title)]?.url
                  ?? media[`gallery${index + 1}`]?.url;
                const imageUrl = resolveMediaUrl(image);
                return (
                  <Pressable
                    key={`${category.title}-${index}`}
                    accessibilityRole="link"
                    onPress={() => router.push(category.href as Href)}
                    style={({ pressed }) => ({ alignItems: 'center', gap: 5, opacity: pressed ? 0.78 : 1, width: categoryCardWidth })}>
                    <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 12, borderWidth: 1, height: categoryCardWidth, justifyContent: 'center', overflow: 'hidden', width: categoryCardWidth }}>
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} contentFit="cover" transition={200} accessibilityLabel={category.title} style={{ height: '100%', width: '100%' }} />
                      ) : (
                        <SymbolView name={homepageIcons[category.icon]} tintColor={theme.champagne} size={30} />
                      )}
                    </View>
                    <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: theme.cream, fontSize: 9, fontWeight: '600', lineHeight: 12, textAlign: 'center' }}>
                      {category.title}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/(tabs)/gallery')}
                style={({ pressed }) => ({ alignItems: 'center', gap: 5, opacity: pressed ? 0.78 : 1, width: categoryCardWidth })}>
                <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, borderWidth: 1, height: categoryCardWidth, justifyContent: 'center', width: categoryCardWidth }}>
                  <SymbolView name={{ ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }} tintColor={theme.champagne} size={25} />
                </View>
                <Text style={{ color: theme.cream, fontSize: 9, fontWeight: '600', lineHeight: 12, textAlign: 'center' }}>More</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}

        {homepage?.visibility?.featuredArtists !== false ? (
          <View style={homeSectionSpacing}>
            <HomeSectionHeading title="Featured Artists" onPress={() => router.push('/(tabs)/artists')} />
            {artistsQuery.isPending ? (
              <MessageState title="Loading artists" description="Getting current artist profiles." loading />
            ) : artistsQuery.isError ? (
              <MessageState title="Artists could not load" description={getApiErrorMessage(artistsQuery.error)} />
            ) : artists.length ? (
              <AutoScrollRow gap={12} speed={0.25}>
                {artists.map((artist) => <ArtistCard key={artist.userId} artist={artist} />)}
              </AutoScrollRow>
            ) : (
              <MessageState title="No artist profiles yet" description="Published artist profiles will appear here." />
            )}
          </View>
        ) : null}

        <View style={homeSectionSpacing}>
          <HomeSectionHeading title="Stories & Insights" onPress={() => router.push('/blog')} />
          {blogQuery.isPending ? (
            <MessageState title="Loading stories" description="Getting published articles from the website." loading />
          ) : blogQuery.isError ? (
            <MessageState title="Stories could not load" description={getApiErrorMessage(blogQuery.error)} />
          ) : blogPosts.length ? (
            <ScrollView
              horizontal
              contentContainerStyle={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}>
              {blogPosts.slice(0, 6).map((post) => {
                const cover = resolveMediaUrl(post.coverUrl);
                return (
                  <Pressable
                    key={post.id}
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/blog/[id]', params: { id: post.id } })}
                    style={({ pressed }) => ({ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 10, height: 88, opacity: pressed ? 0.84 : 1, overflow: 'hidden', padding: 7, width: exhibitionCardWidth })}>
                    {cover ? (
                      <Image source={{ uri: cover }} contentFit="cover" transition={200} accessibilityLabel={post.title} style={{ backgroundColor: theme.surfaceRaised, borderRadius: 9, height: 72, width: 82 }} />
                    ) : (
                      <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 9, height: 72, justifyContent: 'center', width: 82 }}>
                        <SymbolView name={homepageIcons.image} tintColor={theme.champagne} size={24} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                      <Text style={{ alignSelf: 'flex-start', borderColor: theme.champagne, borderRadius: 9, borderWidth: 1, color: theme.champagne, fontSize: 8, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1 }}>Blog</Text>
                      <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: typography.display, fontSize: 13, fontWeight: '600', lineHeight: 16 }}>{post.title}</Text>
                      <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 9, lineHeight: 12 }}>{formatBlogDate(post.publishedAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderRadius: 16, height: 28, justifyContent: 'center', width: 28 }}>
                      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={theme.champagne} size={14} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <MessageState title="No published stories yet" description="Approved website articles will appear here." />
          )}
        </View>

        {heroFeatures.length ? (
          <View style={[homeSectionSpacing, { gap: 12 }]}>
            <HomeSectionHeading title="Why The Haat of Art?" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {heroFeatures.map((feature, index) => (
                <View key={`${feature.title}-${index}`} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, gap: 8, justifyContent: 'center', minHeight: 92, paddingHorizontal: 7, paddingVertical: 10, width: heroFeatures.length <= 4 ? '47%' : '30%' }}>
                  <SymbolView name={homepageIcons[feature.icon]} tintColor={theme.champagne} size={19} />
                  <Text numberOfLines={3} adjustsFontSizeToFit style={{ color: theme.cream, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                    {[feature.title, feature.subtitle].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {[
          eventsQuery,
          artistsQuery,
          homepageQuery,
          homepageMediaQuery,
          homepageHeroQuery,
          siteContentQuery,
          blogQuery,
          siteSettingsQuery,
        ].some((query) => query.isError) ? (
          <Text style={styles.errorText}>Some homepage content could not refresh. Pull down to retry.</Text>
        ) : null}

        <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 24, padding: 14 }}>
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
              <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} tintColor={theme.champagne} size={17} />
              <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 17, fontWeight: '600' }}>
                {siteSettingsQuery.data?.settings?.footer?.newsletterTitle || 'Stay in the art loop'}
              </Text>
            </View>
            <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>
              {siteSettingsQuery.data?.settings?.footer?.newsletterText || 'Get exhibition news and community stories in your inbox.'}
            </Text>
          </View>
          <View style={{ borderLeftColor: theme.border, borderLeftWidth: 1, gap: 7, paddingLeft: 12, width: '48%' }}>
            <TextInput
              accessibilityLabel="Email address for updates"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                setNewsletterMessage('');
              }}
              onSubmitEditing={() => newsletter.mutate()}
              placeholder="Your email address"
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
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{newsletter.isPending ? 'Sending…' : 'Join Newsletter'}</Text>
            </Pressable>
            <Text style={{ color: theme.muted, fontSize: 8, lineHeight: 11, textAlign: 'center' }}>We respect your privacy. Unsubscribe anytime.</Text>
            {newsletterMessage ? (
              <Text accessibilityLiveRegion="polite" style={{ color: newsletter.isError ? theme.terracottaLight : theme.success, fontSize: 10 }}>{newsletterMessage}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeSectionHeading({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
      <View style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 }}>
        <View style={{ backgroundColor: theme.terracotta, borderRadius: 2, height: 23, width: 4 }} />
        <Text numberOfLines={1} style={{ color: theme.cream, flex: 1, fontFamily: typography.display, fontSize: 18, fontWeight: '600', lineHeight: 23 }}>{title}</Text>
      </View>
      {onPress ? (
        <Pressable accessibilityRole="link" onPress={onPress} style={{ alignItems: 'center', flexDirection: 'row', gap: 3, paddingVertical: 4 }}>
          <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '600' }}>View all</Text>
          <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={theme.champagne} size={12} />
        </Pressable>
      ) : null}
    </View>
  );
}

function categoryMediaKey(title: string) {
  const normalized = title.toLocaleLowerCase();
  if (/artifact|craft|sculpt|textile|handmade/.test(normalized)) return 'categoryArtifacts';
  if (/experience|workshop|artist|community|studio|institute/.test(normalized)) return 'categoryExperiences';
  if (/exhibition|gallery/.test(normalized)) return 'categoryExhibitions';
  return 'categoryVisualArt';
}

function HomeExhibitionCard({ event, width }: { event: Exhibition; width: number }) {
  const router = useRouter();
  const image = event.media.find((item) => item.mediaType === 'IMAGE');

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/exhibition', params: { id: event.id } })}
      style={({ pressed }) => ({ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', height: 122, opacity: pressed ? 0.85 : 1, overflow: 'hidden', width })}>
      <View style={{ height: 122, width: Math.max(100, width * 0.34) }}>
        <EventImage path={image?.url} alt={image?.altText || event.title} style={{ borderRadius: 0, height: '100%', width: '100%' }} />
      </View>
      <View style={{ flex: 1, gap: 6, justifyContent: 'center', minWidth: 0, padding: 10 }}>
        <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: typography.display, fontSize: 14, fontWeight: '600', lineHeight: 17 }}>
          {event.title}
        </Text>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 5 }}>
          <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={theme.champagne} size={13} />
          <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, fontSize: 9 }}>{formatDateRange(event.startsAt, event.endsAt)}</Text>
        </View>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 5 }}>
          <SymbolView name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} tintColor={theme.champagne} size={13} />
          <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, fontSize: 9 }}>{event.venue || event.city}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', alignSelf: 'center', backgroundColor: theme.terracotta, borderRadius: 22, height: 38, justifyContent: 'center', marginRight: 12, width: 38 }}>
        <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#FFFFFF" size={18} />
      </View>
    </Pressable>
  );
}

const StyleSheetAbsoluteFill = {
  bottom: 0,
  left: 0,
  position: 'absolute' as const,
  right: 0,
  top: 0,
};
