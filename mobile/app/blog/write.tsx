import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { HaatText as Text, styles } from '@/components/haat-ui';
import { theme, typography } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { loadBlogDrafts, removeBlogDraft, saveBlogDraft, saveBlogSubmission, type BlogDraft } from '@/lib/blog-storage';
import { useSessionStore } from '@/store/session';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const maxImageBytes = 8 * 1024 * 1024;

type CoverFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

function imageMimeType(file: DocumentPickerAsset) {
  if (file.mimeType && imageTypes.includes(file.mimeType)) return file.mimeType;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return '';
}

export default function WriteBlogScreen() {
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const user = useSessionStore((state) => state.user);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [cover, setCover] = useState<CoverFile | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!draftId) return () => { active = false; };
    loadBlogDrafts()
      .then((drafts) => {
        const draft = drafts.find((item) => item.id === draftId);
        if (!active) return;
        if (!draft) {
          setErrorMessage('This saved draft could not be found on this device.');
          return;
        }
        applyDraft(draft);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(getApiErrorMessage(error));
      });
    return () => { active = false; };
  }, [draftId]);

  useEffect(() => {
    if (!user) return;
    setAuthor((value) => value || user.fullName);
    setEmail((value) => value || user.email);
  }, [user]);

  function applyDraft(draft: BlogDraft) {
    setTitle(draft.title);
    setAuthor(draft.author);
    setEmail(draft.email);
    setExcerpt(draft.excerpt);
    setBody(draft.body);
    setActiveDraftId(draft.id);
    setCover(draft.coverUri && draft.coverName && draft.coverMimeType
      ? { uri: draft.coverUri, name: draft.coverName, mimeType: draft.coverMimeType, size: draft.coverSize ?? undefined }
      : null);
  }

  async function chooseCover() {
    setNotice('');
    setErrorMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: imageTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = imageMimeType(asset);
      if (!mimeType) {
        setErrorMessage('Choose a JPG, PNG, WebP or GIF image.');
        return;
      }
      if (asset.size !== undefined && asset.size > maxImageBytes) {
        setErrorMessage('The cover image must be 8 MB or smaller.');
        return;
      }
      setCover({ uri: asset.uri, name: asset.name, mimeType, size: asset.size });
    } catch (error) {
      setErrorMessage(`The image could not be selected: ${getApiErrorMessage(error)}`);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      const id = activeDraftId ?? `draft-${Date.now()}`;
      const draft: BlogDraft = {
        id,
        title: title.trim(),
        author: author.trim(),
        email: email.trim(),
        excerpt: excerpt.trim(),
        body: body.trim(),
        coverUri: cover?.uri ?? null,
        coverName: cover?.name ?? null,
        coverMimeType: cover?.mimeType ?? null,
        coverSize: cover?.size ?? null,
        updatedAt: new Date().toISOString(),
      };
      await saveBlogDraft(draft);
      setActiveDraftId(id);
      setNotice('Draft saved on this device.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      if (title.trim().length < 1 || title.trim().length > 200) throw new Error('Enter a title of up to 200 characters.');
      if (author.trim().length < 1 || author.trim().length > 120) throw new Error('Enter your name (up to 120 characters).');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.trim().length > 255) throw new Error('Enter a valid email address for review updates.');
      if (excerpt.trim().length > 400) throw new Error('Keep the introduction under 400 characters.');
      if (body.trim().length < 1 || body.trim().length > 20000) throw new Error('Add your story (up to 20,000 characters).');

      const { data } = await api.post<{ id: string; status: 'PENDING'; uploadToken: string }>('/content/blog/submissions', {
        title: title.trim(),
        excerpt: excerpt.trim(),
        body: body.trim(),
        author: author.trim(),
        email: email.trim().toLowerCase(),
      });

      const warnings: string[] = [];
      try {
        await saveBlogSubmission({
          id: data.id,
          title: title.trim(),
          author: author.trim(),
          submittedAt: new Date().toISOString(),
        });
      } catch (error) {
        warnings.push(`The submission is saved by the website, but My Blogs could not store its reference: ${getApiErrorMessage(error)}`);
      }

      if (cover) {
        try {
          const fileResponse = await fetch(cover.uri);
          const file = await fileResponse.blob();
          if (file.size === 0) throw new Error('The selected image could not be read.');
          if (file.size > maxImageBytes) throw new Error('The cover image must be 8 MB or smaller.');
          await api.post(`/content/blog/submissions/${encodeURIComponent(data.id)}/media`, file, {
            headers: { 'Content-Type': cover.mimeType, 'X-Upload-Token': data.uploadToken },
          });
        } catch (error) {
          warnings.push(`The story was submitted, but its cover image could not be uploaded: ${getApiErrorMessage(error)}`);
        }
      }

      if (activeDraftId) {
        try {
          await removeBlogDraft(activeDraftId);
        } catch (error) {
          warnings.push(`The story was submitted, but its local draft could not be removed: ${getApiErrorMessage(error)}`);
        }
      }

      setNotice(`Submitted for admin review. It will appear on the public blog only after approval. Reference: ${data.id}${warnings.length ? `\n${warnings.join('\n')}` : ''}`);
      setTitle('');
      setAuthor(user?.fullName ?? '');
      setEmail(user?.email ?? '');
      setExcerpt('');
      setBody('');
      setCover(null);
      setActiveDraftId(null);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: 14, paddingBottom: 26 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 5 }}>
          <Text style={{ color: theme.cream, fontFamily: typography.display, fontSize: 30, lineHeight: 34 }}>Write a Blog</Text>
          <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Share your ideas, experiences or insights with The Haat of Art community.</Text>
        </View>

        <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, gap: 12, padding: 14 }}>
          <Field label="Title *" value={title} onChangeText={setTitle} maxLength={200} placeholder="Enter a compelling title" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>Category</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: theme.surfaceRaised, borderColor: theme.champagne, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
              <Text style={{ color: theme.champagne, fontSize: 11, fontWeight: '700' }}>Stories</Text>
            </View>
            <Text style={{ color: theme.subtle, fontSize: 10, lineHeight: 15 }}>The website currently publishes all approved submissions in Stories.</Text>
          </View>
          <Field label="Your name *" value={author} onChangeText={setAuthor} maxLength={120} placeholder="Name shown with your story" />
          <Field label="Email for review updates *" value={email} onChangeText={setEmail} maxLength={255} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Short introduction" value={excerpt} onChangeText={setExcerpt} maxLength={400} placeholder="A short summary for the story card" multiline />

          <View style={{ gap: 7 }}>
            <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>Cover image</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void chooseCover()}
              style={{ alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 102, overflow: 'hidden' }}>
              {cover ? (
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 11, padding: 10, width: '100%' }}>
                  <Image source={{ uri: cover.uri }} contentFit="cover" accessibilityLabel={cover.name} style={{ borderRadius: 9, height: 74, width: 92 }} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text numberOfLines={2} style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>{cover.name}</Text>
                    <Text style={{ color: theme.champagne, fontSize: 10 }}>Tap to change cover</Text>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 5 }}>
                  <Text style={{ color: theme.champagne, fontSize: 22 }}>▧</Text>
                  <Text style={{ color: theme.cream, fontSize: 11 }}>Tap to upload cover image</Text>
                  <Text style={{ color: theme.subtle, fontSize: 9 }}>JPG, PNG, WebP or GIF · Max 8 MB</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Field label="Content *" value={body} onChangeText={setBody} maxLength={20000} placeholder="Write your blog here..." multiline minHeight={190} />
          <Text style={{ color: theme.subtle, fontSize: 10, lineHeight: 15 }}>Your story goes to the existing website review queue. Admin approval is required before it becomes public.</Text>
        </View>

        {notice ? <Text accessibilityRole="status" style={{ color: theme.success, fontSize: 11, lineHeight: 17 }}>{notice}</Text> : null}
        {errorMessage ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 11, lineHeight: 17 }}>{errorMessage}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveDraft()} style={{ alignItems: 'center', borderColor: theme.champagne, borderRadius: 24, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46, opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>Save as Draft</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitForReview()} style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 24, flex: 1, justifyContent: 'center', minHeight: 46, opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{busy ? 'Please wait…' : 'Submit for Review  →'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline = false,
  minHeight,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  minHeight?: number;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.cream, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.subtle}
        style={{
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          borderRadius: 11,
          borderWidth: 1,
          color: theme.cream,
          fontFamily: typography.sans,
          fontSize: 12,
          minHeight: minHeight ?? (multiline ? 78 : 42),
          paddingHorizontal: 11,
          paddingVertical: 10,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        value={value}
      />
      {label === 'Content *' ? <Text style={{ color: theme.subtle, fontSize: 9, textAlign: 'right' }}>{value.length}/{maxLength}</Text> : null}
    </View>
  );
}
