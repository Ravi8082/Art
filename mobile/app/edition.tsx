import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventImage, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { GalleryArtworkTile } from '@/components/gallery-cards';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, type ExhibitionArchiveEdition, type PublicArtistArtwork } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function EditionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  useRefreshOnFocus('gallery');
  const editions = useQuery({
    queryKey: ['gallery', 'archive'],
    queryFn: async () => (await api.get<ExhibitionArchiveEdition[]>('/exhibition-archive')).data,
  });
  const artworks = useQuery({
    queryKey: ['gallery', 'artworks'],
    queryFn: async () => (await api.get<PublicArtistArtwork[]>('/artist-profile/public/gallery')).data,
  });
  const edition = editions.data?.find((item) => item.id === id);
  const year = edition?.startDate?.slice(0, 4) ?? '';
  const yearArtworks = year ? (artworks.data ?? []).filter((work) => String(work.year ?? '') === year) : [];
  const yearArtists = [...new Map(yearArtworks.map((work) => [work.artistId, work])).values()];
  const refreshing = editions.isRefetching || artworks.isRefetching;
  const refresh = () => { void Promise.all([editions.refetch(), artworks.refetch()]); };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {editions.isPending ? (
          <MessageState title="Loading edition" description="Getting the published exhibition details." loading />
        ) : editions.isError ? (
          <MessageState title="Edition could not load" description={getApiErrorMessage(editions.error)} />
        ) : !edition ? (
          <MessageState title="Edition not found" description="This edition may no longer be published in the archive." />
        ) : (
          <>
            <PageHeading
              eyebrow={[edition.city, edition.monthLabel, edition.editionNumber].filter(Boolean).join(' · ')}
              title={edition.title}
              description={[edition.venue, edition.startDate, edition.endDate].filter(Boolean).join(' · ')}
            />

            <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 }}>
              <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>EDITION AT A GLANCE</Text>
              <InfoRow label="City" value={edition.city} />
              <InfoRow label="Venue" value={edition.venue} />
              <InfoRow label="Dates" value={edition.startDate && edition.endDate ? `${edition.startDate} – ${edition.endDate}` : edition.startDate || edition.monthLabel} />
              <InfoRow label="Archive media" value={`${edition.media.length} ${edition.media.length === 1 ? 'item' : 'items'}`} />
              {edition.artistCount > 0 ? <InfoRow label="Artists listed in archive" value={String(edition.artistCount)} /> : null}
            </View>

            <View style={{ gap: 12 }}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 23 }}>Edition gallery</Text>
              {edition.media.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                  {edition.media.map((media) => (
                    <View key={media.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, overflow: 'hidden', width: '48%' }}>
                      {media.mediaType === 'IMAGE' ? (
                        <EventImage path={media.url} alt={media.altText || media.caption || edition.title} style={{ aspectRatio: 0.92, width: '100%' }} />
                      ) : (
                        <View style={{ alignItems: 'center', aspectRatio: 0.92, backgroundColor: theme.surfaceRaised, justifyContent: 'center', width: '100%' }}>
                          <Text style={{ color: theme.terracotta, fontSize: 24 }}>▶</Text>
                          <Text style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>Video archive</Text>
                        </View>
                      )}
                      <View style={{ gap: 4, padding: 10 }}>
                        <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 15 }}>{media.caption || media.altText || 'Exhibition archive'}</Text>
                        {media.artistName ? <Text numberOfLines={1} style={{ color: theme.terracotta, fontSize: 11 }}>{media.artistName}</Text> : null}
                        {media.stallName ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10 }}>{media.stallName}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <MessageState title="No archive media attached" description="The edition will show its photos and videos here after they are published by an administrator." />
              )}
            </View>

            {artworks.isError ? (
              <MessageState title="Portfolio works could not load" description={getApiErrorMessage(artworks.error)} />
            ) : yearArtworks.length ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 5 }}>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 23 }}>Portfolio works from {year}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>These approved works are matched by artwork year. Artist portfolio records are not directly linked to archive editions.</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                  {yearArtworks.map((work) => (
                    <GalleryArtworkTile key={work.id} artwork={work} onPress={() => router.push({ pathname: '/artwork', params: { id: work.id } })} style={{ width: '48%' }} />
                  ))}
                </View>
              </View>
            ) : artworks.isPending ? (
              <MessageState title="Loading portfolio works" description="Checking for published works from this year." loading />
            ) : null}

            {yearArtists.length ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 23 }}>Artists</Text>
                <View style={{ gap: 10 }}>
                  {yearArtists.map((work) => (
                    <Pressable
                      key={work.artistId}
                      accessibilityRole="link"
                      onPress={() => router.push({ pathname: '/artist', params: { userId: work.artistId } })}
                      style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 11 }}>
                      <EventImage path={work.avatarUrl || work.url} alt={`Artwork by ${work.artistName}`} style={{ borderRadius: 12, height: 54, width: 54 }} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 17 }}>{work.artistName}</Text>
                        <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 11 }}>{[work.city, work.medium].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Text style={{ color: theme.terracotta }}>→</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.cream, flex: 1, fontSize: 12, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
