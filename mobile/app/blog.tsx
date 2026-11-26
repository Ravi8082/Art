import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlogPill, BlogStoryCard } from '@/components/blog-ui';
import { HaatText as Text, MessageState, styles } from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type BlogSummary } from '@/lib/api';
import { formatBlogDate } from '@/lib/blog-storage';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function BlogHomeScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<'All' | 'Stories'>('All');
  const [search, setSearch] = useState('');
  useRefreshOnFocus('blog');

  const postsQuery = useQuery({
    queryKey: ['blog', 'published'],
    queryFn: async () => (await api.get<{ posts: BlogSummary[] }>('/content/blog')).data.posts,
  });
  const posts = postsQuery.data ?? [];
  const visiblePosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((post) => category === 'All' || category === 'Stories')
      .filter((post) => !term || `${post.title} ${post.excerpt} ${post.author}`.toLowerCase().includes(term));
  }, [category, posts, search]);
  const featured = visiblePosts[0] ?? null;
  const heroImage = resolveMediaUrl(featured?.coverUrl);

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 16, paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={postsQuery.isRefetching} onRefresh={() => void postsQuery.refetch()} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 20, borderWidth: 1, overflow: 'hidden' }}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} contentFit="cover" transition={250} accessibilityLabel={featured?.title ?? 'Blog feature'} style={{ aspectRatio: 1.72, backgroundColor: theme.surfaceRaised, width: '100%' }} />
          ) : null}
          <View style={{ gap: 9, padding: 16 }}>
            <Text style={{ color: theme.champagne, fontFamily: typography.sansSemibold, fontSize: 10, letterSpacing: 1.5 }}>BLOG · THE HAAT JOURNAL</Text>
            <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 28, lineHeight: 31 }}>
              {featured?.title ?? 'Stories, Insights & Conversations on Art'}
            </Text>
            <Text numberOfLines={3} style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
              {featured?.excerpt || 'Explore published stories and inspiration from The Haat of Art community.'}
            </Text>
            {featured ? (
              <Text style={{ color: theme.subtle, fontSize: 10 }}>
                {[featured.author, formatBlogDate(featured.publishedAt)].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {featured ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/blog/[id]', params: { id: featured.id } })}
                  style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Read Featured Story  →</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/blog/write')}
                style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 }}>
                <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>Write a Blog</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
          <Text style={{ color: theme.cream, flex: 1, fontFamily: typography.display, fontSize: 22 }}>Stories from the art world</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/blog/my')} style={{ borderColor: theme.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '700' }}>My Blogs</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 7 }}>
          <BlogPill label="All" active={category === 'All'} onPress={() => setCategory('All')} />
          <BlogPill label="Stories" active={category === 'Stories'} onPress={() => setCategory('Stories')} />
        </View>

        <TextInput
          accessibilityLabel="Search stories"
          onChangeText={setSearch}
          placeholder="Search published stories..."
          placeholderTextColor={theme.subtle}
          style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 13, borderWidth: 1, color: theme.cream, fontFamily: typography.sans, fontSize: 12, minHeight: 44, paddingHorizontal: 14 }}
          value={search}
        />

        {postsQuery.isPending ? (
          <MessageState title="Loading stories" description="Getting the latest published articles from the website." loading />
        ) : postsQuery.isError ? (
          <MessageState title="Stories could not load" description={getApiErrorMessage(postsQuery.error)} />
        ) : visiblePosts.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {visiblePosts.map((post) => <BlogStoryCard key={post.id} post={post} compact />)}
          </View>
        ) : (
          <MessageState title={search.trim() ? 'No matching stories' : 'No published stories yet'} description={search.trim() ? 'Try another search.' : 'Stories will appear here after they are approved on the website.'} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
