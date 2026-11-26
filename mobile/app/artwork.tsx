import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventImage, HaatButton, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, type PublicArtistArtwork } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function ArtworkScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  useRefreshOnFocus('gallery');
  const gallery = useQuery({
    queryKey: ['gallery', 'artworks'],
    queryFn: async () => (await api.get<PublicArtistArtwork[]>('/artist-profile/public/gallery')).data,
  });
  const artwork = gallery.data?.find((item) => item.id === id);

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={gallery.isRefetching} onRefresh={() => { void gallery.refetch(); }} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {gallery.isPending ? (
          <MessageState title="Loading artwork" description="Getting artwork details from the artist portfolio." loading />
        ) : gallery.isError ? (
          <MessageState title="Artwork could not load" description={getApiErrorMessage(gallery.error)} />
        ) : !artwork ? (
          <MessageState title="Artwork not found" description="This work may no longer be published in the artist portfolio." />
        ) : (
          <>
            <EventImage path={artwork.url} alt={artwork.title} style={{ aspectRatio: 0.92, borderRadius: 18, width: '100%' }} />
            <PageHeading
              eyebrow={[artwork.medium, artwork.year].filter(Boolean).join(' · ')}
              title={artwork.title}
              description={artwork.artistName}
            />
            <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 16 }}>
              <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>ARTWORK DETAILS</Text>
              <DetailRow label="Artist" value={artwork.artistName} />
              <DetailRow label="Medium" value={artwork.medium} />
              <DetailRow label="Size" value={artwork.size} />
              <DetailRow label="Year" value={artwork.year === null ? '' : String(artwork.year)} />
              {artwork.city ? <DetailRow label="City" value={artwork.city} /> : null}
            </View>
            {artwork.description ? (
              <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 18, borderWidth: 1, gap: 8, padding: 16 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>About this work</Text>
                <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 21 }}>{artwork.description}</Text>
              </View>
            ) : null}
            <HaatButton label={`View ${artwork.artistName}'s profile`} onPress={() => router.push({ pathname: '/artist', params: { userId: artwork.artistId } })} />
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: 'center', padding: 8 }}>
              <Text style={{ color: theme.terracotta, fontSize: 12 }}>← Back to gallery</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.cream, flex: 1, fontSize: 12, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
