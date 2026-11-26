import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { EventImage, HaatText as Text, MessageState, PageHeading, SectionTitle, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type InvitedGuest, type MediaPartner } from '@/lib/api';
import { stripHtmlText } from '@/lib/content-text';
import { useRefreshOnFocus } from '@/lib/query-refresh';

type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  designation?: string;
  bio: string;
  photoUrl: string | null;
  isActive: boolean;
  isFeaturedMentor?: boolean;
};

type AboutPartner = {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
};

type AboutState = {
  sections: {
    sectionKey: string;
    title: string;
    subtitle: string;
    bodyHtml: string | null;
    imageUrl: string | null;
    visible: number;
  }[];
  settings: null | {
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    heroImageUrl: string | null;
    heroVisible: boolean;
    storyKicker: string;
    storyHeading: string;
    storyBodyHtml: string | null;
    storyImageUrl: string | null;
    storyVisible: boolean;
    journeyKicker: string;
    journeyHeading: string;
    journeyVisible: boolean;
    ecosystemKicker: string;
    ecosystemHeading: string;
    ecosystemSubtitle: string;
  };
  metrics: { id: number; value: string; label: string; sublabel: string; isVisible: boolean }[];
  milestones: { id: number; yearRange: string; title: string; description: string; isVisible: boolean }[];
  visionMission: { sectionKey: string; title: string; bodyHtml: string | null; isVisible: boolean }[];
  ecosystemCards: { id: number; cardKey: string; title: string; lead: string; bodyHtml: string | null; isVisible: boolean }[];
  team: AboutTeamMember[];
  partners: AboutPartner[];
};

const aboutSections = [
  { section: 'hero', title: 'About The Haat of Art', icon: { ios: 'house', android: 'home', web: 'home' } },
  { section: 'story', title: 'Our Story', icon: { ios: 'book.closed', android: 'menu_book', web: 'menu_book' } },
  { section: 'vision-mission', title: 'Vision & Mission', icon: { ios: 'scope', android: 'track_changes', web: 'track_changes' } },
  { section: 'journey', title: 'Our Journey & Milestones', icon: { ios: 'timeline.selection', android: 'timeline', web: 'timeline' } },
  { section: 'leadership', title: 'Leadership & Core Team', icon: { ios: 'person.3', android: 'groups', web: 'groups' } },
  { section: 'guests', title: 'Invited Guests & Luminaries', icon: { ios: 'star', android: 'star', web: 'star' } },
  { section: 'event-partners', title: 'Event Partners', icon: { ios: 'handshake', android: 'handshake', web: 'handshake' } },
  { section: 'media-press', title: 'Media & Press', icon: { ios: 'newspaper', android: 'newspaper', web: 'newspaper' } },
] as const;

