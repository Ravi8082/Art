import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatText as Text, MessageState, PageHeading, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import {
  api,
  BookingExhibition,
  BookingStall,
  getApiErrorMessage,
  StallType,
} from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';
import { useSessionStore } from '@/store/session';

type BookingProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  websiteUrl: string;
  instagramUrl: string;
};
type ApplicationResult = { id: string; applicationRef: string; status: string };
type PersonalDetails = { firstName: string; lastName: string; phone: string; address: string };
type ArtworkDetails = { artForm: string; fasciaName: string; bio: string; websiteUrl: string; instagramUrl: string };
type UploadedMedia = { assetId: string; byteSize: number; mediaKind: string };
const maxArtworkImageBytes = 8 * 1024 * 1024;
const maxPortfolioBytes = 25 * 1024 * 1024;

const steps = ['Personal Details', 'Artwork Details', 'Preferences', 'Select Stall', 'Review'];

export default function StallApplicationScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const [step, setStep] = useState(0);
  const [selectedState, setSelectedState] = useState('');
  const [stallTypeId, setStallTypeId] = useState('');
  const [stallId, setStallId] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formError, setFormError] = useState('');
  const [personal, setPersonal] = useState<PersonalDetails>({ firstName: '', lastName: '', phone: '', address: '' });
  const [artwork, setArtwork] = useState<ArtworkDetails>({ artForm: '', fasciaName: '', bio: '', websiteUrl: '', instagramUrl: '' });
  const [artworkImages, setArtworkImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [portfolio, setPortfolio] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectionHold, setSelectionHold] = useState<{ id: string; expiresAt: string; holdMinutes: number } | null>(null);
  const [holdingStallId, setHoldingStallId] = useState('');

  useRefreshOnFocus('bookings');
  const exhibitionsQuery = useQuery({
    queryKey: ['bookings', 'exhibitions'],
    queryFn: async () => (await api.get<BookingExhibition[]>('/bookings/exhibitions')).data,
  });
  const exhibition = exhibitionsQuery.data?.find((item) => item.id === eventId);
  const eventStates = useMemo(
    () => (exhibition?.state ?? '').split(/[,;/]/).map((value) => value.trim()).filter(Boolean),
    [exhibition?.state],
  );
  const profileQuery = useQuery({
    queryKey: ['bookings', 'profile', user?.id],
    queryFn: async () => (await api.get<BookingProfile>('/bookings/profile')).data,
    enabled: Boolean(user),
    retry: false,
  });
  const stallTypesQuery = useQuery({
    queryKey: ['bookings', 'stall-types', eventId, selectedState],
    queryFn: async () => (await api.get<StallType[]>(`/bookings/events/${encodeURIComponent(eventId)}/stall-types`, {
      params: selectedState ? { state: selectedState } : undefined,
    })).data,
    enabled: Boolean(eventId && exhibition && (eventStates.length === 0 || selectedState)),
  });
  const stallsQuery = useQuery({
    queryKey: ['bookings', 'stalls', eventId, selectedState],
    queryFn: async () => (await api.get<BookingStall[]>(`/bookings/events/${encodeURIComponent(eventId)}/stalls`, {
      params: selectedState ? { state: selectedState } : undefined,
    })).data,
    enabled: Boolean(eventId && exhibition && (eventStates.length === 0 || selectedState)),
  });
  const stallTypes = stallTypesQuery.data ?? [];
  const stalls = stallsQuery.data ?? [];
  const selectedType = stallTypes.find((type) => type.id === stallTypeId);
  const selectedStall = stalls.find((stall) => stall.id === stallId);
  const matchingStalls = stalls.filter((stall) => stall.type.id === stallTypeId);
  const availableStalls = matchingStalls.filter((stall) => stall.status === 'AVAILABLE');
  const visibleStalls = matchingStalls.filter((stall) => stall.status === 'AVAILABLE' || stall.id === stallId);
  const refreshing = exhibitionsQuery.isRefetching || stallTypesQuery.isRefetching || stallsQuery.isRefetching;

  useEffect(() => {
    if (eventStates.length && !eventStates.includes(selectedState)) {
      setSelectedState(eventStates[0]);
    }
  }, [eventStates, selectedState]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setPersonal({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      address: profile.address || '',
    });
    setArtwork((current) => ({
      ...current,
      websiteUrl: profile.websiteUrl || '',
      instagramUrl: profile.instagramUrl || '',
    }));
  }, [profileQuery.data]);

  useEffect(() => {
    setStallTypeId('');
    setStallId('');
    setSelectionHold(null);
  }, [eventId, selectedState]);

  async function pickArtworkImages() {
    setFormError('');
    const remaining = 10 - artworkImages.length;
    if (remaining <= 0) {
      setFormError('You can attach up to 10 artwork images.');
      return;
    }
    try {
      let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permission.granted) permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError('Photo library permission is needed to choose artwork images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const accepted: ImagePicker.ImagePickerAsset[] = [];
      for (const asset of result.assets) {
        const mimeType = imageMimeType(asset);
        if (!mimeType) {
          setFormError('Choose JPG, PNG, WebP or GIF artwork images.');
          continue;
        }
        if (asset.fileSize && asset.fileSize > maxArtworkImageBytes) {
          setFormError('Each artwork image must be 8 MB or smaller.');
          continue;
        }
        accepted.push(asset);
      }
      setArtworkImages((current) => [...current, ...accepted].slice(0, 10));
    } catch (error) {
      setFormError(`Artwork images could not be selected: ${getApiErrorMessage(error)}`);
    }
  }

  async function pickPortfolio() {
    setFormError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.mimeType !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setFormError('Choose a PDF portfolio.');
        return;
      }
      if (file.size !== undefined && file.size > maxPortfolioBytes) {
        setFormError('The portfolio PDF must be 25 MB or smaller.');
        return;
      }
      setPortfolio(file);
    } catch (error) {
      setFormError(`The portfolio could not be selected: ${getApiErrorMessage(error)}`);
    }
  }

  async function selectStall(stallIdToHold: string) {
    if (!user) {
      setFormError('Sign in and verify your email to lock a stall for 10 minutes.');
      router.push({ pathname: '/login', params: { mode: 'exhibitor' } });
      return;
    }
    setFormError('');
    setHoldingStallId(stallIdToHold);
    try {
      const { data } = await api.post<{ id: string; expiresAt: string; holdMinutes: number }>(
        `/bookings/events/${encodeURIComponent(eventId)}/stalls/${encodeURIComponent(stallIdToHold)}/hold`,
      );
      setStallId(stallIdToHold);
      setSelectionHold(data);
      await stallsQuery.refetch();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
      await stallsQuery.refetch();
    } finally {
      setHoldingStallId('');
    }
  }

  async function releaseSelectionHold() {
    if (!selectionHold || !stallId) return;
    await api.delete(`/bookings/events/${encodeURIComponent(eventId)}/stalls/${encodeURIComponent(stallId)}/hold`);
    setSelectionHold(null);
    setStallId('');
  }

  const submission = useMutation({
    mutationFn: async () => {
      if (!exhibition || !selectedType) throw new Error('Choose an exhibition and stall type before submitting.');
      const artworkAssetIds: string[] = [];
      for (const image of artworkImages) {
        const mimeType = imageMimeType(image);
        if (!mimeType) throw new Error('One of the selected artwork images has an unsupported file type.');
        const body = await readLocalFile(image.uri, image.file);
        const { data } = await api.post<UploadedMedia>('/bookings/media', body, {
          headers: { 'Content-Type': mimeType, 'X-Media-Kind': 'artwork', 'X-Alt-Text': image.fileName ?? 'Exhibitor artwork' },
        });
        artworkAssetIds.push(data.assetId);
      }
      let portfolioAssetId: string | null = null;
      if (portfolio) {
        const body = await readLocalFile(portfolio.uri);
        const { data } = await api.post<UploadedMedia>('/bookings/media', body, {
          headers: { 'Content-Type': 'application/pdf', 'X-Media-Kind': 'portfolio', 'X-Alt-Text': portfolio.name },
        });
        portfolioAssetId = data.assetId;
      }
      const hold = stallId
        ? (await api.post<{ id: string; expiresAt: string; holdMinutes: number }>(
          `/bookings/events/${encodeURIComponent(eventId)}/stalls/${encodeURIComponent(stallId)}/hold`,
        )).data
        : null;
      if (hold) setSelectionHold(hold);
      const payload = {
        eventId: exhibition.id,
        firstName: personal.firstName.trim(),
        lastName: personal.lastName.trim(),
        phone: personal.phone.trim(),
        address: personal.address.trim(),
        websiteUrl: normalizeUrl(artwork.websiteUrl),
        instagramUrl: normalizeUrl(artwork.instagramUrl),
        artForm: artwork.artForm.trim(),
        fasciaName: artwork.fasciaName.trim(),
        bio: artwork.bio.trim(),
        spaceCategory: selectedType.category,
        preferredStallTypeId: selectedType.id,
        requestedStallId: stallId || null,
        stallHoldId: hold?.id ?? null,
        approxSizeSqm: Number(selectedType.widthM) * Number(selectedType.depthM),
        specialRequirements: '',
        artworkAssetIds,
        portfolioAssetId,
        agreeTerms: true,
      };
      return (await api.post<ApplicationResult>('/bookings/applications', payload)).data;
    },
    onSuccess: async () => {
      setSelectionHold(null);
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  function validateStep(target: number) {
    if (target > 0) {
      if (personal.firstName.trim().length < 2) return 'Enter your first name.';
      if (!/^[0-9+()\s-]{6,30}$/.test(personal.phone.trim())) return 'Enter a valid phone number.';
      if (personal.address.trim().length < 6) return 'Enter your complete address.';
    }
    if (target > 1) {
      if (artwork.artForm.trim().length < 2) return 'Enter your art form.';
      if (artwork.bio.trim().length < 20) return 'Describe your artwork in at least 20 characters.';
      if (artwork.websiteUrl && !isUrl(artwork.websiteUrl)) return 'Enter a full website URL beginning with https://.';
      if (artwork.instagramUrl && !isUrl(artwork.instagramUrl)) return 'Enter a full Instagram profile URL.';
    }
    if (target > 2 && !selectedType) return 'Choose a stall type from the live exhibition tariff.';
    if (target > 3 && availableStalls.length > 0 && !stallId) return 'Choose an available stall or go back to select another type.';
    if (target > 4 && !agreeTerms) return 'Accept the exhibitor terms to submit the application.';
    return '';
  }

  function goTo(target: number) {
    setFormError('');
    if (target > step) {
      const validation = validateStep(target);
      if (validation) {
        setFormError(validation);
        return;
      }
    }
    if (target < step && step === 3 && selectionHold) {
      void (async () => {
        try {
          await releaseSelectionHold();
          setStep(target);
        } catch (error) {
          setFormError(`The temporary stall lock could not be released: ${getApiErrorMessage(error)}`);
        }
      })();
      return;
    }
    setStep(target);
  }

  function submitApplication() {
    setFormError('');
    const validation = validateStep(5);
    if (validation) {
      setFormError(validation);
      return;
    }
    if (!user) {
      router.push({ pathname: '/login', params: { mode: 'exhibitor' } });
      return;
    }
    submission.mutate();
  }

  if (exhibitionsQuery.isPending) {
    return <SafeAreaView style={styles.page}><View style={styles.content}><MessageState title="Loading exhibition" description="Getting current edition and stall information." loading /></View></SafeAreaView>;
  }
  if (exhibitionsQuery.isError) {
    return <SafeAreaView style={styles.page}><View style={styles.content}><MessageState title="Exhibition could not load" description={getApiErrorMessage(exhibitionsQuery.error)} /></View></SafeAreaView>;
  }
  if (!exhibition) {
    return <SafeAreaView style={styles.page}><View style={styles.content}><MessageState title="Exhibition not found" description="Choose a current edition from the exhibition list." action={<Pressable onPress={() => router.replace('/book-stall')}><Text style={{ color: theme.terracotta, fontWeight: '700' }}>Choose an exhibition</Text></Pressable>} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.content, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([exhibitionsQuery.refetch(), stallTypesQuery.refetch(), stallsQuery.refetch()])} tintColor={theme.terracotta} />}
          showsVerticalScrollIndicator={false}>
          <View style={{ gap: 5 }}>
            <Text style={styles.eyebrow}>{exhibition.title}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>{formatDateRange(exhibition.startsAt, exhibition.endsAt)} · {exhibition.venue}</Text>
            <Pressable onPress={() => router.replace('/book-stall')} style={{ alignSelf: 'flex-start', marginTop: 3 }}>
              <Text style={{ color: theme.terracotta, fontSize: 11, fontWeight: '700' }}>Change exhibition</Text>
            </Pressable>
          </View>

          {submission.data ? (
            <View style={[styles.surface, { gap: 12 }]}>
              <Text style={styles.eyebrow}>APPLICATION RECEIVED</Text>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 24 }}>Thank you for applying.</Text>
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>
                Reference: {submission.data.applicationRef} · Status: {submission.data.status}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
                The application is saved with the existing Haat of Art booking system.
              </Text>
              <Pressable onPress={() => router.replace('/(tabs)/account')} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                <Text style={{ color: theme.terracotta, fontWeight: '700' }}>View My Haat</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {steps.map((label, index) => {
                  const active = step === index;
                  const done = step > index;
                  return (
                    <Pressable key={label} onPress={() => index < step && setStep(index)} style={{ alignItems: 'center', flex: 1, gap: 5 }}>
                      <View style={{ alignItems: 'center', backgroundColor: active || done ? theme.terracotta : theme.surfaceRaised, borderRadius: 16, height: 28, justifyContent: 'center', width: 28 }}>
                        <Text style={{ color: active || done ? '#FFFFFF' : theme.muted, fontSize: 11, fontWeight: '800' }}>{index + 1}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: active ? theme.terracotta : theme.muted, fontSize: 8, textAlign: 'center' }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <PageHeading eyebrow={`STEP ${step + 1} OF 5`} title={steps[step]} />

              {step === 0 ? (
                <>
                  {profileQuery.isError ? <Text style={styles.errorText}>Saved exhibitor details could not load: {getApiErrorMessage(profileQuery.error)}</Text> : null}
                  <Field label="First name" value={personal.firstName} onChangeText={(value) => setPersonal({ ...personal, firstName: value })} autoComplete="given-name" />
                  <Field label="Last name" value={personal.lastName} onChangeText={(value) => setPersonal({ ...personal, lastName: value })} autoComplete="family-name" />
                  <Field label="Phone number" value={personal.phone} onChangeText={(value) => setPersonal({ ...personal, phone: value })} keyboardType="phone-pad" />
                  <Field label="Address" value={personal.address} onChangeText={(value) => setPersonal({ ...personal, address: value })} multiline />
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Field label="Art form" value={artwork.artForm} onChangeText={(value) => setArtwork({ ...artwork, artForm: value })} placeholder="Painting, sculpture, photography..." />
                  <Field label="Name for fascia" value={artwork.fasciaName} onChangeText={(value) => setArtwork({ ...artwork, fasciaName: value })} />
                  <Field label="Artwork bio / practice description" value={artwork.bio} onChangeText={(value) => setArtwork({ ...artwork, bio: value })} multiline />
                  <Field label="Website (optional)" value={artwork.websiteUrl} onChangeText={(value) => setArtwork({ ...artwork, websiteUrl: value })} keyboardType="url" />
                  <Field label="Instagram profile (optional)" value={artwork.instagramUrl} onChangeText={(value) => setArtwork({ ...artwork, instagramUrl: value })} keyboardType="url" />
                  <View style={[styles.surface, { gap: 10 }]}>
                    <Text style={styles.label}>Artwork images ({artworkImages.length}/10)</Text>
                    <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>Add images for the admin review. Each image is uploaded securely to your application.</Text>
                    {artworkImages.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {artworkImages.map((image, index) => (
                          <View key={`${image.uri}-${index}`} style={{ height: 74, position: 'relative', width: 74 }}>
                            <Image contentFit="cover" source={{ uri: image.uri }} style={{ borderRadius: 10, height: 74, width: 74 }} />
                            <Pressable
                              accessibilityLabel={`Remove artwork image ${index + 1}`}
                              onPress={() => setArtworkImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              style={{ alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 3, top: 3, width: 24 }}>
                              <Text style={{ color: theme.cream, fontSize: 13, fontWeight: '800' }}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Pressable onPress={() => void pickArtworkImages()} style={{ alignItems: 'center', borderColor: theme.border, borderRadius: 12, borderWidth: 1, minHeight: 42, justifyContent: 'center' }}>
                      <Text style={{ color: theme.terracottaLight, fontSize: 12, fontWeight: '700' }}>Choose artwork images</Text>
                    </Pressable>
                    <Pressable onPress={() => void pickPortfolio()} style={{ alignItems: 'flex-start', paddingVertical: 5 }}>
                      <Text style={{ color: theme.terracottaLight, fontSize: 12, fontWeight: '700' }}>{portfolio ? 'Replace portfolio PDF' : 'Add a portfolio PDF (optional)'}</Text>
                    </Pressable>
                      {portfolio ? (
                        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text numberOfLines={1} style={{ color: theme.muted, flex: 1, fontSize: 11 }}>{portfolio.name}</Text>
                          <Pressable onPress={() => setPortfolio(null)}><Text style={{ color: theme.terracottaLight, fontSize: 11 }}>Remove</Text></Pressable>
                        </View>
                      ) : null}
                  </View>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  {eventStates.length > 1 ? (
                    <View style={{ gap: 9 }}>
                      <Text style={styles.label}>Edition state</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {eventStates.map((state) => (
                          <ChoiceChip key={state} label={state} selected={selectedState === state} onPress={() => setSelectedState(state)} />
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <Text style={styles.label}>Select a live stall tariff</Text>
                  {stallTypesQuery.isPending ? (
                    <MessageState title="Loading stall options" description="Getting current prices and stall dimensions." loading />
                  ) : stallTypesQuery.isError ? (
                    <MessageState title="Stall options could not load" description={getApiErrorMessage(stallTypesQuery.error)} />
                  ) : stallTypes.length ? (
                    stallTypes.map((type) => {
                      const selected = stallTypeId === type.id;
                      return (
                        <Pressable
                          key={type.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => {
                            void (async () => {
                              try {
                                await releaseSelectionHold();
                                setStallTypeId(type.id);
                              } catch (error) {
                                setFormError(`The temporary stall lock could not be released: ${getApiErrorMessage(error)}`);
                              }
                            })();
                          }}
                          style={{
                            backgroundColor: selected ? theme.surfaceRaised : theme.surface,
                            borderColor: selected ? theme.terracotta : theme.border,
                            borderRadius: 14,
                            borderWidth: selected ? 2 : 1,
                            gap: 5,
                            padding: 13,
                          }}>
                          <Text style={{ color: theme.cream, fontSize: 14, fontWeight: '800' }}>{type.name}</Text>
                          <Text style={{ color: theme.muted, fontSize: 11 }}>
                            {type.category} · {type.widthM}m × {type.depthM}m · ₹{Number(type.price).toLocaleString('en-IN')} + {type.taxRate}% GST
                          </Text>
                          {type.includes ? <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>{type.includes}</Text> : null}
                        </Pressable>
                      );
                    })
                  ) : (
                    <MessageState title="No public stall tariffs" description="This edition has no public stall options for the selected state." />
                  )}
                  {stallTypesQuery.isError ? <Pressable onPress={() => void stallTypesQuery.refetch()}><Text style={{ color: theme.terracotta, fontWeight: '700' }}>Retry loading stall options</Text></Pressable> : null}
                </>
              ) : null}

              {step === 3 ? (
                <>
                  {eventStates.length > 1 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {eventStates.map((state) => (
                        <ChoiceChip key={state} label={state} selected={selectedState === state} onPress={() => {
                          void (async () => {
                            try {
                              await releaseSelectionHold();
                              setSelectedState(state);
                            } catch (error) {
                              setFormError(`The temporary stall lock could not be released: ${getApiErrorMessage(error)}`);
                            }
                          })();
                        }} />
                      ))}
                    </View>
                  ) : null}
                  {selectedType ? (
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      {selectedType.name} · {selectedType.widthM}m × {selectedType.depthM}m · {availableStalls.length} currently available
                    </Text>
                  ) : (
                    <Text style={{ color: theme.muted, fontSize: 12 }}>Select a stall type in Preferences to see available stalls.</Text>
                  )}
                  {stallsQuery.isPending ? (
                    <MessageState title="Loading live stall availability" description="Checking the current exhibition floor plan." loading />
                  ) : stallsQuery.isError ? (
                    <MessageState title="Stall availability could not load" description={getApiErrorMessage(stallsQuery.error)} />
                  ) : !stallTypeId ? null : visibleStalls.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                      {visibleStalls.map((stall) => {
                        const selected = stallId === stall.id;
                        return (
                          <Pressable
                            key={stall.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: holdingStallId === stall.id }}
                            disabled={holdingStallId === stall.id}
                            onPress={() => void selectStall(stall.id)}
                            style={{
                              alignItems: 'center',
                              backgroundColor: selected ? theme.terracotta : theme.surface,
                              borderColor: selected ? theme.terracotta : theme.border,
                              borderRadius: 12,
                              borderWidth: 1,
                              gap: 3,
                              justifyContent: 'center',
                              minHeight: 68,
                              padding: 9,
                              width: '30%',
                            }}>
                            <Text style={{ color: selected ? '#FFFFFF' : theme.cream, fontSize: 13, fontWeight: '800' }}>{stall.code}</Text>
                            <Text numberOfLines={1} style={{ color: selected ? '#FFFFFF' : theme.muted, fontSize: 9 }}>
                              {holdingStallId === stall.id ? 'Locking…' : selected && selectionHold ? 'Locked for 10 min' : stall.location}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <MessageState title="No stalls available for this type" description="Return to Preferences and choose another live stall option." />
                  )}
                  {selectionHold && stallId ? (
                    <Text style={{ color: theme.success, fontSize: 11, lineHeight: 17 }}>
                      Stall temporarily locked until {new Date(selectionHold.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This is a request; final allocation follows approval and booking.
                    </Text>
                  ) : null}
                  {user ? null : <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>Sign in and verify your email to lock an available stall for 10 minutes.</Text>}
                  {stallsQuery.isError ? <Pressable onPress={() => void stallsQuery.refetch()}><Text style={{ color: theme.terracotta, fontWeight: '700' }}>Retry availability check</Text></Pressable> : null}
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <Review label="Personal Details" value={`${personal.firstName} ${personal.lastName}\n${personal.phone}\n${personal.address}`} />
                  <Review label="Artwork Details" value={`${artwork.artForm}\n${artwork.fasciaName}\n${artwork.bio}`} />
                  <Review label="Artwork uploads" value={`${artworkImages.length} image${artworkImages.length === 1 ? '' : 's'}${portfolio ? `\nPortfolio: ${portfolio.name}` : ''}`} />
                  <Review label="Exhibition" value={`${exhibition.title}\n${formatDateRange(exhibition.startsAt, exhibition.endsAt)}\n${exhibition.venue}`} />
                  <Review label="Stall Preference" value={selectedType ? `${selectedType.name} · ${selectedState || exhibition.city}${selectedStall ? ` · ${selectedStall.code}` : ''}` : 'No stall type selected'} />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agreeTerms }}
                    onPress={() => setAgreeTerms((value) => !value)}
                    style={{ alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
                    <View style={{ alignItems: 'center', backgroundColor: agreeTerms ? theme.terracotta : theme.surface, borderColor: theme.border, borderRadius: 5, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 }}>
                      {agreeTerms ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: theme.muted, flex: 1, fontSize: 11, lineHeight: 17 }}>I agree to the exhibitor terms and exhibition guidelines.</Text>
                  </Pressable>
                  {!user ? <Text style={{ color: theme.muted, fontSize: 11 }}>Sign in or create an exhibitor account only when you submit this application.</Text> : null}
                </>
              ) : null}

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              {submission.isError ? <Text style={styles.errorText}>{getApiErrorMessage(submission.error)}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 'auto', paddingTop: 8 }}>
                {step > 0 ? (
                  <Pressable onPress={() => goTo(step - 1)} style={{ alignItems: 'center', borderColor: theme.border, borderRadius: 22, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 }}>
                    <Text style={{ color: theme.cream, fontSize: 12, fontWeight: '700' }}>Back</Text>
                  </Pressable>
                ) : null}
                {step < 4 ? (
                  <Pressable onPress={() => goTo(step + 1)} style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flex: 1, justifyContent: 'center', minHeight: 44 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Continue</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    disabled={submission.isPending}
                    onPress={submitApplication}
                    style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, flex: 1, justifyContent: 'center', minHeight: 44, opacity: submission.isPending ? 0.6 : 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                      {submission.isPending ? 'Submitting application…' : user ? 'Submit application' : 'Sign in to submit'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'url';
  autoComplete?: 'given-name' | 'family-name';
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.subtle}
        style={[styles.field, multiline ? { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' } : null]}
        value={value}
      />
    </View>
  );
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: selected ? theme.terracotta : theme.surface, borderColor: selected ? theme.terracotta : theme.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: selected ? '#FFFFFF' : theme.cream, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.surface, { gap: 5, padding: 13 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: theme.cream, fontSize: 12, lineHeight: 19 }}>{value}</Text>
    </View>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  return trimmed ? (trimmed.startsWith('http') ? trimmed : `https://${trimmed}`) : null;
}

function isUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value) ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function imageMimeType(asset: ImagePicker.ImagePickerAsset) {
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
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType ?? '') ? mimeType : null;
}

async function readLocalFile(uri: string, file?: Blob | null) {
  if (file) return file;
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected file could not be read.');
  const body = await response.blob();
  if (body.size === 0) throw new Error('The selected file is empty.');
  return body;
}
