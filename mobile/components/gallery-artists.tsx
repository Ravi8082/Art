import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  EventImage,
  HaatText as Text,
  MessageState,
} from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import type { PublicArtist, PublicArtistArtwork } from '@/lib/api';

type GalleryArtistsProps = {
  artists: PublicArtist[];
  artworks: PublicArtistArtwork[];
  editionCount: number;
  artistsPending: boolean;
  artistsError?: string;
  directoryOnly: boolean;
  favoriteArtistIds: string[];
  onOpenArtist: (userId: string) => void;
  onShowDirectory?: () => void;
  onJoin: () => void;
  onToggleFavorite: (userId: string) => void;
};

const programmes = [
  { title: 'Artist Membership', icon: { ios: 'person.crop.rectangle', android: 'badge', web: 'badge' } },
  { title: 'Showcase Your Work', icon: { ios: 'photo', android: 'image', web: 'image' } },
  { title: 'Curator Support', icon: { ios: 'person.2', android: 'groups', web: 'groups' } },
  { title: 'Press & Media Kit', icon: { ios: 'doc.text', android: 'description', web: 'description' } },
] as const;

export function GalleryArtistsSection({
  artists,
  artworks,
  editionCount,
  artistsPending,
  artistsError,
  directoryOnly,
  favoriteArtistIds,
  onOpenArtist,
  onShowDirectory,
  onJoin,
  onToggleFavorite,
}: GalleryArtistsProps) {
  const [search, setSearch] = useState('');
  const [selectedMedium, setSelectedMedium] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [showCityFilters, setShowCityFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const artworkByArtist = useMemo(() => {
    const result = new Map<string, PublicArtistArtwork>();
    artworks.forEach((artwork) => {
      if (!result.has(artwork.artistId)) result.set(artwork.artistId, artwork);
    });
    return result;
  }, [artworks]);
  const mediums = useMemo(
    () => [...new Set(artists.map((artist) => artist.artStyle.trim()).filter(Boolean))].sort(),
    [artists],
  );
  const cities = useMemo(
    () => [...new Set(artists.map((artist) => artist.city.trim()).filter(Boolean))].sort(),
    [artists],
  );
  const searchTerm = search.trim().toLocaleLowerCase();
  const visibleArtists = artists.filter((artist) => {
    const artistWorks = artworks.filter((artwork) => artwork.artistId === artist.userId);
    const searchable = [
      artist.displayName,
      artist.city,
      artist.artStyle,
      artist.headline,
      ...artistWorks.flatMap((work) => [work.title, work.medium]),
    ].join(' ').toLocaleLowerCase();
    return (!searchTerm || searchable.includes(searchTerm))
      && (selectedMedium === 'All' || artist.artStyle === selectedMedium)
      && (selectedCity === 'All' || artist.city === selectedCity);
  });
  const featuredArtist = artists.length ? artists[featuredIndex % artists.length] : undefined;
  const featuredArtwork = featuredArtist ? artworkByArtist.get(featuredArtist.userId) : undefined;
  const collageImages = [
    ...artworks.map((artwork) => artwork.url),
    ...artists.map((artist) => artist.imageUrl),
  ].filter((image): image is string => Boolean(image)).slice(0, 3);

  if (directoryOnly) {
    return (
      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 30, lineHeight: 34 }}>Artists</Text>
          <Text style={{ color: theme.cream, fontSize: 14, lineHeight: 20 }}>
            Discover artists from across editions of The Haat of Art.
          </Text>
        </View>

        <ScrollView horizontal contentContainerStyle={{ gap: 7 }} showsHorizontalScrollIndicator={false}>
          {['All', ...mediums].map((medium) => (
            <FilterChip
              key={medium}
              label={medium}
              selected={selectedMedium === medium}
              onPress={() => {
                setSelectedMedium(medium);
                setVisibleCount(6);
              }}
            />
          ))}
        </ScrollView>

        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <View style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 24, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: 13 }}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={theme.muted} size={19} />
            <TextInput
              accessibilityLabel="Search artists by name, artwork or medium"
              onChangeText={(value) => {
                setSearch(value);
                setVisibleCount(6);
              }}
              placeholder="Search artists, artworks or medium..."
              placeholderTextColor={theme.muted}
              returnKeyType="search"
              style={{ color: theme.cream, flex: 1, fontFamily: 'HaatSans', fontSize: 12, marginLeft: 9, minHeight: 46, paddingVertical: 0 }}
              value={search}
            />
          </View>
          <Pressable
            accessibilityLabel="Filter artists by city"
            accessibilityRole="button"
            accessibilityState={{ expanded: showCityFilters }}
            onPress={() => setShowCityFilters((current) => !current)}
            style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 }}>
            <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} tintColor={theme.champagne} size={20} />
          </Pressable>
        </View>

        {showCityFilters && cities.length ? (
          <ScrollView horizontal contentContainerStyle={{ gap: 7 }} showsHorizontalScrollIndicator={false}>
            {['All', ...cities].map((city) => (
              <FilterChip key={city} label={city} selected={selectedCity === city} onPress={() => setSelectedCity(city)} />
            ))}
          </ScrollView>
        ) : null}

        {artistsPending ? (
          <MessageState title="Loading artists" description="Getting the latest approved artist profiles." loading />
        ) : artistsError ? (
          <MessageState title="Artists could not load" description={artistsError} />
        ) : visibleArtists.length ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              {visibleArtists.slice(0, visibleCount).map((artist) => (
                <ArtistRosterCard
                  key={artist.userId}
                  artist={artist}
                  artwork={artworkByArtist.get(artist.userId)}
                  favorite={favoriteArtistIds.includes(artist.userId)}
                  onPress={() => onOpenArtist(artist.userId)}
                  onToggleFavorite={() => onToggleFavorite(artist.userId)}
                />
              ))}
            </View>
            {visibleCount < visibleArtists.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleCount((count) => count + 6)}
                style={{ alignSelf: 'center', borderColor: theme.champagne, borderRadius: 24, borderWidth: 1, marginTop: 1, paddingHorizontal: 24, paddingVertical: 11 }}>
                <Text style={{ color: theme.cream, fontSize: 12, fontWeight: '600' }}>Load More Artists  ↓</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <MessageState
            title={artists.length ? 'No matching artists' : 'No approved artist profiles yet'}
            description={artists.length ? 'Try another artist name, medium or city.' : 'Published artist profiles will appear here when available.'}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ borderBottomColor: theme.border, borderBottomWidth: 1, height: 292, justifyContent: 'center', overflow: 'hidden', paddingBottom: 16, paddingTop: 8 }}>
        <View style={{ gap: 8, width: '66%', zIndex: 1 }}>
          <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>ARTISTS</Text>
          <Text style={{ color: theme.cream, fontFamily: 'HaatDisplayItalic', fontSize: 28, fontStyle: 'italic', lineHeight: 29 }}>
            The Hands Behind India&apos;s Living Canvas
          </Text>
          <Text style={{ color: theme.cream, fontSize: 11, lineHeight: 16 }}>
            Meet the artists shaping our exhibitions, workshops and cultural dialogue.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 }}>
            <HeroAction label="Join as Artist  →" onPress={onJoin} primary />
            {onShowDirectory ? <HeroAction label="Explore Artists" onPress={onShowDirectory} /> : null}
          </View>
        </View>
        <ArtistCollage images={collageImages} />
      </View>

      <View style={{ borderBottomColor: theme.border, borderBottomWidth: 1, borderTopColor: theme.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
        <Stat label="Artists" value={String(artists.length)} />
        <Stat label="Editions" value={String(editionCount)} />
        <Stat label="Artworks" value={String(artworks.length)} />
      </View>

      {artistsPending ? (
        <MessageState title="Loading featured artist" description="Getting artist profiles from the directory." loading />
      ) : artistsError ? (
        <MessageState title="Featured artist could not load" description={artistsError} />
      ) : featuredArtist ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.champagne, fontSize: 9, fontWeight: '700', letterSpacing: 1.8 }}>FEATURED ARTIST</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenArtist(featuredArtist.userId)}
            style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 205, overflow: 'hidden' }}>
            <EventImage
              path={featuredArtwork?.url || featuredArtist.imageUrl}
              alt={`Artwork by ${featuredArtist.displayName}`}
              style={{ height: 216, width: '47%' }}
            />
            <View style={{ flex: 1, gap: 5, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 12 }}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplayItalic', fontSize: 21, fontStyle: 'italic', lineHeight: 23 }}>
                {featuredArtist.displayName}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 10 }}>
                {[featuredArtist.artStyle, featuredArtist.city].filter(Boolean).join(' · ')}
              </Text>
              {featuredArtist.headline ? (
                <Text numberOfLines={4} style={{ color: theme.cream, fontSize: 10, fontStyle: 'italic', lineHeight: 15 }}>
                  “{featuredArtist.headline}”
                </Text>
              ) : null}
              <Text style={{ backgroundColor: theme.champagne, borderRadius: 18, color: theme.background, fontSize: 10, fontWeight: '700', marginTop: 3, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7, textAlign: 'center' }}>
                View Artist Profile  →
              </Text>
            </View>
          </Pressable>
          {artists.length > 1 ? (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
              {artists.slice(0, 5).map((artist, index) => (
                <Pressable
                  key={artist.userId}
                  accessibilityLabel={`Feature ${artist.displayName}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: index === featuredIndex % artists.length }}
                  onPress={() => setFeaturedIndex(index)}
                  style={{ backgroundColor: index === featuredIndex % artists.length ? theme.champagne : theme.border, borderRadius: 5, height: 8, width: 8 }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <MessageState title="No featured artists yet" description="Approved artist profiles will appear here when available." />
      )}

      <View style={{ gap: 9 }}>
        <SectionHeading title="Artist Programmes" />
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
          {programmes.map((programme) => (
            <View key={programme.title} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, gap: 7, height: 86, justifyContent: 'center', paddingHorizontal: 5, width: 83 }}>
              <SymbolView name={programme.icon} tintColor={theme.champagne} size={22} />
              <Text style={{ color: theme.cream, fontSize: 9, lineHeight: 12, textAlign: 'center' }}>{programme.title}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {artists.length ? (
        <View style={{ gap: 9 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <SectionHeading title="Featured Artists" />
            {onShowDirectory ? (
              <Pressable accessibilityRole="button" onPress={onShowDirectory} style={{ padding: 4 }}>
                <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '700' }}>View All  →</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {artists.slice(0, 8).map((artist) => (
              <MiniArtistCard
                key={artist.userId}
                artist={artist}
                artwork={artworkByArtist.get(artist.userId)}
                onPress={() => onOpenArtist(artist.userId)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function ArtistCollage({ images }: { images: string[] }) {
  const frames = [
    { right: 12, top: 3, height: 75, width: 103, rotate: '4deg' },
    { right: 44, top: 81, height: 96, width: 99, rotate: '-5deg' },
    { right: 1, top: 172, height: 80, width: 91, rotate: '6deg' },
  ];

  return (
    <View pointerEvents="none" style={{ height: 256, position: 'absolute', right: -3, top: 10, width: 158 }}>
      {frames.map((frame, index) => {
        const image = images[index];
        if (!image) return null;
        return (
          <View
            key={`${image}-${index}`}
            style={[{
              backgroundColor: theme.surface,
              borderColor: '#F6EEDF',
              borderRadius: 2,
              borderWidth: 2,
              elevation: 3,
              overflow: 'hidden',
              position: 'absolute',
              shadowColor: '#000000',
              shadowOffset: { height: 2, width: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
            }, {
              height: frame.height,
              right: frame.right,
              top: frame.top,
              transform: [{ rotate: frame.rotate }],
              width: frame.width,
            }]}>
            <EventImage path={image} alt="Artwork from the artist gallery" style={StyleSheet.absoluteFill} />
          </View>
        );
      })}
    </View>
  );
}

function ArtistRosterCard({
  artist,
  artwork,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  artist: PublicArtist;
  artwork?: PublicArtistArtwork;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${artist.displayName}'s profile`}
      onPress={onPress}
      style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, overflow: 'hidden', width: '48%' }}>
      <View>
        <EventImage path={artist.imageUrl || artwork?.url} alt={`Artwork by ${artist.displayName}`} style={{ aspectRatio: 0.9, width: '100%' }} />
        <Pressable
          accessibilityLabel={favorite ? `Remove ${artist.displayName} from favourites` : `Add ${artist.displayName} to favourites`}
          accessibilityRole="button"
          accessibilityState={{ selected: favorite }}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={{ alignItems: 'center', backgroundColor: 'rgba(25, 16, 11, 0.76)', borderRadius: 16, height: 32, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 32 }}>
          <SymbolView name={{ ios: favorite ? 'heart.fill' : 'heart', android: favorite ? 'favorite' : 'favorite_border', web: favorite ? 'favorite' : 'favorite_border' }} tintColor={favorite ? theme.champagne : theme.cream} size={18} />
        </Pressable>
      </View>
      <View style={{ gap: 4, padding: 9 }}>
        <Text numberOfLines={1} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 16 }}>{artist.displayName}</Text>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} tintColor={theme.muted} size={12} />
          <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, fontSize: 9 }}>
            {[artist.artStyle, artist.city].filter(Boolean).join(' · ') || 'Artist'}
          </Text>
        </View>
        {artist.headline ? <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 9, lineHeight: 13 }}>{artist.headline}</Text> : null}
        <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '700', marginTop: 2 }}>View Profile  →</Text>
      </View>
    </Pressable>
  );
}

