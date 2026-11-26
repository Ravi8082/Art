import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { HaatText as Text, SectionTitle, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';

const aboutLinks = [
  { type: 'about', section: 'hero', title: 'About The Haat of Art', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { type: 'artists', title: 'Artists', icon: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' } },
  { type: 'about', section: 'guests', title: 'Invited Guests & Luminaries', icon: { ios: 'star.fill', android: 'star', web: 'star' } },
  { type: 'about', section: 'event-partners', title: 'Event Partners', icon: { ios: 'person.2', android: 'groups', web: 'groups' } },
  { type: 'about', section: 'media-press', title: 'Media & Press', icon: { ios: 'newspaper', android: 'newspaper', web: 'newspaper' } },
] as const;

const browseLinks = [
  { title: 'Exhibitions', detail: 'Browse upcoming exhibitions and stall availability.', href: '/(tabs)/exhibitions', icon: { ios: 'building.2', android: 'museum', web: 'museum' } },
  { title: 'Events & Event Flow', detail: 'Explore the event calendar and exhibition schedule.', href: '/event-flow', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { title: 'Gallery', detail: 'Browse editions, collections and published artwork.', href: '/(tabs)/gallery', icon: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' } },
  { title: 'Blog', detail: 'Read published stories from The Haat of Art.', href: '/blog', icon: { ios: 'text.book.closed', android: 'article', web: 'article' } },
] as const;

export default function MoreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <ScrollView contentContainerStyle={[styles.content, { gap: 20 }]} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text style={styles.eyebrow}>THE HAAT OF ART</Text>
          <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 30, lineHeight: 34 }}>Explore</Text>
          <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
            Explore artists, exhibitions and the people behind The Haat of Art.
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/(tabs)/account')}
          style={[styles.surface, { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 }]}>
          <View style={{ alignItems: 'center', backgroundColor: theme.background, borderColor: theme.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 }}>
            <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} tintColor={theme.champagne} size={23} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.cream, fontSize: 13, fontWeight: '700' }}>My Profile</Text>
            <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>Account details, applications and visitor passes</Text>
          </View>
          <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 25, lineHeight: 26 }}>›</Text>
        </Pressable>
        <View style={{ gap: 7 }}>
          {aboutLinks.map((item) => (
            <Pressable
              key={item.type === 'artists' ? item.type : item.section}
              accessibilityRole="link"
              onPress={() => item.type === 'artists'
                ? router.push('/(tabs)/artists')
                : router.push({ pathname: '/about', params: { section: item.section } })}
              style={({ pressed }) => [{
                alignItems: 'center',
                backgroundColor: item.type === 'artists' ? theme.surfaceRaised : theme.surface,
                borderColor: pressed || item.type === 'artists' ? theme.terracotta : theme.border,
                borderRadius: 12,
                borderWidth: item.type === 'artists' ? 1.5 : 1,
                flexDirection: 'row',
                gap: 11,
                minHeight: 54,
                paddingHorizontal: 12,
              }, pressed ? { borderWidth: 2 } : null]}>
              <View style={{ alignItems: 'center', backgroundColor: theme.background, borderColor: theme.border, borderRadius: 10, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 }}>
                <SymbolView name={item.icon} tintColor={theme.champagne} size={20} />
              </View>
              <Text style={{ color: theme.cream, flex: 1, fontSize: 12, fontWeight: item.type === 'artists' ? '700' : '500' }}>{item.title}</Text>
              <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 25, lineHeight: 26 }}>›</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/contact')}
            style={({ pressed }) => [{
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderColor: pressed ? theme.terracotta : theme.border,
              borderRadius: 13,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 11,
              minHeight: 54,
              paddingHorizontal: 12,
            }, pressed ? { borderWidth: 2 } : null]}>
            <View style={{ alignItems: 'center', backgroundColor: theme.background, borderColor: theme.border, borderRadius: 10, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 }}>
              <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} tintColor={theme.champagne} size={19} />
            </View>
            <Text style={{ color: theme.cream, flex: 1, fontSize: 12 }}>Contact Us</Text>
            <Text style={{ color: theme.champagne, fontFamily: 'HaatDisplay', fontSize: 25, lineHeight: 26 }}>›</Text>
          </Pressable>
        </View>

        <View style={{ gap: 9 }}>
          <SectionTitle title="Discover" detail="Explore more of The Haat of Art" />
          {browseLinks.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="link"
              onPress={() => router.push(item.href)}
              style={[styles.surface, { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 13 }]}>
              <SymbolView name={item.icon} tintColor={theme.champagne} size={21} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18 }}>{item.title}</Text>
                <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16 }}>{item.detail}</Text>
              </View>
              <Text style={{ color: theme.champagne, fontSize: 17 }}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
