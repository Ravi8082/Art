import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { EventImage, HaatText as Text } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { resolveMediaUrl, type ExhibitionArchiveEdition, type PublicArtistArtwork } from '@/lib/api';

export function GalleryArtworkTile({
  artwork,
  onPress,
  style,
  favorite = false,
  onToggleFavorite,
}: {
  artwork: PublicArtistArtwork;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const detail = [artwork.medium, artwork.size, artwork.year].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${artwork.title} by ${artwork.artistName}`}
      onPress={onPress}
      style={[{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, style]}>
      <View>
        <EventImage path={artwork.url} alt={artwork.title} style={{ aspectRatio: 1.05, width: '100%' }} />
        {onToggleFavorite ? (
          <Pressable
            accessibilityLabel={favorite ? `Remove ${artwork.title} from favourites` : `Add ${artwork.title} to favourites`}
            accessibilityRole="button"
            accessibilityState={{ selected: favorite }}
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            style={{ alignItems: 'center', backgroundColor: 'rgba(25, 16, 11, 0.76)', borderRadius: 16, height: 32, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 32 }}>
            <SymbolView name={{ ios: favorite ? 'heart.fill' : 'heart', android: favorite ? 'favorite' : 'favorite_border', web: favorite ? 'favorite' : 'favorite_border' }} tintColor={favorite ? theme.champagne : theme.cream} size={18} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: 4, padding: 10 }}>
        <Text numberOfLines={1} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 16 }}>{artwork.title}</Text>
        <Text numberOfLines={1} style={{ color: theme.terracotta, fontSize: 12 }}>{artwork.artistName}</Text>
        {detail ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 11 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function GalleryEditionTile({
  edition,
  onPress,
  style,
}: {
  edition: ExhibitionArchiveEdition;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const image = edition.media.find((media) => media.mediaType === 'IMAGE' && media.url)?.url;
  const year = edition.startDate?.slice(0, 4);
  const details = [edition.city, edition.monthLabel || year].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${edition.title}`}
      onPress={onPress}
      style={[{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, style]}>
      <EventImage path={resolveMediaUrl(image)} alt={edition.title} style={{ height: 142, width: '100%' }} />
      <View style={{ gap: 5, padding: 12 }}>
        <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18 }}>{edition.title}</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 11 }}>{details}</Text>
        <Text style={{ color: theme.terracotta, fontSize: 11, fontWeight: '600' }}>
          {edition.media.length} archive {edition.media.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </Pressable>
  );
}