function MiniArtistCard({
  artist,
  artwork,
  onPress,
}: {
  artist: PublicArtist;
  artwork?: PublicArtistArtwork;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${artist.displayName}'s profile`}
      onPress={onPress}
      style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 11, borderWidth: 1, overflow: 'hidden', width: 82 }}>
      <EventImage path={artist.imageUrl || artwork?.url} alt={`Portrait of ${artist.displayName}`} style={{ height: 80, width: '100%' }} />
      <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 9, lineHeight: 12, minHeight: 31, paddingHorizontal: 5, paddingVertical: 4, textAlign: 'center' }}>
        {artist.displayName}
      </Text>
    </Pressable>
  );
}

function HeroAction({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ alignItems: 'center', backgroundColor: primary ? theme.champagne : 'transparent', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 11 }}>
      <Text style={{ color: primary ? theme.background : theme.cream, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 2 }}>
      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>{value}</Text>
      <Text style={{ color: theme.cream, fontSize: 9 }}>{label}</Text>
    </View>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={{ borderLeftColor: theme.champagne, borderLeftWidth: 3, justifyContent: 'center', minHeight: 22, paddingLeft: 8 }}>
      <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>{title}</Text>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ backgroundColor: selected ? theme.champagne : 'transparent', borderColor: theme.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
      <Text numberOfLines={1} style={{ color: selected ? theme.background : theme.cream, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
