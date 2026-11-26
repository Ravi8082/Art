import { Pressable, ScrollView } from 'react-native';
import { HaatText as Text } from '@/components/haat-ui';
import { theme } from '@/constants/theme';

const sections = [
  { id: 'editions', label: 'By Edition' },
  { id: 'artists', label: 'Artists' },
  { id: 'artworks', label: 'All Artworks' },
  { id: 'collections', label: 'Collections' },
  { id: 'favourites', label: 'My Favourites' },
];

export function GalleryNavigation({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (section: string) => void;
}) {
  const selectedSection = activeSection === 'artists-directory' ? 'artists' : activeSection;

  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
      {sections.map((section) => {
        const selected = section.id === selectedSection;
        return (
          <Pressable
            key={section.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(section.id)}
            style={{ backgroundColor: selected ? theme.champagne : theme.surface, borderColor: theme.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text numberOfLines={1} style={{ color: selected ? theme.background : theme.cream, fontSize: 11, fontWeight: '600' }}>{section.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
