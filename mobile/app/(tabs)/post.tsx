import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';
import { useSessionStore } from '@/store/session';

type ArtistPortfolio = {
  profile: null | {
    displayName: string;
    headline: string;
    city: string;
    artStyle: string;
    bio: string;
    photoUrl: string | null;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  artworks: {
    id: string;
    title: string;
    medium: string;
    dimensions: string;
    year: number | null;
    price: number | null;
    description: string;
    imageUrl: string | null;
    createdAt: string;
  }[];
};

type UploadedImage = { assetId: string; url: string };
type UploadedImageResponse = UploadedImage;
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function PostScreen() {
  const user = useSessionStore((state) => state.user);
  const isReady = useSessionStore((state) => state.isReady);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [city, setCity] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [title, setTitle] = useState('');
  const [medium, setMedium] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [year, setYear] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useRefreshOnFocus('post');

  useEffect(() => {
    setDisplayName((current) => current || user?.fullName || '');
  }, [user?.fullName]);

  const portfolio = useQuery({
    queryKey: ['artist-profile', 'me', user?.id],
    queryFn: async () => (await api.get<ArtistPortfolio>('/artist-profile/me')).data,
    enabled: Boolean(user),
  });

  const saveProfile = useMutation({
    mutationFn: async () => (await api.put<ArtistPortfolio>('/artist-profile/me', {
      displayName: displayName.trim(),
      headline: headline.trim(),
      city: city.trim(),
      state: '',
      phone: '',
      artStyle: artStyle.trim(),
      bio: bio.trim(),
      websiteUrl: '',
      instagramUrl: '',
      facebookUrl: '',
    })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['artist-profile', 'me', user?.id], data);
      setMessage('Artist profile saved. Add your first artwork below.');
      setError('');
    },
    onError: (requestError) => setError(getApiErrorMessage(requestError)),
  });

  async function chooseImage() {
    setError('');
    setMessage('');
    try {
      let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permission.granted) permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library permission is needed to choose an artwork image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) {
        setError('No image was selected. Please try again.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
        setError('Choose an image smaller than 8 MB.');
        return;
      }
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const extensionType = extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'gif'
              ? 'image/gif'
              : null;
      const mimeType = asset.mimeType?.toLowerCase() || asset.file?.type || extensionType;
      if (!mimeType || !allowedImageTypes.includes(mimeType)) {
        setError('Choose a JPG, PNG, WebP or GIF image.');
        return;
      }
      setUploadedImage(null);
      setSelectedImage(asset);
    } catch (pickerError) {
      setError(getApiErrorMessage(pickerError));
    }
  }

  const uploadImage = useMutation({
    mutationFn: async () => {
      if (!selectedImage) throw new Error('Choose an artwork image first.');
      const extension = selectedImage.fileName?.split('.').pop()?.toLowerCase();
      const extensionType = extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'gif'
              ? 'image/gif'
              : null;
      const mimeType = selectedImage.mimeType?.toLowerCase() || selectedImage.file?.type || extensionType;
      if (!mimeType || !allowedImageTypes.includes(mimeType)) throw new Error('Choose a JPG, PNG, WebP or GIF image.');
      let body: Blob;
      if (selectedImage.file) {
        body = selectedImage.file;
      } else {
        const response = await fetch(selectedImage.uri);
        if (!response.ok) throw new Error('The selected artwork image could not be read.');
        body = await response.blob();
      }
      return (await api.post<UploadedImageResponse>('/artist-profile/me/artworks/image', body, {
        headers: { 'Content-Type': mimeType },
      })).data;
    },
    onSuccess: (data) => {
      setUploadedImage(data);
      setError('');
      setMessage('Artwork image uploaded. Add the details and publish it to your portfolio.');
    },
    onError: (requestError) => setError(getApiErrorMessage(requestError)),
  });

  const publishArtwork = useMutation({
    mutationFn: async () => {
      if (!uploadedImage) throw new Error('Upload the artwork image before publishing.');
      if (!title.trim()) throw new Error('Enter an artwork title.');
      const parsedYear = year.trim() ? Number(year) : null;
      const parsedPrice = price.trim() ? Number(price) : null;
      if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100)) {
        throw new Error('Enter a valid artwork year.');
      }
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        throw new Error('Enter a valid artwork price.');
      }
      return (await api.post<ArtistPortfolio>('/artist-profile/me/artworks', {
        title: title.trim(),
        medium: medium.trim(),
        dimensions: dimensions.trim(),
        year: parsedYear,
        price: parsedPrice,
        description: description.trim(),
        imageAssetId: uploadedImage.assetId,
      })).data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['artist-profile', 'me', user?.id], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home', 'artists'] }),
        queryClient.invalidateQueries({ queryKey: ['artists'] }),
        queryClient.invalidateQueries({ queryKey: ['gallery'] }),
      ]);
      setSelectedImage(null);
      setUploadedImage(null);
      setTitle('');
      setMedium('');
      setDimensions('');
      setYear('');
      setPrice('');
      setDescription('');
      setError('');
      setMessage('Your artwork was added to your portfolio.');
    },
    onError: (requestError) => setError(getApiErrorMessage(requestError)),
  });

  const profile = portfolio.data?.profile;

  return (
    <SafeAreaView style={styles.page} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PageHeading eyebrow="Artist portfolio" title="Post your artwork" description="Share an artwork through your Haat of Art artist portfolio." />

          {!isReady ? (
            <MessageState title="Checking your account" description="Restoring your secure mobile session." loading />
          ) : !user ? (
            <View style={[styles.surface, { gap: 12 }]}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>Sign in to post</Text>
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>Browse the app without an account. Sign in with your existing Haat account when you are ready to publish artwork.</Text>
              <Link href="/login" asChild>
                <Pressable accessibilityRole="button" style={{ alignSelf: 'flex-start', backgroundColor: theme.terracotta, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          ) : portfolio.isPending ? (
            <MessageState title="Loading your artist profile" description="Checking your existing Haat portfolio." loading />
          ) : portfolio.isError ? (
            <MessageState title="Your portfolio could not load" description={getApiErrorMessage(portfolio.error)} action={<HaatButton label="Retry" onPress={() => void portfolio.refetch()} />} />
          ) : !profile ? (
            <View style={{ gap: 12 }}>
              <View style={[styles.surface, { gap: 6 }]}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 19 }}>Create your artist profile</Text>
                <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Your profile and submitted artworks are stored in the existing Haat database. New profiles may need admin approval before appearing publicly.</Text>
              </View>
              <TextInput autoCapitalize="words" onChangeText={setDisplayName} placeholder="Artist name" placeholderTextColor={theme.subtle} style={styles.field} value={displayName} />
              <TextInput onChangeText={setCity} placeholder="City" placeholderTextColor={theme.subtle} style={styles.field} value={city} />
              <TextInput onChangeText={setArtStyle} placeholder="Art form or medium" placeholderTextColor={theme.subtle} style={styles.field} value={artStyle} />
              <TextInput onChangeText={setHeadline} placeholder="Short artist headline" placeholderTextColor={theme.subtle} style={styles.field} value={headline} />
              <TextInput multiline onChangeText={setBio} placeholder="Artist biography" placeholderTextColor={theme.subtle} style={[styles.field, { minHeight: 94, textAlignVertical: 'top' }]} value={bio} />
              <HaatButton label={saveProfile.isPending ? 'Saving profile…' : 'Save artist profile'} onPress={() => saveProfile.mutate()} disabled={saveProfile.isPending || displayName.trim().length < 2} />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={[styles.surface, { gap: 5 }]}>
                <Text style={styles.eyebrow}>YOUR PORTFOLIO</Text>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 19 }}>{profile.displayName}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{[profile.artStyle, profile.city].filter(Boolean).join(' · ')}</Text>
                {profile.status && profile.status !== 'APPROVED' ? (
                  <Text style={{ color: theme.terracotta, fontSize: 12 }}>Profile status: {profile.status.toLowerCase()}. Your work becomes public after approval.</Text>
                ) : null}
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>New artwork</Text>
                {selectedImage ? (
                  <Image source={{ uri: selectedImage.uri }} contentFit="cover" accessibilityLabel="Selected artwork preview" style={{ backgroundColor: theme.surfaceRaised, borderRadius: 14, height: 190, width: '100%' }} />
                ) : null}
                <HaatButton label={selectedImage ? 'Choose a different image' : 'Choose artwork photo'} onPress={() => void chooseImage()} variant="secondary" />
                {selectedImage && !uploadedImage ? (
                  <HaatButton label={uploadImage.isPending ? 'Uploading image…' : 'Upload image'} onPress={() => uploadImage.mutate()} disabled={uploadImage.isPending} />
                ) : null}
                {uploadedImage ? (
                  <Text style={{ color: theme.success, fontSize: 12 }}>Image uploaded and linked to your portfolio.</Text>
                ) : null}
                <TextInput onChangeText={setTitle} placeholder="Artwork title" placeholderTextColor={theme.subtle} style={styles.field} value={title} />
                <TextInput onChangeText={setMedium} placeholder="Medium (optional)" placeholderTextColor={theme.subtle} style={styles.field} value={medium} />
                <View style={{ flexDirection: 'row', gap: 9 }}>
                  <TextInput keyboardType="numbers-and-punctuation" onChangeText={setDimensions} placeholder="Dimensions" placeholderTextColor={theme.subtle} style={[styles.field, { flex: 1 }]} value={dimensions} />
                  <TextInput keyboardType="number-pad" onChangeText={setYear} placeholder="Year" placeholderTextColor={theme.subtle} style={[styles.field, { width: 96 }]} value={year} />
                </View>
                <TextInput keyboardType="decimal-pad" onChangeText={setPrice} placeholder="Price in INR (optional)" placeholderTextColor={theme.subtle} style={styles.field} value={price} />
                <TextInput multiline onChangeText={setDescription} placeholder="About this artwork (optional)" placeholderTextColor={theme.subtle} style={[styles.field, { minHeight: 88, textAlignVertical: 'top' }]} value={description} />
                <HaatButton label={publishArtwork.isPending ? 'Publishing…' : 'Publish artwork'} onPress={() => publishArtwork.mutate()} disabled={publishArtwork.isPending || !uploadedImage} />
              </View>

              {portfolio.data.artworks.length ? (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>Your published works</Text>
                  {portfolio.data.artworks.map((work) => (
                    <View key={work.id} style={[styles.surface, { flexDirection: 'row', gap: 11, padding: 10 }]}>
                      {work.imageUrl ? (
                        <Image source={{ uri: resolveMediaUrl(work.imageUrl) ?? undefined }} contentFit="cover" accessibilityLabel={work.title} style={{ backgroundColor: theme.surfaceRaised, borderRadius: 10, height: 76, width: 76 }} />
                      ) : null}
                      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
                        <Text numberOfLines={1} style={{ color: theme.cream, fontWeight: '700' }}>{work.title}</Text>
                        <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 11 }}>{[work.medium, work.year].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {message ? <Text style={{ color: theme.success, fontSize: 12 }}>{message}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
