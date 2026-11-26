import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtistCard, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { GalleryArtworkTile, GalleryEditionTile } from '@/components/gallery-cards';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, type ExhibitionArchiveEdition, type PublicArtist, type PublicArtistArtwork } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function EditionArchiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; year?: string; medium?: string }>();
  const view = typeof params.view === 'string' ? params.view : 'editions';
  const year = typeof params.year === 'string' ? params.year : '';
  const medium = typeof params.medium === 'string' ? params.medium : '';
  useRefreshOnFocus('gallery');
  const editions = useQuery({
    queryKey: ['gallery', 'archive'],
    queryFn: async () => (await api.get<ExhibitionArchiveEdition[]>('/exhibition-archive')).data,
  });
  const artworks = useQuery({
    queryKey: ['gallery', 'artworks'],
    queryFn: async () => (await api.get<PublicArtistArtwork[]>('/artist-profile/public/gallery')).data,
  });
  const artists = useQuery({
    queryKey: ['gallery', 'artists'],
    queryFn: async () => (await api.get<PublicArtist[]>('/artist-profile/public')).data,
    enabled: view === 'artists',
  });
  const editionItems = editions.data ?? [];
  const artworkItems = artworks.data ?? [];
  const years = useMemo(
    () => [...new Set(editionItems.map((edition) => edition.startDate?.slice(0, 4)).filter((value): value is string => Boolean(value)))].sort((a, b) => b.localeCompare(a)),
    [editionItems],
  );
  const visibleEditions = editionItems.filter((edition) => view !== 'year' || !year || edition.startDate?.startsWith(year));
  const visibleArtworks = artworkItems.filter((artwork) =>
    (!medium || artwork.medium === medium) && (view !== 'year' || !year || String(artwork.year ?? '') === year),
  );
  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    artworkItems.forEach((work) => {
      const value = work.medium.trim();
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [artworkItems]);
  const title = view === 'artworks' ? (medium || 'All artworks')
    : view === 'artists' ? 'Artists'
      : view === 'collections' ? 'Collections'
        : view === 'year' ? `Editions ${year}` : 'Edition archive';
  const description = view === 'artworks' ? 'Original works published in approved artist portfolios.'
    : view === 'artists' ? 'Approved artist profiles from the live artist directory.'
      : view === 'collections' ? 'Collections grouped by artwork medium.'
        : 'Browse published exhibitions and their archive media.';
  const refreshing = editions.isRefetching || artworks.isRefetching || artists.isRefetching;
  const refresh = () => { void Promise.all([editions.refetch(), artworks.refetch(), artists.refetch()]); };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        <PageHeading eyebrow="The Haat of Art" title={title} description={description} />

        {view === 'year' ? (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {years.map((item) => (
              <FilterChip key={item} label={item} selected={item === year} onPress={() => router.setParams({ year: item })} />
            ))}
          </ScrollView>
        ) : null}

        {view === 'editions' || view === 'year' ? (
          <>
            {editions.isPending ? (
              <MessageState title="Loading the archive" description="Getting published editions from the database." loading />
            ) : editions.isError ? (
              <MessageState title="The archive could not load" description={getApiErrorMessage(editions.error)} />
            ) : visibleEditions.length ? (
              <View style={{ gap: 14 }}>
                {visibleEditions.map((edition) => (
                  <GalleryEditionTile key={edition.id} edition={edition} onPress={() => router.push({ pathname: '/edition', params: { id: edition.id } })} />
                ))}
              </View>
            ) : (
              <MessageState title={year ? `No editions in ${year}` : 'No published editions yet'} description="Only editions published in the exhibition archive are shown here." />
            )}
            {view === 'year' ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 22 }}>Portfolio works from {year}</Text>
                <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>These are approved portfolio works carrying this year; artist portfolios are not directly linked to archive editions.</Text>
                {artworks.isError ? (
                  <MessageState title="Portfolio works could not load" description={getApiErrorMessage(artworks.error)} />
                ) : visibleArtworks.length ? (
                  <ArtworkGrid artworks={visibleArtworks} onArtworkPress={(id) => router.push({ pathname: '/artwork', params: { id } })} />
                ) : artworks.isPending ? (
                  <MessageState title="Loading artworks" description="Getting portfolio works for this year." loading />
                ) : (
                  <MessageState title={`No portfolio works from ${year}`} description="Approved portfolio items for this year will appear here." />
                )}
              </View>
            ) : null}
          </>
        ) : null}

        {view === 'artworks' ? (
          artworks.isPending ? (
            <MessageState title="Loading artworks" description="Getting published portfolio works." loading />
          ) : artworks.isError ? (
            <MessageState title="Artworks could not load" description={getApiErrorMessage(artworks.error)} />
          ) : visibleArtworks.length ? (
            <ArtworkGrid artworks={visibleArtworks} onArtworkPress={(id) => router.push({ pathname: '/artwork', params: { id } })} />
          ) : (
            <MessageState title={medium ? `No works in ${medium}` : 'No published artworks yet'} description="Approved artist portfolio works appear here when available." />
          )
        ) : null}

        {view === 'artists' ? (
          artists.isPending ? (
            <MessageState title="Loading artist profiles" description="Getting the current artist directory." loading />
          ) : artists.isError ? (
            <MessageState title="Artists could not load" description={getApiErrorMessage(artists.error)} />
          ) : artists.data?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              {artists.data.map((artist) => <ArtistCard key={artist.userId} artist={artist} />)}
            </View>
          ) : (
            <MessageState title="No approved artist profiles yet" description="Published artist profiles will appear here when available." />
          )
        ) : null}

        {view === 'collections' ? (
          collections.length ? (
            <View style={{ gap: 10 }}>
              {collections.map(([label, count]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/edition-archive', params: { view: 'artworks', medium: label } })}
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
                  <Text style={{ color: theme.cream, flex: 1, fontFamily: 'HaatDisplay', fontSize: 18 }}>{label}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{count} {count === 1 ? 'work' : 'works'}  →</Text>
                </Pressable>
              ))}
            </View>
          ) : artworks.isError ? (
            <MessageState title="Collections could not load" description={getApiErrorMessage(artworks.error)} />
          ) : artworks.isPending ? (
            <MessageState title="Loading collections" description="Grouping portfolio works by medium." loading />
          ) : (
            <MessageState title="No collections yet" description="Published works with a medium will be grouped here." />
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ArtworkGrid({
  artworks,
  onArtworkPress,
}: {
  artworks: PublicArtistArtwork[];
  onArtworkPress: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
      {artworks.map((artwork) => (
        <GalleryArtworkTile key={artwork.id} artwork={artwork} onPress={() => onArtworkPress(artwork.id)} style={{ width: '48%' }} />
      ))}
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ backgroundColor: selected ? theme.terracotta : theme.surface, borderColor: selected ? theme.terracotta : theme.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text style={{ color: selected ? '#FFFFFF' : theme.cream, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
