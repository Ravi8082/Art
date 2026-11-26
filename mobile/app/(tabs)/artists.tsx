import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GalleryArtistsSection } from '@/components/gallery-artists';
import { styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, type ExhibitionArchiveEdition, type PublicArtist, type PublicArtistArtwork } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function ArtistsScreen() {
  const router = useRouter();
  const [favoriteArtistIds, setFavoriteArtistIds] = useState<string[]>([]);
  useRefreshOnFocus('artists');

  const artists = useQuery({
    queryKey: ['gallery', 'artists'],
    queryFn: async () => (await api.get<PublicArtist[]>('/artist-profile/public')).data,
  });
  const artworks = useQuery({
    queryKey: ['gallery', 'artworks'],
    queryFn: async () => (await api.get<PublicArtistArtwork[]>('/artist-profile/public/gallery')).data,
  });
  const editions = useQuery({
    queryKey: ['gallery', 'archive'],
    queryFn: async () => (await api.get<ExhibitionArchiveEdition[]>('/exhibition-archive')).data,
  });

  const refresh = () => {
    void Promise.all([artists.refetch(), artworks.refetch(), editions.refetch()]);
  };
  const error = artists.error ?? artworks.error;

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 24 }]}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={artists.isRefetching || artworks.isRefetching || editions.isRefetching} onRefresh={refresh} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        <GalleryArtistsSection
          artists={artists.data ?? []}
          artworks={artworks.data ?? []}
          editionCount={editions.data?.length ?? 0}
          artistsPending={artists.isPending || artworks.isPending}
          artistsError={error ? getApiErrorMessage(error) : undefined}
          directoryOnly
          favoriteArtistIds={favoriteArtistIds}
          onOpenArtist={(userId) => router.push({ pathname: '/artist', params: { userId } })}
          onJoin={() => router.push('/stall-application')}
          onToggleFavorite={(userId) => setFavoriteArtistIds((current) => (
            current.includes(userId)
              ? current.filter((id) => id !== userId)
              : [...current, userId]
          ))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
