import { Image } from 'expo-image';
import { Link, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text as NativeText,
  type TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { theme, typography } from '@/constants/theme';
import { api, resolveMediaUrl, type HomepageMedia, type PublicArtist } from '@/lib/api';
import { useSessionStore } from '@/store/session';

export function HaatHeader() {
  const [logoFailed, setLogoFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useLocalSearchParams<{ section?: string }>();
  const user = useSessionStore((state) => state.user);
  const galleryBackTarget = routeParams.section === 'artists-directory'
    ? 'artists'
    : routeParams.section === 'artists'
      ? 'home'
      : null;
  const isTabRoute = pathname === '/'
    || pathname === '/(tabs)'
    || pathname.startsWith('/(tabs)/')
    || ['/exhibitions', '/events', '/gallery', '/artists'].includes(pathname);
  const showBackButton = !isTabRoute && pathname !== '/blog';
  const media = useQuery({
    queryKey: ['home', 'media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
  const apiLogo = resolveMediaUrl(media.data?.logo?.url);

  useEffect(() => {
    setLogoFailed(false);
  }, [apiLogo]);

  useEffect(() => {
    if (media.error) console.warn('[mobile] Header logo could not load', media.error);
  }, [media.error]);

  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.background, flexDirection: 'row', gap: 8, height: 64 + insets.top, paddingHorizontal: 12, paddingTop: insets.top, position: 'relative', width: '100%' }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4, zIndex: 1 }}>
        <Pressable
          accessibilityLabel="Explore menu"
          accessibilityRole="button"
          onPress={() => {
            if (pathname !== '/more') router.push('/more');
          }}
          style={{ alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42, zIndex: 1 }}>
          <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} tintColor={theme.cream} size={22} />
        </Pressable>
        {galleryBackTarget ? (
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.setParams({ section: galleryBackTarget })}
            style={{ alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 36 }}>
            <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} tintColor={theme.cream} size={22} />
          </Pressable>
        ) : showBackButton ? (
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 36 }}>
            <NativeText style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 33, lineHeight: 36 }}>‹</NativeText>
          </Pressable>
        ) : null}
      </View>
      <Link href="/" asChild>
        <Pressable accessibilityLabel="The Haat of Art home" accessibilityRole="link" style={{ alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', left: '22%', minWidth: 0, position: 'absolute', right: '22%', zIndex: 0 }}>
          {apiLogo && !logoFailed ? (
            <Image
              source={{ uri: apiLogo }}
              contentFit="contain"
              transition={200}
              onError={() => {
                setLogoFailed(true);
                console.warn('[mobile] Header logo image could not load');
              }}
              accessibilityLabel={media.data?.logo?.altText || 'The Haat of Art'}
              style={{ height: 42, width: 42 }}
            />
          ) : null}
          <View style={{ flexShrink: 1, gap: 1 }}>
            <NativeText numberOfLines={1} style={{ color: theme.cream, fontFamily: typography.sansSemibold, fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>THE HAAT OF ART</NativeText>
            <NativeText numberOfLines={1} style={{ color: theme.muted, fontFamily: typography.sans, fontSize: 8, letterSpacing: 1 }}>ART · EXHIBITIONS · COMMUNITY</NativeText>
          </View>
        </Pressable>
      </Link>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 2, marginLeft: 'auto', zIndex: 1 }}>
        <Link href="/notifications" asChild>
          <Pressable accessibilityLabel="Event reminders" accessibilityRole="button" style={{ alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 }}>
            <SymbolView name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} tintColor={theme.cream} size={21} />
          </Pressable>
        </Link>
        <Link href="/(tabs)/account" asChild>
          <Pressable accessibilityLabel="Profile" accessibilityRole="button" style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 14, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 }}>
            {user?.avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(user.avatarUrl) ?? undefined }} contentFit="cover" accessibilityLabel={`${user.fullName} profile`} style={{ borderRadius: 13, height: 26, width: 26 }} />
            ) : user ? (
              <NativeText style={{ color: theme.terracotta, fontFamily: typography.sansSemibold, fontSize: 14, fontWeight: '700' }}>{user.fullName.trim().charAt(0).toUpperCase() || 'U'}</NativeText>
            ) : (
              <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} tintColor={theme.cream} size={20} />
            )}
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

