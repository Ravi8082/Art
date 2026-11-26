import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventImage, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';

type PublicArtistProfile = {
  profile: {
    displayName: string;
    headline: string;
    city: string;
    state: string;
    artStyle: string;
    bio: string | null;
    photoUrl: string | null;
  };
  artworks: Array<{
    id: string;
    title: string;
    medium: string;
    dimensions: string;
    year: number | null;
    price: number | null;
    description: string;
    imageUrl: string | null;
  }>;
};

type ArtistProfile = {
  artist: {
    id: string;
    slug: string;
    displayName: string;
    city: string | null;
    medium: string | null;
    specialty: string | null;
    bio: string | null;
    artistStatement: string | null;
    practiceDetail: string | null;
    portraitUrl: string | null;
    artworkUrl: string | null;
    coreThemes: string[];
    exhibitionHistory: string[];
  };
  artworks: Array<{
    id: string;
    title: string;
    medium: string | null;
    dimensions: string | null;
    year: number | null;
    description: string | null;
    imageUrl: string | null;
    status: string;
    priceAmount: number | null;
  }>;
};

export default function ArtistScreen() {
  const { slug, userId } = useLocalSearchParams<{ slug?: string; userId?: string }>();
  const profile = useQuery({
    queryKey: ['artist', userId || slug],
    queryFn: async () => {
      if (!userId) {
        return (await api.get<ArtistProfile>(`/artists/${encodeURIComponent(slug ?? '')}`)).data;
      }
      const { data } = await api.get<PublicArtistProfile>(`/artist-profile/public/${encodeURIComponent(userId)}`);
      return {
        artist: {
          id: userId,
          slug: userId,
          displayName: data.profile.displayName,
          city: data.profile.city || null,
          medium: data.profile.artStyle || null,
          specialty: data.profile.headline || null,
          bio: data.profile.bio,
          artistStatement: null,
          practiceDetail: null,
          portraitUrl: data.profile.photoUrl || data.artworks[0]?.imageUrl || null,
          artworkUrl: null,
          coreThemes: [],
          exhibitionHistory: [],
        },
        artworks: data.artworks.map((work) => ({
          id: work.id,
          title: work.title,
          medium: work.medium || null,
          dimensions: work.dimensions || null,
          year: work.year,
          description: work.description || null,
          imageUrl: work.imageUrl,
          status: 'APPROVED',
          priceAmount: work.price,
        })),
      } satisfies ArtistProfile;
    },
    enabled: Boolean(userId || slug),
  });

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {profile.isPending ? (
          <MessageState title="Loading artist profile" description="Getting profile and artwork information." loading />
        ) : profile.isError ? (
          <MessageState title="Artist profile could not load" description={getApiErrorMessage(profile.error)} />
        ) : profile.data ? (
          <>
            <EventImage
              path={profile.data.artist.portraitUrl || profile.data.artist.artworkUrl}
              alt={`Portrait or artwork for ${profile.data.artist.displayName}`}
              style={{ height: 250 }}
            />
            <PageHeading
              eyebrow={[profile.data.artist.city, profile.data.artist.medium].filter(Boolean).join(' · ')}
              title={profile.data.artist.displayName}
              description={profile.data.artist.specialty ?? undefined}
            />
            {profile.data.artist.bio || profile.data.artist.artistStatement ? (
              <View style={[styles.surface, { gap: 10 }]}>
                <Text style={styles.label}>Artist story</Text>
                <Text style={{ color: theme.cream, fontSize: 14, lineHeight: 23 }}>
                  {profile.data.artist.bio || profile.data.artist.artistStatement}
                </Text>
              </View>
            ) : null}
            {profile.data.artworks.length ? (
              <View style={{ gap: 14 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>Selected works</Text>
                {profile.data.artworks.map((work) => <WorkCard key={work.id} work={work} />)}
              </View>
            ) : (
              <MessageState title="No selected works listed" description="There are no artworks attached to this profile yet." />
            )}
          </>
        ) : (
          <MessageState title="Artist profile not found" description="This artist may no longer be listed." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkCard({ work }: { work: ArtistProfile['artworks'][number] }) {
  const uri = resolveMediaUrl(work.imageUrl);
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.surface, { gap: 10 }]}>
      {uri && !failed ? (
        <Image source={{ uri }} contentFit="cover" transition={160} onError={() => setFailed(true)} accessibilityLabel={work.title} style={{ borderRadius: 12, height: 190, width: '100%' }} />
      ) : null}
      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18 }}>{work.title}</Text>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{[work.medium, work.dimensions, work.year].filter(Boolean).join(' · ')}</Text>
      {work.description ? <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{work.description}</Text> : null}
    </View>
  );
}
