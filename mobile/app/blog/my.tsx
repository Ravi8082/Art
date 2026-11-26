import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlogPill, BlogStoryCard } from '@/components/blog-ui';
import { HaatText as Text, MessageState, styles } from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { api, getApiErrorMessage, type BlogSummary } from '@/lib/api';
import {
  formatBlogDate,
  loadBlogDrafts,
  loadBlogSubmissions,
  loadSavedBlogIds,
  removeBlogDraft,
  removeBlogSubmission,
  toggleSavedBlog,
  type BlogDraft,
  type BlogSubmissionRecord,
} from '@/lib/blog-storage';

type BlogSection = 'posts' | 'drafts' | 'saved';

export default function MyBlogsScreen() {
  const router = useRouter();
  const [section, setSection] = useState<BlogSection>('posts');
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [submissions, setSubmissions] = useState<BlogSubmissionRecord[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [storageError, setStorageError] = useState('');
  const postsQuery = useQuery({
    queryKey: ['blog', 'published'],
    queryFn: async () => (await api.get<{ posts: BlogSummary[] }>('/content/blog')).data.posts,
  });

  const reloadLocalData = useCallback(async () => {
    try {
      const [nextDrafts, nextSubmissions, nextSaved] = await Promise.all([
        loadBlogDrafts(),
        loadBlogSubmissions(),
        loadSavedBlogIds(),
      ]);
      setDrafts(nextDrafts);
      setSubmissions(nextSubmissions);
      setSavedIds(nextSaved);
      setStorageError('');
    } catch (error) {
      setStorageError(getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reloadLocalData();
  }, [reloadLocalData]));

  async function deleteDraft(draft: BlogDraft) {
    try {
      await removeBlogDraft(draft.id);
      await reloadLocalData();
    } catch (error) {
      setStorageError(getApiErrorMessage(error));
    }
  }

  function confirmDeleteDraft(draft: BlogDraft) {
    Alert.alert('Delete this draft?', 'This removes the draft stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteDraft(draft) },
    ]);
  }

  async function removeSubmission(submission: BlogSubmissionRecord) {
    try {
      await removeBlogSubmission(submission.id);
      await reloadLocalData();
    } catch (error) {
      setStorageError(getApiErrorMessage(error));
    }
  }

  function confirmRemoveSubmission(submission: BlogSubmissionRecord) {
    Alert.alert('Remove from My Blogs?', 'The story remains on the website; only its local reference is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeSubmission(submission) },
    ]);
  }

  async function unsavePost(id: string) {
    try {
      await toggleSavedBlog(id);
      await reloadLocalData();
    } catch (error) {
      setStorageError(getApiErrorMessage(error));
    }
  }

  const posts = postsQuery.data ?? [];
  const savedPosts = savedIds.map((id) => posts.find((post) => post.id === id)).filter((post): post is BlogSummary => Boolean(post));

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 15, paddingBottom: 24 }]}
        refreshControl={<RefreshControl refreshing={postsQuery.isRefetching} onRefresh={() => void Promise.all([postsQuery.refetch(), reloadLocalData()])} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 5 }}>
          <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 29, lineHeight: 33 }}>My Blogs</Text>
          <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Manage your submissions, drafts and saved stories.</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 7 }}>
          <BlogPill label="My Posts" active={section === 'posts'} onPress={() => setSection('posts')} />
          <BlogPill label="Drafts" active={section === 'drafts'} onPress={() => setSection('drafts')} />
          <BlogPill label="Saved" active={section === 'saved'} onPress={() => setSection('saved')} />
        </View>

        {storageError ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 11, lineHeight: 17 }}>{storageError}</Text> : null}

        {section === 'posts' ? (
          postsQuery.isPending ? (
            <MessageState title="Loading your posts" description="Checking the website for approved stories." loading />
          ) : postsQuery.isError ? (
            <MessageState title="Published stories could not load" description={getApiErrorMessage(postsQuery.error)} />
          ) : submissions.length ? (
            <View style={{ gap: 11 }}>
              {submissions.map((submission) => {
                const publishedPost = posts.find((post) => post.id === submission.id);
                return publishedPost ? (
                  <View key={submission.id} style={{ gap: 6 }}>
                    <BlogStoryCard post={publishedPost} />
                    <Text style={{ color: theme.success, fontSize: 10, fontWeight: '700' }}>PUBLISHED · {formatBlogDate(publishedPost.publishedAt)}</Text>
                  </View>
                ) : (
                  <View key={submission.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, gap: 7, padding: 13 }}>
                    <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 18 }}>{submission.title}</Text>
                    <Text style={{ color: theme.muted, fontSize: 10 }}>{submission.author} · Submitted {formatBlogDate(submission.submittedAt)}</Text>
                    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '700' }}>NOT YET PUBLIC · CHECK EMAIL FOR STATUS</Text>
                      <Pressable accessibilityRole="button" onPress={() => confirmRemoveSubmission(submission)}><Text style={{ color: theme.subtle, fontSize: 10 }}>Remove</Text></Pressable>
                    </View>
                  </View>
                );
              })}
              <Text style={{ color: theme.subtle, fontSize: 10, lineHeight: 15 }}>The existing website API confirms publication when a story becomes public. Review notes and rejections are sent by email.</Text>
            </View>
          ) : (
            <MessageState title="No blog submissions yet" description="Write a story and it will appear here while the website team reviews it." />
          )
        ) : section === 'drafts' ? (
          drafts.length ? (
            <View style={{ gap: 10 }}>
              {drafts.map((draft) => (
                <View key={draft.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 11 }}>
                  {draft.coverUri ? <View><BlogDraftCover uri={draft.coverUri} /></View> : null}
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: './write', params: { draftId: draft.id } })} style={{ flex: 1, gap: 5, justifyContent: 'center' }}>
                    <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: typography.display, fontSize: 17 }}>{draft.title || 'Untitled draft'}</Text>
                    <Text numberOfLines={2} style={{ color: theme.muted, fontSize: 10 }}>{draft.excerpt || draft.body || 'Continue writing your story.'}</Text>
                    <Text style={{ color: theme.champagne, fontSize: 9 }}>Draft · {formatBlogDate(draft.updatedAt)}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Delete draft" onPress={() => confirmDeleteDraft(draft)} style={{ justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: theme.subtle, fontSize: 18 }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <MessageState title="No drafts saved" description="Use Save as Draft while writing. Drafts are stored on this device." />
          )
        ) : postsQuery.isPending ? (
          <MessageState title="Loading saved stories" description="Getting your saved published stories." loading />
        ) : postsQuery.isError ? (
          <MessageState title="Saved stories could not load" description={getApiErrorMessage(postsQuery.error)} />
        ) : savedPosts.length ? (
          <View style={{ gap: 12 }}>
            {savedPosts.map((post) => (
              <View key={post.id} style={{ gap: 6 }}>
                <BlogStoryCard post={post} />
                <Pressable accessibilityRole="button" onPress={() => void unsavePost(post.id)} style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                  <Text style={{ color: theme.champagne, fontSize: 10, fontWeight: '700' }}>Remove from Saved</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <MessageState title="No saved stories yet" description="Save a published article to keep it here on this device." />
        )}

        <Pressable accessibilityRole="link" onPress={() => router.push('/blog/write')} style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 24, justifyContent: 'center', minHeight: 46 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>＋  Write a New Blog</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BlogDraftCover({ uri }: { uri: string }) {
  return (
    <View style={{ backgroundColor: theme.surfaceRaised, borderRadius: 10, height: 82, overflow: 'hidden', width: 82 }}>
      <Image source={{ uri }} contentFit="cover" accessibilityLabel="Saved draft cover" style={{ height: '100%', width: '100%' }} />
    </View>
  );
}