export function HaatText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: typography.sans }, style]} />;
}

export function AutoScrollRow({ children, gap = 12, speed = 0.4 }: { children: ReactNode; gap?: number; speed?: number }) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const offset = useRef(0);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const repeatCount = rowWidth > 0 && viewportWidth > 0
    ? Math.max(1, Math.ceil((viewportWidth + 100) / rowWidth))
    : 1;

  function pauseAutoScroll() {
    paused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  }

  function resumeAutoScroll() {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      paused.current = false;
      resumeTimer.current = null;
    }, 500);
  }

  useEffect(() => {
    const loopWidth = contentWidth / 2;
    if (loopWidth <= viewportWidth || loopWidth <= 0) return;
    const timer = setInterval(() => {
      if (paused.current) return;
      offset.current += speed * 2;
      if (offset.current >= loopWidth) offset.current %= loopWidth;
      scrollRef.current?.scrollTo({ x: offset.current, animated: false });
    }, 32);
    return () => clearInterval(timer);
  }, [contentWidth, speed, viewportWidth]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      nestedScrollEnabled
      onContentSizeChange={(width) => setContentWidth(width)}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.x; }}
      onScrollBeginDrag={pauseAutoScroll}
      onScrollEndDrag={resumeAutoScroll}
      onMomentumScrollBegin={pauseAutoScroll}
      onMomentumScrollEnd={resumeAutoScroll}
      onTouchStart={pauseAutoScroll}
      onTouchEnd={resumeAutoScroll}
      onTouchCancel={resumeAutoScroll}
      scrollEventThrottle={32}
      showsHorizontalScrollIndicator>
      {[false, true].map((hidden) => (
        <View
          key={hidden ? 'duplicate-track' : 'artist-track'}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
          style={{ display: 'flex', flexDirection: 'row', gap }}>
          {Array.from({ length: repeatCount }, (_, index) => (
            <View
              key={index}
              onLayout={!hidden && index === 0 ? (event) => setRowWidth(event.nativeEvent.layout.width) : undefined}
              style={{ display: 'flex', flexDirection: 'row', gap }}>
              {children}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        {eyebrow ? <HaatText style={styles.eyebrow}>{eyebrow.toUpperCase()}</HaatText> : null}
        <HaatText style={styles.pageTitle}>{title}</HaatText>
        {description ? <HaatText style={styles.pageDescription}>{description}</HaatText> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionTitle({
  title,
  detail,
  href,
  onPress,
}: {
  title: string;
  detail?: string;
  href?: '/(tabs)/exhibitions' | '/(tabs)/artists' | '/(tabs)/gallery' | '/(tabs)/impact';
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View>
        <HaatText style={styles.sectionHeading}>{title}</HaatText>
        {detail ? <HaatText style={styles.sectionDetail}>{detail}</HaatText> : null}
      </View>
      {onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress}>
          <HaatText style={styles.textLink}>See All  →</HaatText>
        </Pressable>
      ) : href ? (
        <Link href={href} asChild>
          <Pressable accessibilityRole="link">
            <HaatText style={styles.textLink}>See All  →</HaatText>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

export function HaatButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      <HaatText style={[styles.buttonLabel, variant === 'secondary' ? styles.secondaryLabel : null]}>
        {label}
      </HaatText>
    </Pressable>
  );
}

export function EventImage({ path, alt, style }: { path?: string | null; alt: string; style?: StyleProp<ViewStyle> }) {
  const uri = resolveMediaUrl(path);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View style={[styles.imageFrame, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={180}
          accessibilityLabel={alt}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.imageFallback}>
          <HaatText style={styles.fallbackMark}>HAAT</HaatText>
          <HaatText style={styles.fallbackCaption}>OF ART</HaatText>
        </View>
      )}
    </View>
  );
}

export function MessageState({
  title,
  description,
  loading = false,
  action,
}: {
  title: string;
  description: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <View style={styles.messageState}>
      {loading ? <View accessibilityRole="progressbar" style={styles.loadingDot} /> : null}
      <HaatText style={styles.messageTitle}>{title}</HaatText>
      <HaatText style={styles.messageDescription}>{description}</HaatText>
      {action}
    </View>
  );
}

export function ExhibitionCard({
  id,
  title,
  city,
  venue,
  startsAt,
  endsAt,
  image,
  featured = false,
}: {
  id: string;
  title: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  image?: string | null;
  featured?: boolean;
}) {
  const dateLabel = formatDateRange(startsAt, endsAt);
  return (
    <View style={[styles.eventCard, featured ? styles.featuredCard : null]}>
      <EventImage path={image} alt={title} style={styles.eventImage} />
      <View style={styles.eventBody}>
        <HaatText style={styles.eventEyebrow}>{city || venue || 'THE HAAT OF ART'}</HaatText>
        <HaatText numberOfLines={2} style={styles.eventTitle}>{title}</HaatText>
        <HaatText numberOfLines={1} style={styles.eventDetail}>{dateLabel}</HaatText>
        <HaatText numberOfLines={1} style={styles.eventDetail}>{venue}</HaatText>
        <Link href={{ pathname: '/exhibition', params: { id } }} asChild>
          <Pressable accessibilityRole="link" style={styles.cardLink}>
            <HaatText style={styles.cardLinkText}>Explore exhibition</HaatText>
            <HaatText style={styles.cardArrow}>↗</HaatText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

export function ArtistCard({
  artist,
  compact = false,
}: {
  artist: PublicArtist;
  compact?: boolean;
}) {
  return (
    <Link href={{ pathname: '/artist', params: { userId: artist.userId } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={StyleSheet.flatten([styles.artistCard, compact ? styles.featuredArtistCard : null])}>
        {compact ? (
          <View style={styles.featuredArtistRow}>
            <View style={styles.featuredArtistArtwork}>
              <EventImage
                path={artist.imageUrl}
                alt={`Artwork by ${artist.displayName}`}
                style={styles.featuredArtistImage}
              />
            </View>
            <View style={styles.featuredArtistCopy}>
              <HaatText numberOfLines={1} style={styles.featuredArtistName}>{artist.displayName}</HaatText>
              <HaatText numberOfLines={1} style={styles.featuredArtistDetail}>
                {[artist.artStyle, artist.city].filter(Boolean).join(' · ') || artist.headline || 'The Haat of Art artist'}
              </HaatText>
              <View style={styles.featuredArtistPortfolio}>
                <HaatText style={styles.featuredArtistPortfolioText}>View Portfolio</HaatText>
                <HaatText style={styles.featuredArtistPortfolioArrow}>→</HaatText>
              </View>
            </View>
          </View>
        ) : (
          <>
            <EventImage
              path={artist.imageUrl}
              alt={`Artwork by ${artist.displayName}`}
              style={styles.artistImage}
            />
            <HaatText numberOfLines={1} style={styles.artistName}>{artist.displayName}</HaatText>
            <HaatText numberOfLines={1} style={styles.artistDetail}>{artist.artStyle || artist.city || 'Artist'}</HaatText>
          </>
        )}
      </Pressable>
    </Link>
  );
}

export function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Dates to be announced';
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-IN', options)} – ${endDate.toLocaleDateString('en-IN', { ...options, year: 'numeric' })}`;
}

const createStyles = () => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 620,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 24,
    width: '100%',
  },
  eyebrow: {
    color: theme.terracotta,
    fontFamily: typography.sansSemibold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heading: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  headingCopy: {
    flex: 1,
    gap: 7,
  },
  pageTitle: {
    color: theme.cream,
    fontFamily: typography.display,
    fontSize: 24,
    lineHeight: 29,
  },
  pageDescription: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  sectionHeading: {
    color: theme.cream,
    fontFamily: typography.display,
    fontSize: 21,
    lineHeight: 26,
  },
  sectionDetail: {
    color: theme.muted,
    fontFamily: typography.sans,
    fontSize: 13,
    marginTop: 5,
  },
  textLink: {
    color: theme.terracotta,
    fontFamily: typography.sansSemibold,
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    borderRadius: 24,
    display: 'flex',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: theme.terracotta,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: theme.border,
    borderWidth: 1,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontFamily: typography.sansSemibold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryLabel: {
    color: theme.cream,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
  imageFrame: {
    backgroundColor: theme.surfaceRaised,
    borderRadius: 14,
    overflow: 'hidden',
  },
  imageFallback: {
    alignItems: 'center',
    backgroundColor: theme.surfaceRaised,
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
  },
  fallbackMark: {
    color: theme.terracottaLight,
    fontFamily: typography.display,
    fontSize: 18,
    letterSpacing: 4,
  },
  fallbackCaption: {
    color: theme.muted,
    fontSize: 8,
    letterSpacing: 3,
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: 288,
  },
  featuredCard: {
    width: '100%',
  },
  eventImage: {
    aspectRatio: 1.6,
    borderRadius: 0,
    width: '100%',
  },
  eventBody: {
    display: 'flex',
    flexDirection: 'column',
    padding: 14,
    gap: 8,
  },
  eventEyebrow: {
    color: theme.terracottaLight,
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eventTitle: {
    color: theme.cream,
    fontFamily: typography.display,
    fontSize: 16,
    lineHeight: 21,
  },
  eventDetail: {
    color: theme.muted,
    fontFamily: typography.sans,
    fontSize: 12,
  },
  cardLink: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  cardLinkText: {
    color: theme.terracottaLight,
    fontSize: 12,
    fontWeight: '700',
  },
  cardArrow: {
    color: theme.terracottaLight,
    fontSize: 16,
  },
  artistCard: {
    width: '47%',
  },
  featuredArtistCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 116,
    padding: 14,
    width: 288,
  },
  featuredArtistRow: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  featuredArtistArtwork: {
    display: 'flex',
    position: 'relative',
  },
  featuredArtistImage: {
    borderRadius: 38,
    height: 72,
    width: 72,
  },
  featuredArtistCopy: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  featuredArtistName: {
    color: theme.cream,
    fontFamily: typography.display,
    fontSize: 16,
    fontWeight: '600',
  },
  featuredArtistDetail: {
    color: theme.muted,
    fontFamily: typography.sans,
    fontSize: 12,
  },
  featuredArtistPortfolio: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.terracotta,
    borderRadius: 18,
    display: 'flex',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredArtistPortfolioText: {
    color: '#FFFFFF',
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '600',
  },
  featuredArtistPortfolioArrow: {
    color: '#FFFFFF',
    fontFamily: typography.sans,
    fontSize: 14,
  },
  artistPortfolio: {
    alignSelf: 'flex-start',
    backgroundColor: theme.terracotta,
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  artistImage: {
    aspectRatio: 1.6,
    marginBottom: 10,
    width: '100%',
  },
  artistName: {
    color: theme.cream,
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  artistDetail: {
    color: theme.muted,
    fontFamily: typography.sans,
    fontSize: 12,
    marginTop: 0,
  },
  messageState: {
    alignItems: 'flex-start',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
  },
  loadingDot: {
    backgroundColor: theme.terracottaLight,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  messageTitle: {
    color: theme.cream,
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  messageDescription: {
    color: theme.muted,
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: theme.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  surface: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  label: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  field: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    color: theme.cream,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 15,
  },
  fieldError: {
    color: theme.danger,
    fontSize: 12,
  },
});

type HaatStyles = ReturnType<typeof createStyles>;
let cachedStyles = createStyles();
let cachedThemeSignature = Object.values(theme).join('|');

export const styles = new Proxy({} as HaatStyles, {
  get(_target, property) {
    const signature = Object.values(theme).join('|');
    if (signature !== cachedThemeSignature) {
      cachedStyles = createStyles();
      cachedThemeSignature = signature;
    }
    return cachedStyles[property as keyof HaatStyles];
  },
});
