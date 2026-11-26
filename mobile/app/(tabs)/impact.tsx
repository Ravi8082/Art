import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AutoScrollRow, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, HomepageContent, HomepageMedia, MediaPartner, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

type HomepageHighlights = { highlights: HomepageContent['highlights'] };

export default function ImpactScreen() {
  useRefreshOnFocus('impact');
  const homepage = useQuery({
    queryKey: ['impact', 'homepage'],
    queryFn: async () => (await api.get<{ homepage: HomepageContent | null }>('/site-settings/homepage')).data.homepage,
  });
  const highlights = useQuery({
    queryKey: ['impact', 'highlights'],
    queryFn: async () => (await api.get<HomepageHighlights>('/highlights')).data.highlights,
  });
  const media = useQuery({
    queryKey: ['impact', 'media'],
    queryFn: async () => (await api.get<Record<string, HomepageMedia>>('/homepage/media')).data,
  });
  const partners = useQuery({
    queryKey: ['impact', 'partners'],
    queryFn: async () => (await api.get<MediaPartner[]>('/media-partners', { params: { page: 'home' } })).data,
  });
  const metrics = homepage.data?.visibility?.impact === false ? [] : homepage.data?.impact ?? [];
  const featuredPartners = homepage.data?.venuePartners?.length
    ? homepage.data.venuePartners.map((partner, index) => {
      const partnerMedia = partners.data?.find((item) => item.name.toLocaleLowerCase() === partner.name.toLocaleLowerCase());
      return {
        id: `${partner.name}-${index}`,
        name: partner.name,
        logo: media.data?.[`venuePartner${index + 1}`]?.url ?? partnerMedia?.logoUrl ?? null,
      };
    })
    : (partners.data ?? []).filter((partner) => partner.isActive && partner.showOnHome)
      .map((partner) => ({ id: partner.id, name: partner.name, logo: partner.logoUrl }));
  const highlightItems = (highlights.data ?? []).map((item, index) => ({ ...item, index }))
    .filter(({ title }) => {
      const normalizedTitle = title.trim().toLocaleLowerCase();
      return !normalizedTitle.includes('art spaces') && !normalizedTitle.includes('live painting');
    });
  const refreshing = homepage.isRefetching || highlights.isRefetching || media.isRefetching || partners.isRefetching;

  async function refresh() {
    await Promise.all([homepage.refetch(), highlights.refetch(), media.refetch(), partners.refetch()]);
  }

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        <PageHeading eyebrow="The Haat of Art" title="Our Impact" description="The impact and event highlights published by The Haat of Art." />

        {homepage.isPending ? (
          <MessageState title="Loading impact data" description="Getting the latest published metrics." loading />
        ) : homepage.isError ? (
          <MessageState title="Impact data could not load" description={getApiErrorMessage(homepage.error)} />
        ) : metrics.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {metrics.map((metric, index) => (
              <View key={`${metric.label}-${index}`} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: 8, minHeight: 104, justifyContent: 'center', padding: 14 }}>
                <Text style={{ color: theme.terracotta, fontFamily: 'HaatDisplay', fontSize: 24, fontWeight: '600' }}>{metric.value}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{metric.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <MessageState title="No impact metrics published" description="Metrics will appear here when they are added to the website." />
        )}

        {homepage.data?.visibility?.eventHighlights !== false && highlightItems.length ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionHeading}>Event Highlights</Text>
            <View style={{ gap: 10 }}>
              {highlightItems.map((item) => {
                const image = media.data?.[`highlight${item.index + 1}`]?.url;
                return (
                  <View key={`${item.title}-${item.index}`} style={[styles.surface, { flexDirection: 'row', gap: 12, padding: 11 }]}>
                    {image ? (
                      <Image source={{ uri: resolveMediaUrl(image) ?? undefined }} contentFit="cover" accessibilityLabel={item.title} style={{ backgroundColor: theme.surfaceRaised, borderRadius: 10, height: 82, width: 92 }} />
                    ) : null}
                    <View style={{ flex: 1, gap: 5, justifyContent: 'center' }}>
                      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                      {item.description ? <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>{item.description}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {homepage.data?.visibility?.venuePartners !== false && featuredPartners.length ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionHeading}>Our Venue Partners</Text>
            <AutoScrollRow gap={9} speed={0.4}>
              {featuredPartners.map((partner) => (
                <View key={partner.id} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, borderWidth: 1, height: 70, justifyContent: 'center', paddingHorizontal: 12, width: 124 }}>
                  {partner.logo ? (
                    <Image source={{ uri: resolveMediaUrl(partner.logo) ?? undefined }} contentFit="contain" accessibilityLabel={partner.name} style={{ height: 46, width: 98 }} />
                  ) : (
                    <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{partner.name}</Text>
                  )}
                </View>
              ))}
            </AutoScrollRow>
          </View>
        ) : null}

        {[highlights, media, partners].some((query) => query.isError) ? (
          <Text style={styles.errorText}>Some impact content could not refresh. Pull down to retry.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
