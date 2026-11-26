import { Link, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { HaatText as Text } from '@/components/haat-ui';
import { theme } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ alignItems: 'center', backgroundColor: theme.background, flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 24 }}>This page isn’t here.</Text>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" style={{ marginTop: 18, padding: 10 }}>
            <Text style={{ color: theme.terracottaLight, fontSize: 14, fontWeight: '700' }}>Back to Discover</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
