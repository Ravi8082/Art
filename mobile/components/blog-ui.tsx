import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { HaatText as Text } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { resolveMediaUrl, type BlogSummary } from '@/lib/api';
import { formatBlogDate } from '@/lib/blog-storage';

export function BlogStoryCard({ post, compact = false }: { post: BlogSummary; compact?: boolean }) {
  const imageUrl = resolveMediaUrl(post.coverUrl);

  return (
    <Link href={{ pathname: '/blog/[id]', params: { id: post.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: 16,
          borderWidth: 1,
          flexGrow: compact ? 1 : 0,
          overflow: 'hidden',
          width: compact ? '48%' : '100%',
        }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={post.title}
            style={{ aspectRatio: compact ? 1.42 : 1.7, backgroundColor: theme.surfaceRaised, width: '100%' }}
          />
        ) : (
          <View style={{ alignItems: 'center', aspectRatio: compact ? 1.42 : 1.7, backgroundColor: theme.surfaceRaised, justifyContent: 'center' }}>
            <Text style={{ color: theme.champagne, fontSize: 11, letterSpacing: 1 }}>THE HAAT JOURNAL</Text>
          </View>
        )}
        <View style={{ gap: 7, padding: compact ? 11 : 14 }}>
          <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>STORY</Text>
          <Text numberOfLines={compact ? 3 : 2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: compact ? 16 : 20, lineHeight: compact ? 19 : 23 }}>
            {post.title}
          </Text>
          {!compact && post.excerpt ? (
            <Text numberOfLines={3} style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>{post.excerpt}</Text>
          ) : null}
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text numberOfLines={1} style={{ color: theme.subtle, flex: 1, fontSize: 9 }}>
              {[post.author, formatBlogDate(post.publishedAt)].filter(Boolean).join(' · ')}
            </Text>
            <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '700' }}>Read  →</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function BlogPill({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: active ? theme.terracotta : theme.background,
        borderColor: active ? theme.terracotta : theme.border,
        borderRadius: 22,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 35,
        paddingHorizontal: 15,
      }}>
      <Text style={{ color: active ? '#FFFFFF' : theme.cream, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
