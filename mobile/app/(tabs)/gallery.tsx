import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtistCard, EventImage, HaatText as Text, MessageState, PageHeading, SectionTitle, styles } from '@/components/haat-ui';
import { GalleryArtworkTile, GalleryEditionTile } from '@/components/gallery-cards';
import { GalleryArtistsSection } from '@/components/gallery-artists';
import { GalleryNavigation } from '@/components/gallery-navigation';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type ExhibitionArchiveEdition, type PublicArtist, type PublicArtistArtwork } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function GalleryScreen() {
  const router = useRouter();
  const [favoriteArtistIds, setFavoriteArtistIds] = useState<string[]>([]);
  const [favoriteArtworkIds, setFavoriteArtworkIds] = useState<string[]>([]);
  const params = useLocalSearchParams<{ section?: string; year?: string; medium?: string }>();
  const activeSection = typeof params.section === 'string' ? params.section : 'home';
  const selectedYear = typeof params.year === 'string' ? params.year : '';
  const selectedMedium = typeof params.medium === 'string' ? params.medium : '';
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
  });
  const editionItems = editions.data ?? [];
  const artworkItems = artworks.data ?? [];
  const artistItems = artists.data ?? [];
  const featuredEdition = editionItems[0];
  const heroImage = resolveMediaUrl(
    artworkItems.find((artwork) => artwork.url)?.url ??
    featuredEdition?.media.find((media) => media.mediaType === 'IMAGE' && media.url)?.url,
  );
  const years = useMemo(
    () => [...new Set(editionItems.map((edition) => edition.startDate?.slice(0, 4)).filter((year): year is string => Boolean(year)))].sort((a, b) => b.localeCompare(a)),
    [editionItems],
  );
  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    artworkItems.forEach((artwork) => {
      const medium = artwork.medium.trim();
      if (medium) counts.set(medium, (counts.get(medium) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [artworkItems]);
  const visibleEditions = editionItems.filter((edition) => !selectedYear || edition.startDate?.startsWith(selectedYear));
  const visibleArtworks = artworkItems.filter((artwork) => !selectedMedium || artwork.medium === selectedMedium);
  const favoriteArtists = artistItems.filter((artist) => favoriteArtistIds.includes(artist.userId));
  const favoriteArtworks = artworkItems.filter((artwork) => favoriteArtworkIds.includes(artwork.id));
  const refreshing = editions.isRefetching || artworks.isRefetching || artists.isRefetching;
  const refresh = () => { void Promise.all([editions.refetch(), artworks.refetch(), artists.refetch()]); };
  const selectSection = (section: string) => {
    if (section === 'artists' || section === 'artists-directory') {
      router.push('/(tabs)/artists');
      return;
    }
    router.setParams({ section, year: undefined, medium: undefined });
  };
  const selectYear = (year: string) => router.setParams({ section: 'editions', year, medium: undefined });
  const openArtist = (userId: string) => router.push({ pathname: '/artist', params: { userId } });
  const toggleFavorite = (id: string, current: string[], update: (ids: string[]) => void) => {
    update(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {activeSection !== 'artists' && activeSection !== 'artists-directory' ? (
          <GalleryNavigation activeSection={activeSection} onSelect={selectSection} />
        ) : null}

        {activeSection === 'artists' || activeSection === 'artists-directory' ? (
          <GalleryArtistsSection
            artists={artistItems}
            artworks={artworkItems}
            editionCount={editionItems.length}
            artistsPending={artists.isPending}
            artistsError={artists.isError ? getApiErrorMessage(artists.error) : undefined}
            directoryOnly={activeSection === 'artists-directory'}
            favoriteArtistIds={favoriteArtistIds}
            onOpenArtist={openArtist}
            onShowDirectory={() => selectSection('artists-directory')}
            onJoin={() => router.push('/stall-application')}
            onToggleFavorite={(userId) => toggleFavorite(userId, favoriteArtistIds, setFavoriteArtistIds)}
          />
        ) : activeSection === 'editions' ? (
          <View style={{ gap: 16 }}>
            <PageHeading eyebrow="The Haat of Art" title={selectedYear ? `${selectedYear} editions` : 'By Edition'} description="Browse published exhibitions and their linked archive media." />
            {years.length ? (
              <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
                <FilterChip label="All years" selected={!selectedYear} onPress={() => router.setParams({ year: undefined })} />
                {years.map((year) => <FilterChip key={year} label={year} selected={year === selectedYear} onPress={() => selectYear(year)} />)}
              </ScrollView>
            ) : null}
            {editions.isPending ? (
              <MessageState title="Loading editions" description="Getting published editions from the archive." loading />
            ) : editions.isError ? (
              <MessageState title="Editions could not load" description={getApiErrorMessage(editions.error)} />
            ) : visibleEditions.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                {visibleEditions.map((edition) => (
                  <GalleryEditionTile key={edition.id} edition={edition} onPress={() => router.push({ pathname: '/edition', params: { id: edition.id } })} style={{ width: '48%' }} />
                ))}
              </View>
            ) : (
              <MessageState title={selectedYear ? `No editions from ${selectedYear}` : 'No published editions yet'} description="Only editions available in the live exhibition archive are shown." />
            )}
          </View>
        ) : activeSection === 'artworks' ? (
          <View style={{ gap: 16 }}>
            <PageHeading eyebrow="The Haat of Art" title={selectedMedium || 'All Artworks'} description="Original works published in approved artist portfolios." />
            {selectedMedium ? (
              <Pressable accessibilityRole="button" onPress={() => router.setParams({ medium: undefined })} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: theme.champagne, fontSize: 12 }}>Clear collection filter  ×</Text>
              </Pressable>
            ) : null}
            {artworks.isPending ? (
              <MessageState title="Loading artworks" description="Getting published portfolio works." loading />
            ) : artworks.isError ? (
              <MessageState title="Artworks could not load" description={getApiErrorMessage(artworks.error)} />
            ) : visibleArtworks.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                {visibleArtworks.map((artwork) => (
                  <GalleryArtworkTile
                    key={artwork.id}
                    artwork={artwork}
                    favorite={favoriteArtworkIds.includes(artwork.id)}
                    onToggleFavorite={() => toggleFavorite(artwork.id, favoriteArtworkIds, setFavoriteArtworkIds)}
                    onPress={() => router.push({ pathname: '/artwork', params: { id: artwork.id } })}
                    style={{ width: '48%' }}
                  />
                ))}
              </View>
            ) : (
              <MessageState title={selectedMedium ? `No works in ${selectedMedium}` : 'No published artworks yet'} description="Approved portfolio artworks appear here when available." />
            )}
          </View>
        ) : activeSection === 'collections' ? (
          <View style={{ gap: 16 }}>
            <PageHeading eyebrow="The Haat of Art" title="Collections" description="Explore published artworks grouped by medium." />
            {collections.length ? (
              <View style={{ gap: 10 }}>
                {collections.map(([label, count]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    onPress={() => router.setParams({ section: 'artworks', medium: label })}
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
            )}
          </View>
        ) : activeSection === 'favourites' ? (
          <View style={{ gap: 16 }}>
            <PageHeading eyebrow="Your gallery" title="My Favourites" description="Artists and artworks you have saved during this visit." />
            {favoriteArtists.length ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title="Artists" detail="Your saved artist profiles" />
                <ScrollView horizontal contentContainerStyle={{ gap: 12 }} showsHorizontalScrollIndicator={false}>
                  {favoriteArtists.map((artist) => <ArtistCard key={artist.userId} artist={artist} compact />)}
                </ScrollView>
              </View>
            ) : null}
            {favoriteArtworks.length ? (
              <View style={{ gap: 10 }}>
                <SectionTitle title="Artworks" detail="Your saved works" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                  {favoriteArtworks.map((artwork) => (
                    <GalleryArtworkTile
                      key={artwork.id}
                      artwork={artwork}
                      favorite
                      onToggleFavorite={() => toggleFavorite(artwork.id, favoriteArtworkIds, setFavoriteArtworkIds)}
                      onPress={() => router.push({ pathname: '/artwork', params: { id: artwork.id } })}
                      style={{ width: '48%' }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {!favoriteArtists.length && !favoriteArtworks.length ? (
              <MessageState title="No favourites saved" description="Tap a heart on an artist or artwork to add it here." />
            ) : null}
          </View>
        ) : (
          <>
        <View style={{ borderColor: theme.border, borderRadius: 24, borderWidth: 1, minHeight: 275, overflow: 'hidden', justifyContent: 'flex-end' }}>
          {heroImage ? (
            <EventImage path={heroImage} alt="Featured artwork from the gallery" style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={{ backgroundColor: 'rgba(17, 15, 14, 0.78)', gap: 10, padding: 22 }}>
            <Text style={{ color: theme.terracotta, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>THE HAAT OF ART · GALLERY</Text>
            <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 34, lineHeight: 38 }}>Art that lives beyond the moment</Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>Explore exhibition editions, original works and the artists behind them.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => selectSection('editions')}
              style={{ alignSelf: 'flex-start', backgroundColor: theme.terracotta, borderRadius: 24, marginTop: 4, paddingHorizontal: 16, paddingVertical: 11 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Browse editions  →</Text>
            </Pressable>
          </View>
        </View>

        {(editions.isError || artworks.isError || artists.isError) ? (
          <MessageState
            title="Some gallery content could not load"
            description={getApiErrorMessage(editions.error ?? artworks.error ?? artists.error)}
            action={<Pressable accessibilityRole="button" onPress={refresh}><Text style={{ color: theme.terracotta }}>Try again</Text></Pressable>}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <StatCard label="EDITIONS" value={editions.isPending ? '—' : String(editionItems.length)} />
          <StatCard label="ARTWORKS" value={artworks.isPending ? '—' : String(artworkItems.length)} />
          <StatCard label="ARTISTS" value={artists.isPending ? '—' : String(artistItems.length)} />
        </View>

        <View>
          <SectionTitle title="Browse editions" detail="Published exhibitions from the archive" />
          {editions.isPending ? (
            <MessageState title="Loading editions" description="Getting the latest published archive." loading />
          ) : editionItems.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 12 }} showsHorizontalScrollIndicator={false}>
              {editionItems.slice(0, 6).map((edition) => (
                <GalleryEditionTile key={edition.id} edition={edition} onPress={() => router.push({ pathname: '/edition', params: { id: edition.id } })} style={{ width: 230 }} />
              ))}
            </ScrollView>
          ) : editions.isError ? null : (
            <MessageState title="No published editions yet" description="Exhibition editions appear here after they are published in the archive." />
          )}
        </View>

        {years.length ? (
          <View>
            <SectionTitle title="By year" detail="Jump to an archive year" />
            <ScrollView horizontal contentContainerStyle={{ gap: 9 }} showsHorizontalScrollIndicator={false}>
              {years.map((year) => (
                <Pressable
                  key={year}
                  accessibilityRole="button"
                  onPress={() => selectYear(year)}
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, minWidth: 96, padding: 15 }}>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 24 }}>{year}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11 }}>Browse archive</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View>
          <SectionTitle title="All artworks" detail="Original works from approved artist portfolios" />
          {artworks.isPending ? (
            <MessageState title="Loading artworks" description="Getting published portfolio works." loading />
          ) : artworkItems.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 12 }} showsHorizontalScrollIndicator={false}>
              {artworkItems.slice(0, 8).map((artwork) => (
                <GalleryArtworkTile
                  key={artwork.id}
                  artwork={artwork}
                  favorite={favoriteArtworkIds.includes(artwork.id)}
                  onToggleFavorite={() => toggleFavorite(artwork.id, favoriteArtworkIds, setFavoriteArtworkIds)}
                  onPress={() => router.push({ pathname: '/artwork', params: { id: artwork.id } })}
                  style={{ width: 170 }}
                />
              ))}
            </ScrollView>
          ) : artworks.isError ? null : (
            <MessageState title="No published artworks yet" description="Approved artist portfolio works appear here when available." />
          )}
          {artworkItems.length ? <SeeAll onPress={() => selectSection('artworks')} /> : null}
        </View>

        {artistItems.length ? (
          <View>
            <SectionTitle title="Artists" detail="Meet the people behind the work" />
            <ScrollView horizontal contentContainerStyle={{ gap: 12 }} showsHorizontalScrollIndicator={false}>
              {artistItems.slice(0, 8).map((artist) => <ArtistCard key={artist.userId} artist={artist} compact />)}
            </ScrollView>
            <SeeAll onPress={() => selectSection('artists-directory')} />
          </View>
        ) : artists.isError ? null : artists.isPending ? (
          <MessageState title="Loading artists" description="Getting approved artist profiles." loading />
        ) : null}

        {collections.length ? (
          <View>
            <SectionTitle title="Collections" detail="Explore works by medium" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {collections.slice(0, 8).map(([medium, count]) => (
                <Pressable
                  key={medium}
                  accessibilityRole="button"
                  onPress={() => router.setParams({ section: 'artworks', medium })}
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexGrow: 1, minWidth: '46%', padding: 14 }}>
                  <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 17 }}>{medium}</Text>
                  <Text style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{count} {count === 1 ? 'work' : 'works'}</Text>
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

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ backgroundColor: selected ? theme.champagne : theme.surface, borderColor: selected ? theme.champagne : theme.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }}>
      <Text style={{ color: selected ? theme.background : theme.cream, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flex: 1, gap: 3, paddingVertical: 12 }}>
      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 22 }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

function SeeAll({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: 'flex-end', paddingTop: 12 }}>
      <Text style={{ color: theme.terracotta, fontSize: 12, fontWeight: '700' }}>See all  →</Text>
    </Pressable>
  );
}
