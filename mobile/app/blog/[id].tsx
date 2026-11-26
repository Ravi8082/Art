import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatText as Text, MessageState, styles } from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type BlogPost } from '@/lib/api';
import { formatBlogDate, loadLikedBlogIds, loadSavedBlogIds, toggleLikedBlog, toggleSavedBlog } from '@/lib/blog-storage';
import { stripHtmlText } from '@/lib/content-text';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function BlogArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState('');
  useRefreshOnFocus(`blog-${id ?? ''}`);

  const article = useQuery({
    queryKey: ['blog', 'article', id],
    queryFn: async () => (await api.get<BlogPost>(`/content/blog/${encodeURIComponent(id ?? '')}`)).data,
    enabled: Boolean(id),
  });

  useEffect(() => {
    let active = true;
    if (!id) return () => { active = false; };
    Promise.all([loadLikedBlogIds(), loadSavedBlogIds()])
      .then(([likedIds, savedIds]) => {
        if (active) {
          setLiked(likedIds.includes(id));
          setSaved(savedIds.includes(id));
        }
      })
      .catch((error: unknown) => {
        if (active) setLocalError(getApiErrorMessage(error));
      });
    return () => { active = false; };
  }, [id]);

  const post = article.data;
  const bodyParagraphs = useMemo(
    () => post ? stripHtmlText(post.body).split(/\n+/).map((part) => part.trim()).filter(Boolean) : [],
    [post],
  );
  const gallery = (post?.media ?? []).filter((item) => item.mediaType === 'IMAGE' && item.url !== post?.coverUrl);

  async function toggleLike() {
    if (!id) return;
    try {
      setLiked(await toggleLikedBlog(id));
      setLocalError('');
    } catch (error) {
      setLocalError(getApiErrorMessage(error));
    }
  }

  async function toggleSave() {
    if (!id) return;
    try {
      setSaved(await toggleSavedBlog(id));
      setLocalError('');
    } catch (error) {
      setLocalError(getApiErrorMessage(error));
    }
  }

  async function sharePost() {
    if (!post) return;
    try {
      await Share.share({ title: post.title, message: `${post.title}\n\n${post.excerpt}` });
    } catch (error) {
      setLocalError(getApiErrorMessage(error));
    }
  }

  async function openVideo(url: string) {
    const resolvedUrl = resolveMediaUrl(url);
    if (!resolvedUrl) return;
    try {
      await Linking.openURL(resolvedUrl);
    } catch (error) {
      setLocalError(getApiErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 15, paddingBottom: 25 }]}
        refreshControl={<RefreshControl refreshing={article.isRefetching} onRefresh={() => void article.refetch()} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        {article.isPending ? (
          <MessageState title="Loading article" description="Getting the published story and its images." loading />
        ) : article.isError ? (
          <MessageState title="Article could not load" description={getApiErrorMessage(article.error)} />
        ) : post ? (
          <>
            {post.coverUrl ? (
              <Image source={{ uri: resolveMediaUrl(post.coverUrl) ?? undefined }} contentFit="cover" transition={250} accessibilityLabel={post.title} style={{ aspectRatio: 1.6, backgroundColor: theme.surfaceRaised, borderRadius: 16, width: '100%' }} />
            ) : null}
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.terracotta, fontFamily: typography.sansSemibold, fontSize: 10, letterSpacing: 1.3 }}>STORY · THE HAAT JOURNAL</Text>
              <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 30, lineHeight: 33 }}>{post.title}</Text>
              {post.excerpt ? <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{post.excerpt}</Text> : null}
              <Text style={{ color: theme.champagne, fontSize: 11 }}>
                {[post.author, formatBlogDate(post.publishedAt)].filter(Boolean).join('  ·  ')}
              </Text>
            </View>

            <View style={{ gap: 13 }}>
              {bodyParagraphs.map((paragraph, index) => (
                <Text key={`${index}-${paragraph.slice(0, 20)}`} style={{ color: theme.cream, fontSize: 14, lineHeight: 23 }}>{paragraph}</Text>
              ))}
            </View>

            {gallery.map((image) => (
              <Image key={image.id} source={{ uri: resolveMediaUrl(image.url) ?? undefined }} contentFit="cover" transition={200} accessibilityLabel={post.title} style={{ aspectRatio: 1.6, backgroundColor: theme.surfaceRaised, borderRadius: 15, width: '100%' }} />
            ))}

            {(post.media ?? []).filter((item) => item.mediaType === 'VIDEO').map((video) => (
              <Pressable key={video.id} accessibilityRole="button" onPress={() => void openVideo(video.url)} style={{ alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ color: theme.champagne, fontSize: 12, fontWeight: '700' }}>Open article video  ↗</Text>
              </Pressable>
            ))}

            <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 9 }}>
              <ActionButton label={liked ? 'Liked' : 'Like'} icon={liked ? '♥' : '♡'} active={liked} onPress={() => void toggleLike()} />
              <ActionButton label={saved ? 'Saved' : 'Save'} icon={saved ? '▣' : '▢'} active={saved} onPress={() => void toggleSave()} />
              <ActionButton label="Share" icon="↗" onPress={() => void sharePost()} />
            </View>
            {localError ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 11, lineHeight: 17 }}>{localError}</Text> : null}
            <Text style={{ color: theme.subtle, fontSize: 10, lineHeight: 15 }}>Likes and saved stories are stored on this device. Published article content and images come from the website.</Text>
          </>
        ) : (
          <MessageState title="Article not found" description="This story may no longer be publicly available." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={{ alignItems: 'center', borderColor: active ? theme.terracotta : theme.border, borderRadius: 18, borderWidth: 1, flex: 1, gap: 4, justifyContent: 'center', minHeight: 48 }}>
      <Text style={{ color: active ? theme.terracotta : theme.cream, fontSize: 17 }}>{icon}</Text>
      <Text style={{ color: active ? theme.terracotta : theme.cream, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
