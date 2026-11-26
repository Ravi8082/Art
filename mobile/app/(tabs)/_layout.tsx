import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HaatHeader } from '@/components/haat-ui';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <HaatHeader />,
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.terracotta,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          alignSelf: 'stretch',
          backgroundColor: theme.nav,
          borderTopColor: theme.nav,
          display: 'flex',
          flexDirection: 'row',
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingHorizontal: 0,
          paddingTop: 6,
          width: '100%',
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={21} />
          ),
        }}
      />
      <Tabs.Screen
        name="exhibitions"
        options={{
          title: 'Exhibitions',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'sparkles', android: 'palette', web: 'palette' }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="artists"
        options={{
          title: 'Artists',
          tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="bookings" options={{ href: null }} />
      <Tabs.Screen name="impact" options={{ href: null }} />
      <Tabs.Screen name="contact" options={{ href: null }} />
      <Tabs.Screen name="post" options={{ href: null }} />
    </Tabs>
  );
}