export default function AboutScreen() {
  useRefreshOnFocus('about');
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const requestedSection = typeof params.section === 'string' ? params.section : '';
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const pendingSection = useRef('');
  const sectionOffsets = useRef<Record<string, number>>({});
  const about = useQuery({
    queryKey: ['about', 'published'],
    queryFn: async () => (await api.get<{ published: { state: AboutState; publishedAt: string | null } | null }>('/about')).data.published,
  });
  const guests = useQuery({
    queryKey: ['about', 'guests'],
    queryFn: async () => (await api.get<InvitedGuest[]>('/invited-guests', { params: { page: 'about' } })).data,
  });
  const mediaPartners = useQuery({
    queryKey: ['about', 'media-partners'],
    queryFn: async () => (await api.get<MediaPartner[]>('/media-partners', { params: { page: 'about' } })).data,
  });

  useEffect(() => {
    if (!requestedSection) {
      pendingSection.current = '';
      return;
    }
    const offset = sectionOffsets.current[requestedSection];
    if (typeof offset === 'number') {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
      pendingSection.current = '';
    } else {
      pendingSection.current = requestedSection;
    }
  }, [requestedSection, about.data, guests.data, mediaPartners.data]);

  const state = about.data?.state;
  const settings = state?.settings;
  const sections = state?.sections.filter((section) => section.visible !== 0) ?? [];
  const hero = sections.find((section) => section.sectionKey === 'hero');
  const story = sections.find((section) => section.sectionKey === 'foundation');
  const extraSections = sections.filter((section) => !['hero', 'foundation'].includes(section.sectionKey));
  const visibleMetrics = state?.metrics.filter((metric) => metric.isVisible) ?? [];
  const visibleMilestones = state?.milestones.filter((milestone) => milestone.isVisible) ?? [];
  const visibleVisionMission = state?.visionMission.filter((item) => item.isVisible) ?? [];
  const activeTeam = state?.team.filter((member) => member.isActive) ?? [];
  const eventPartners = state?.partners.filter((partner) => partner.isActive) ?? [];
  const activeGuests = guests.data?.filter((guest) => guest.isActive && guest.showOnAbout) ?? [];
  const activeMediaPartners = mediaPartners.data?.filter((partner) => partner.isActive && partner.showOnAbout) ?? [];
  const refreshing = about.isRefetching || guests.isRefetching || mediaPartners.isRefetching;
  const refresh = () => {
    void Promise.all([about.refetch(), guests.refetch(), mediaPartners.refetch()]);
  };
  const registerSection = (section: string) => (event: { nativeEvent: { layout: { y: number } } }) => {
    const offset = event.nativeEvent.layout.y;
    sectionOffsets.current[section] = offset;
    if (pendingSection.current === section) {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
      pendingSection.current = '';
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { gap: 22 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {about.isPending ? (
          <MessageState title="Loading About Us" description="Getting the latest published story, team and milestones." loading />
        ) : about.isError ? (
          <MessageState
            title="About information could not load"
            description={getApiErrorMessage(about.error)}
            action={<Pressable accessibilityRole="button" onPress={() => void about.refetch()}><Text style={styles.textLink}>Try again</Text></Pressable>}
          />
        ) : !settings ? (
          <MessageState title="About information is unavailable" description="Published brand information will appear here when available." />
        ) : (
          <>
            <View onLayout={registerSection('hero')} style={{ gap: 10 }}>
              <PageHeading eyebrow={settings.heroKicker || 'The Haat of Art'} title="About Us" />
              {settings.heroVisible ? (
                <>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplayItalic', fontSize: 28, fontStyle: 'italic', lineHeight: 31 }}>
                    {settings.heroTitle}
                  </Text>
                  {settings.heroSubtitle ? (
                    <Text style={{ color: theme.cream, fontSize: 13, lineHeight: 19 }}>{settings.heroSubtitle}</Text>
                  ) : null}
                  {hero?.imageUrl || settings.heroImageUrl ? (
                    <EventImage
                      path={hero?.imageUrl || settings.heroImageUrl}
                      alt={hero?.title || settings.heroTitle}
                      style={{ aspectRatio: 1.55, borderRadius: 13, width: '100%' }}
                    />
                  ) : null}
                </>
              ) : null}
            </View>

            {visibleMetrics.length ? (
              <View style={{ backgroundColor: theme.cream, borderRadius: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 13 }}>
                {visibleMetrics.map((metric) => (
                  <View key={metric.id} style={{ alignItems: 'center', flexBasis: `${100 / Math.min(visibleMetrics.length, 3)}%`, gap: 3, paddingHorizontal: 4 }}>
                    <SymbolView name={{ ios: 'person.3', android: 'groups', web: 'groups' }} tintColor={theme.terracotta} size={21} />
                    <Text style={{ color: theme.background, fontFamily: 'HaatDisplay', fontSize: 21, fontWeight: '700' }}>{metric.value}</Text>
                    <Text style={{ color: theme.background, fontSize: 10, textAlign: 'center' }}>{metric.label}</Text>
                    {metric.sublabel ? <Text style={{ color: theme.muted, fontSize: 9, textAlign: 'center' }}>{metric.sublabel}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {settings.storyVisible && (story || settings.storyBodyHtml) ? (
              <View onLayout={registerSection('story')} style={{ gap: 9 }}>
                <SectionTitle title={story?.title || settings.storyHeading || 'Our Story'} />
                {story?.subtitle ? <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplayItalic', fontSize: 20, fontStyle: 'italic' }}>{story.subtitle}</Text> : null}
                <Text style={{ color: theme.cream, fontSize: 13, lineHeight: 20 }}>
                  {stripHtmlText(story?.bodyHtml || settings.storyBodyHtml)}
                </Text>
                {story?.imageUrl || settings.storyImageUrl ? (
                  <EventImage
                    path={story?.imageUrl || settings.storyImageUrl}
                    alt={story?.title || settings.storyHeading}
                    style={{ aspectRatio: 1.55, borderRadius: 13, width: '100%' }}
                  />
                ) : null}
              </View>
            ) : null}

            {settings.journeyVisible && visibleMilestones.length ? (
              <View onLayout={registerSection('journey')} style={{ gap: 10 }}>
                <SectionTitle title={settings.journeyHeading || 'Our Journey & Milestones'} detail={settings.journeyKicker} />
                {visibleMilestones.map((milestone, index) => (
                  <View key={milestone.id} style={{ flexDirection: 'row', gap: 11 }}>
                    <View style={{ alignItems: 'center', width: 18 }}>
                      <View style={{ backgroundColor: theme.champagne, borderRadius: 6, height: 11, marginTop: 4, width: 11 }} />
                      {index < visibleMilestones.length - 1 ? <View style={{ backgroundColor: theme.border, flex: 1, marginVertical: 3, width: 1 }} /> : null}
                    </View>
                    <View style={[styles.surface, { flex: 1, gap: 5, marginBottom: 2, padding: 12 }]}>
                      <Text style={styles.eyebrow}>{milestone.yearRange}</Text>
                      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 19 }}>{milestone.title}</Text>
                      <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>{milestone.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {state?.ecosystemCards.some((card) => card.isVisible) ? (
              <View style={{ gap: 10 }}>
                <SectionTitle
                  title={settings.ecosystemHeading || 'What We Do'}
                  detail={settings.ecosystemSubtitle || settings.ecosystemKicker}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  {state.ecosystemCards.filter((card) => card.isVisible).map((card) => (
                    <View key={card.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, gap: 7, minHeight: 100, justifyContent: 'center', padding: 9, width: '31%' }}>
                      <SymbolView name={ecosystemIcon(card.cardKey)} tintColor={theme.champagne} size={22} />
                      <Text style={{ color: theme.cream, fontSize: 10, lineHeight: 14, textAlign: 'center' }}>{card.title}</Text>
                      {card.lead ? <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 9, lineHeight: 12, textAlign: 'center' }}>{card.lead}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {extraSections.map((section) => (
              <View key={section.sectionKey} style={{ gap: 8 }}>
                {section.imageUrl ? <EventImage path={section.imageUrl} alt={section.title} style={{ aspectRatio: 1.6, width: '100%' }} /> : null}
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>{section.title}</Text>
                {section.subtitle ? <Text style={{ color: theme.champagne, fontSize: 13 }}>{section.subtitle}</Text> : null}
                {section.bodyHtml ? <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{stripHtmlText(section.bodyHtml)}</Text> : null}
              </View>
            ))}

            {visibleVisionMission.length ? (
              <View onLayout={registerSection('vision-mission')} style={{ gap: 10 }}>
                {visibleVisionMission.map((item) => (
                  <View key={item.sectionKey} style={[styles.surface, { gap: 7 }]}>
                    <Text style={styles.eyebrow}>{item.sectionKey}</Text>
                    <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>{item.title}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 19 }}>{stripHtmlText(item.bodyHtml)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {activeTeam.length ? (
              <View onLayout={registerSection('leadership')} style={{ gap: 10 }}>
                <SectionTitle title="Our Team" detail="Leadership & Core Team" />
                <ScrollView horizontal contentContainerStyle={{ gap: 9 }} showsHorizontalScrollIndicator={false}>
                  {activeTeam.map((member) => (
                    <View key={member.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, gap: 6, padding: 10, width: 132 }}>
                      <View style={{ borderColor: theme.champagne, borderRadius: 43, borderWidth: 1, overflow: 'hidden' }}>
                        {member.photoUrl ? (
                          <Image source={{ uri: resolveMediaUrl(member.photoUrl) ?? undefined }} contentFit="cover" accessibilityLabel={member.name} style={{ backgroundColor: theme.surfaceRaised, height: 72, width: 72 }} />
                        ) : (
                          <View style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, height: 72, justifyContent: 'center', width: 72 }}>
                            <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 24 }}>{member.name.charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                      <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 16, textAlign: 'center' }}>{member.name}</Text>
                      <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 10, lineHeight: 14, textAlign: 'center' }}>{member.role || member.designation}</Text>
                    </View>
                  ))}
                </ScrollView>
                {activeTeam.some((member) => member.bio) ? (
                  <View style={{ gap: 8 }}>
                    {activeTeam.filter((member) => member.bio).map((member) => (
                      <Text key={member.id} style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>
                        <Text style={{ color: theme.cream, fontWeight: '700' }}>{member.name}: </Text>
                        {stripHtmlText(member.bio)}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View onLayout={registerSection('guests')} style={{ gap: 10 }}>
              <SectionTitle title="Invited Guests & Luminaries" detail="Special guests from our editions" />
              {guests.isPending ? (
                <MessageState title="Loading invited guests" description="Getting guests published for the About page." loading />
              ) : guests.isError ? (
                <MessageState title="Invited guests could not load" description={getApiErrorMessage(guests.error)} action={<Pressable accessibilityRole="button" onPress={() => void guests.refetch()}><Text style={styles.textLink}>Try again</Text></Pressable>} />
              ) : activeGuests.length ? (
                <ScrollView horizontal contentContainerStyle={{ gap: 9 }} showsHorizontalScrollIndicator={false}>
                  {activeGuests.map((guest) => (
                    <View key={guest.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, gap: 5, padding: 10, width: 126 }}>
                      <Portrait path={guest.photoUrl} name={guest.name} />
                      <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 15, textAlign: 'center' }}>{guest.name}</Text>
                      <Text numberOfLines={1} style={{ color: theme.champagne, fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{guest.roleBadge}</Text>
                      {guest.designation ? <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 9, lineHeight: 13, textAlign: 'center' }}>{guest.designation}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <MessageState title="No invited guests published" description="Guests marked for the About page in the admin database appear here." />
              )}
            </View>

            <View onLayout={registerSection('event-partners')} style={{ gap: 10 }}>
              <SectionTitle title="Event Partners" detail="Partners published with the About page" />
              {eventPartners.length ? (
                <ScrollView horizontal contentContainerStyle={{ gap: 9 }} showsHorizontalScrollIndicator={false}>
                  {eventPartners.map((partner) => (
                    <PartnerCard key={partner.id} name={partner.name} category={partner.category} logoUrl={partner.logoUrl} />
                  ))}
                </ScrollView>
              ) : (
                <MessageState title="No event partners published" description="Published partners from the About content appear here." />
              )}
            </View>

            <View onLayout={registerSection('media-press')} style={{ gap: 10 }}>
              <SectionTitle title="Media & Press" detail="Press and media partners from the database" />
              {mediaPartners.isPending ? (
                <MessageState title="Loading media partners" description="Getting the latest media and press partners." loading />
              ) : mediaPartners.isError ? (
                <MessageState title="Media partners could not load" description={getApiErrorMessage(mediaPartners.error)} action={<Pressable accessibilityRole="button" onPress={() => void mediaPartners.refetch()}><Text style={styles.textLink}>Try again</Text></Pressable>} />
              ) : activeMediaPartners.length ? (
                <ScrollView horizontal contentContainerStyle={{ gap: 9 }} showsHorizontalScrollIndicator={false}>
                  {activeMediaPartners.map((partner) => (
                    <PartnerCard key={partner.id} name={partner.name} category={partner.category} logoUrl={partner.logoUrl} />
                  ))}
                </ScrollView>
              ) : (
                <MessageState title="No media partners published" description="Partners marked for the About page in the admin database appear here." />
              )}
            </View>

            <View style={[styles.surface, { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 19 }}>Want to know more?</Text>
                <Text style={{ color: theme.muted, fontSize: 11 }}>Contact The Haat of Art team.</Text>
              </View>
              <Pressable accessibilityRole="link" onPress={() => router.push('/contact')} style={{ backgroundColor: theme.terracotta, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }}>
                <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '700' }}>Contact Us  →</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Portrait({ path, name }: { path: string | null; name: string }) {
  return (
    <View style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 35, borderWidth: 1, height: 62, justifyContent: 'center', overflow: 'hidden', width: 62 }}>
      {path ? (
        <Image source={{ uri: resolveMediaUrl(path) ?? undefined }} contentFit="cover" accessibilityLabel={name} style={StyleSheet.absoluteFill} />
      ) : (
        <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 23 }}>{name.charAt(0)}</Text>
      )}
    </View>
  );
}

function PartnerCard({ name, category, logoUrl }: { name: string; category: string; logoUrl: string | null }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, borderWidth: 1, gap: 6, height: 98, justifyContent: 'center', padding: 10, width: 142 }}>
      {logoUrl ? (
        <Image source={{ uri: resolveMediaUrl(logoUrl) ?? undefined }} contentFit="contain" accessibilityLabel={name} style={{ height: 42, width: 112 }} />
      ) : (
        <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{name}</Text>
      )}
      {category ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 9, textAlign: 'center' }}>{category}</Text> : null}
    </View>
  );
}

function ecosystemIcon(cardKey: string) {
  const key = cardKey.toLocaleLowerCase();
  if (key.includes('exhibition') || key.includes('curate')) return { ios: 'building.2', android: 'museum', web: 'museum' } as const;
  if (key.includes('artist') || key.includes('workshop')) return { ios: 'paintbrush.pointed', android: 'brush', web: 'brush' } as const;
  if (key.includes('community') || key.includes('industry')) return { ios: 'person.2', android: 'groups', web: 'groups' } as const;
  return { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as const;
}
