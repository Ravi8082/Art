import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, getApiErrorMessage, resolveMediaUrl, type Exhibition } from '@/lib/api';
import { getAccessToken } from '@/lib/secure-tokens';
import { useSessionStore } from '@/store/session';

type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
type BookingStatus = 'PAYMENT_PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED';
type DecisionAction = 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
type AdminTab = 'applications' | 'bookings';

type ApplicationRow = {
  id: string;
  applicationRef: string;
  status: ApplicationStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  artForm: string | null;
  spaceCategory: string | null;
  createdAt: string;
  eventTitle: string;
  eventCity: string;
  eventState: string | null;
  email: string;
  preferredStallType: string | null;
  requestedStallCode: string | null;
};

type ApplicationDetail = ApplicationRow & {
  address: string;
  websiteUrl: string | null;
  instagramUrl: string | null;
  fasciaName: string | null;
  bio: string | null;
  preferredStallTypeId: string | null;
  preferredStallPrice: number | string | null;
  requestedStallId: string | null;
  requestedStallLocation: string | null;
  approxSizeSqm: number | string | null;
  specialRequirements: string | null;
  adminNotes: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  venue: string | null;
  eventStartsAt: string;
  emailVerifiedAt: string | null;
  media: { id: string; mimeType: string; byteSize: number; altText: string | null; kind: string; url: string }[];
};

type BookingRow = {
  id: string;
  bookingRef: string;
  status: BookingStatus;
  totalAmount: number | string;
  currency: string;
  createdAt: string;
  applicationRef: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  stallType: string | null;
  eventTitle: string;
  eventCity: string;
  eventState: string | null;
  venue: string | null;
  stallCode: string;
  stallLocation: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  transactionRef: string | null;
  paidAmount: number | string | null;
  paymentProofAssetId: string | null;
  paymentProofMime: string | null;
  invoiceNo: string | null;
};

type LocationOption = { city: string | null; state: string | null };

const applicationStatuses: ('' | ApplicationStatus)[] = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'];
const bookingStatuses: ('' | BookingStatus)[] = ['', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING'];
const statusLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export default function AdminBookingsScreen() {
  const user = useSessionStore((state) => state.user);
  const isReady = useSessionStore((state) => state.isReady);
  const queryClient = useQueryClient();
  const canManage = Boolean(user && (user.permissions.includes('bookings:manage') || user.roles?.includes('SUPER_ADMIN')));
  const [tab, setTab] = useState<AdminTab>('applications');
  const [status, setStatus] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const filters = useMemo(() => ({
    ...(status ? { status } : {}),
    ...(stateFilter ? { state: stateFilter } : {}),
    ...(cityFilter ? { city: cityFilter } : {}),
    ...(eventFilter ? { eventId: eventFilter } : {}),
    ...(search ? { q: search } : {}),
  }), [status, stateFilter, cityFilter, eventFilter, search]);

  const exhibitions = useQuery({
    queryKey: ['admin-bookings', 'exhibitions'],
    queryFn: async () => (await api.get<Exhibition[]>('/bookings/exhibitions')).data,
    enabled: canManage,
  });
  const locations = useQuery({
    queryKey: ['admin-bookings', 'locations'],
    queryFn: async () => (await api.get<LocationOption[]>('/bookings/admin/locations')).data,
    enabled: canManage,
  });
  const applications = useQuery({
    queryKey: ['admin-bookings', 'applications', filters],
    queryFn: async () => (await api.get<ApplicationRow[]>('/bookings/admin/applications', { params: filters })).data,
    enabled: canManage && tab === 'applications',
  });
  const bookings = useQuery({
    queryKey: ['admin-bookings', 'bookings', filters],
    queryFn: async () => (await api.get<BookingRow[]>('/bookings/admin/bookings', { params: filters })).data,
    enabled: canManage && tab === 'bookings',
  });
  const applicationDetail = useQuery({
    queryKey: ['admin-bookings', 'application', selectedApplicationId],
    queryFn: async () => (await api.get<ApplicationDetail>(`/bookings/admin/applications/${selectedApplicationId}`)).data,
    enabled: canManage && Boolean(selectedApplicationId),
  });

  const stateOptions = useMemo(
    () => [...new Set((locations.data ?? []).flatMap((location) => (location.state ?? '').split(/[,;/]/).map((value) => value.trim()).filter(Boolean)))].sort(),
    [locations.data],
  );
  const cityOptions = useMemo(
    () => [...new Set((locations.data ?? [])
      .filter((location) => !stateFilter || (location.state ?? '').split(/[,;/]/).some((value) => value.trim() === stateFilter))
      .map((location) => (location.city ?? '').trim())
      .filter(Boolean))].sort(),
    [locations.data, stateFilter],
  );

  const refreshLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-bookings', 'applications'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-bookings', 'bookings'] }),
      selectedApplicationId
        ? queryClient.invalidateQueries({ queryKey: ['admin-bookings', 'application', selectedApplicationId] })
        : Promise.resolve(),
    ]);
  };
  const decision = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: DecisionAction }) =>
      (await api.put(`/bookings/admin/applications/${id}/decision`, { action, notes: notes.trim() || undefined })).data,
    onSuccess: async () => {
      setNotes('');
      setActionError('');
      await refreshLists();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });
  const paymentAction = useMutation({
    mutationFn: async ({ paymentId, approve }: { paymentId: string; approve: boolean }) =>
      (await api.post(`/bookings/admin/payments/${paymentId}/${approve ? 'verify' : 'reject'}`)).data,
    onSuccess: async () => {
      setActionError('');
      await refreshLists();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  async function contact(url: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  if (!isReady) {
    return <SafeAreaView style={styles.page}><MessageState title="Checking your account" description="Restoring your secure mobile session." loading /></SafeAreaView>;
  }
  if (!user) {
    return (
      <SafeAreaView style={[styles.page, { justifyContent: 'center', padding: 22 }]}>
        <MessageState
          title="Sign in to manage bookings"
          description="Use your authorized operations account to review applications and payments."
          action={<Link href="/login" asChild><Pressable style={buttonStyle}><Text style={buttonTextStyle}>Sign in</Text></Pressable></Link>}
        />
      </SafeAreaView>
    );
  }
  if (!canManage) {
    return (
      <SafeAreaView style={[styles.page, { justifyContent: 'center', padding: 22 }]}>
        <MessageState title="Admin access required" description="Your account does not have permission to manage exhibitor applications or bookings." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 36 }]} keyboardShouldPersistTaps="handled">
        <PageHeading eyebrow="Operations workspace" title="Applications & bookings" description="Review applicants, contact exhibitors and verify payments. Data is shared with the website admin dashboard." />
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        {locations.isError ? <MessageState title="Location filters unavailable" description={getApiErrorMessage(locations.error)} action={<HaatButton label="Retry locations" onPress={() => void locations.refetch()} variant="secondary" />} /> : null}
        {exhibitions.isError ? <MessageState title="Exhibition filter unavailable" description={getApiErrorMessage(exhibitions.error)} action={<HaatButton label="Retry exhibitions" onPress={() => void exhibitions.refetch()} variant="secondary" />} /> : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['applications', 'bookings'] as const).map((value) => (
            <Pressable key={value} onPress={() => { setTab(value); setStatus(''); setSelectedApplicationId('') }} style={[filterChip, tab === value && activeFilterChip]}>
              <Text style={[filterText, tab === value && activeFilterText]}>{value === 'applications' ? 'Applications' : 'Bookings & payments'}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Search name, email, application, booking or stall"
          placeholderTextColor={theme.subtle}
          accessibilityLabel="Search applications and bookings"
          style={inputStyle}
          maxLength={120}
        />

        <Text style={styles.label}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All states" active={!stateFilter} onPress={() => { setStateFilter(''); setCityFilter('') }} />
          {stateOptions.map((value) => <FilterChip key={value} label={value} active={stateFilter === value} onPress={() => { setStateFilter(value); setCityFilter('') }} />)}
        </ScrollView>

        <Text style={styles.label}>City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All cities" active={!cityFilter} onPress={() => setCityFilter('')} />
          {cityOptions.map((value) => <FilterChip key={value} label={value} active={cityFilter === value} onPress={() => setCityFilter(value)} />)}
        </ScrollView>

        <Text style={styles.label}>Exhibition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All exhibitions" active={!eventFilter} onPress={() => setEventFilter('')} />
          {(exhibitions.data ?? []).map((event) => (
            <FilterChip key={event.id} label={event.title} active={eventFilter === event.id} onPress={() => setEventFilter(event.id)} />
          ))}
        </ScrollView>

        <Text style={styles.label}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(tab === 'applications' ? applicationStatuses : bookingStatuses).map((value) => (
            <FilterChip key={value || 'all'} label={value ? statusLabel(value) : 'All'} active={status === value} onPress={() => setStatus(value)} />
          ))}
        </ScrollView>

        {tab === 'applications' ? (
          <View style={{ gap: 12 }}>
            {applications.isPending ? <MessageState title="Loading applications" description="Fetching the latest applications from the shared backend." loading /> : null}
            {applications.isError ? <MessageState title="Applications could not load" description={getApiErrorMessage(applications.error)} action={<HaatButton label="Try again" onPress={() => void applications.refetch()} variant="secondary" />} /> : null}
            {applications.data?.map((row) => {
              const phone = row.phone;
              const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;
              return (
                <View key={row.id} style={[styles.surface, { gap: 8 }]}>
                  <Text style={styles.eyebrow}>{row.applicationRef} · {statusLabel(row.status)}</Text>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>{[row.firstName, row.lastName].filter(Boolean).join(' ')}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{row.eventTitle} · {[row.eventCity, row.eventState].filter(Boolean).join(', ')}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>Preferred stall: {row.preferredStallType || '—'}{row.requestedStallCode ? ` · Requested: ${row.requestedStallCode}` : ''}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{row.email}{phone ? ` · ${phone}` : ''}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {phone ? <ActionButton label="Call" onPress={() => void contact(`tel:${phone}`)} /> : null}
                    {whatsappUrl ? <ActionButton label="WhatsApp" onPress={() => void contact(whatsappUrl)} /> : null}
                    <ActionButton label="Review details" onPress={() => { setSelectedApplicationId(row.id); setNotes(''); setActionError('') }} />
                  </View>
                </View>
              );
            })}
            {!applications.isPending && !applications.isError && !applications.data?.length ? <MessageState title="No applications found" description="No exhibitor applications match the selected filters." /> : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {bookings.isPending ? <MessageState title="Loading bookings" description="Fetching current stall bookings and payment status." loading /> : null}
            {bookings.isError ? <MessageState title="Bookings could not load" description={getApiErrorMessage(bookings.error)} action={<HaatButton label="Try again" onPress={() => void bookings.refetch()} variant="secondary" />} /> : null}
            {bookings.data?.map((row) => {
              const proofUrl = row.paymentProofAssetId ? resolveMediaUrl(`/bookings/media/${row.paymentProofAssetId}`) : null;
              const proofHeaders = getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined;
              const canVerify = Boolean(row.paymentId && row.paymentStatus === 'PENDING');
              const phone = row.phone;
              const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;
              return (
                <View key={row.id} style={[styles.surface, { gap: 8 }]}>
                  <Text style={styles.eyebrow}>{row.bookingRef} · {statusLabel(row.status)}</Text>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 20 }}>{[row.firstName, row.lastName].filter(Boolean).join(' ')}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{row.eventTitle} · {[row.eventCity, row.eventState].filter(Boolean).join(', ')}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{row.venue || 'Venue not set'} · Stall {row.stallCode}{row.stallType ? ` · ${row.stallType}` : ''}{row.stallLocation ? ` · ${row.stallLocation}` : ''}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{row.email}{row.phone ? ` · ${row.phone}` : ''}</Text>
                  {row.address ? <Text style={{ color: theme.muted, fontSize: 12 }}>{row.address}</Text> : null}
                  <Text style={{ color: theme.champagne, fontSize: 13, fontWeight: '700' }}>
                    {row.currency} {Number(row.paidAmount ?? row.totalAmount).toLocaleString('en-IN')} · {row.paymentStatus ? statusLabel(row.paymentStatus) : statusLabel(row.status)}
                    {row.invoiceNo ? ` · Invoice ${row.invoiceNo}` : ''}
                  </Text>
                  {row.transactionRef ? <Text style={{ color: theme.muted, fontSize: 12 }}>Transaction: {row.transactionRef} · {row.paymentMethod || 'Payment'}</Text> : null}
                  {proofUrl && row.paymentProofMime?.startsWith('image/') ? (
                    <Image source={{ uri: proofUrl, headers: proofHeaders }} contentFit="contain" style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, height: 190, width: '100%' }} />
                  ) : row.paymentProofAssetId ? (
                    <Text style={{ color: theme.muted, fontSize: 12 }}>Payment proof attached ({row.paymentProofMime || 'file'}). Open the website dashboard to download this document.</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {phone ? <ActionButton label="Call" onPress={() => void contact(`tel:${phone}`)} /> : null}
                    {whatsappUrl ? <ActionButton label="WhatsApp" onPress={() => void contact(whatsappUrl)} /> : null}
                    {row.email ? <ActionButton label="Email" onPress={() => void contact(`mailto:${row.email}`)} /> : null}
                  </View>
                  {canVerify ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <ActionButton label={paymentAction.isPending ? 'Verifying…' : 'Verify payment'} disabled={paymentAction.isPending} onPress={() => paymentAction.mutate({ paymentId: row.paymentId!, approve: true })} primary />
                      <ActionButton label="Reject payment" disabled={paymentAction.isPending} onPress={() => paymentAction.mutate({ paymentId: row.paymentId!, approve: false })} />
                    </View>
                  ) : null}
                </View>
              );
            })}
            {!bookings.isPending && !bookings.isError && !bookings.data?.length ? <MessageState title="No bookings found" description="No stall bookings match the selected filters." /> : null}
          </View>
        )}

        {selectedApplicationId ? (
          <View style={[styles.surface, { gap: 12 }]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 22 }}>Application review</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedApplicationId('')}><Text style={{ color: theme.champagne, fontWeight: '700' }}>Close</Text></Pressable>
            </View>
            {applicationDetail.isPending ? <MessageState title="Loading application details" description="Fetching applicant and artwork information." loading /> : null}
            {applicationDetail.isError ? <MessageState title="Application details unavailable" description={getApiErrorMessage(applicationDetail.error)} /> : null}
            {applicationDetail.data ? (
              <ApplicationReview
                application={applicationDetail.data}
                notes={notes}
                onNotesChange={setNotes}
                busy={decision.isPending}
                onDecision={(action) => decision.mutate({ id: selectedApplicationId, action })}
                onContact={contact}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ApplicationReview({
  application,
  notes,
  onNotesChange,
  busy,
  onDecision,
  onContact,
}: {
  application: ApplicationDetail;
  notes: string;
  onNotesChange: (value: string) => void;
  busy: boolean;
  onDecision: (action: DecisionAction) => void;
  onContact: (url: string) => Promise<void>;
}) {
  const accessToken = getAccessToken();
  const phone = application.phone;
  const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.eyebrow}>{application.applicationRef} · {statusLabel(application.status)}</Text>
      <Info label="Applicant" value={[application.firstName, application.lastName].filter(Boolean).join(' ')} />
      <Info label="Email" value={application.email} />
      <Info label="Email verified" value={application.emailVerifiedAt ? 'Yes' : 'No'} />
      <Info label="Phone" value={application.phone || '—'} />
      <Info label="Address" value={application.address || '—'} />
      <Info label="Exhibition" value={[application.eventTitle, application.eventCity, application.eventState, application.venue].filter(Boolean).join(' · ')} />
      <Info label="Art form / category" value={[application.artForm, application.spaceCategory].filter(Boolean).join(' · ')} />
      <Info label="Stall preference" value={[application.preferredStallType, application.requestedStallCode, application.requestedStallLocation].filter(Boolean).join(' · ') || '—'} />
      <Info label="Stall size" value={application.approxSizeSqm ? `${application.approxSizeSqm} sq m` : '—'} />
      <Info label="Fascia name" value={application.fasciaName || '—'} />
      <Info label="Website" value={application.websiteUrl || '—'} />
      <Info label="Instagram" value={application.instagramUrl || '—'} />
      <Info label="Special requirements" value={application.specialRequirements || '—'} />
      <Info label="Admin notes" value={application.adminNotes || 'No notes yet'} />
      {application.bio ? <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{application.bio}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {phone ? <ActionButton label="Call" onPress={() => void onContact(`tel:${phone}`)} /> : null}
        {whatsappUrl ? <ActionButton label="WhatsApp" onPress={() => void onContact(whatsappUrl)} /> : null}
        <ActionButton label="Email" onPress={() => void onContact(`mailto:${application.email}`)} />
      </View>
      {application.media.map((item) => {
        const url = resolveMediaUrl(item.url);
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
        return (
          <View key={item.id} style={{ gap: 5 }}>
            {url && item.mimeType.startsWith('image/') ? (
              <Image source={{ uri: url, headers }} contentFit="contain" style={{ backgroundColor: theme.surfaceRaised, borderRadius: 12, height: 190, width: '100%' }} />
            ) : (
              <Text style={{ color: theme.muted, fontSize: 12 }}>Attached file · {item.mimeType} · {Math.ceil(item.byteSize / 1024)} KB</Text>
            )}
            {item.altText ? <Text style={{ color: theme.muted, fontSize: 11 }}>{item.altText}</Text> : null}
          </View>
        );
      })}
      <TextInput
        value={notes}
        onChangeText={onNotesChange}
        maxLength={1000}
        multiline
        placeholder="Review notes for the applicant"
        placeholderTextColor={theme.subtle}
        style={[inputStyle, { minHeight: 84, textAlignVertical: 'top' }]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <ActionButton label="Start review" disabled={busy} onPress={() => onDecision('START_REVIEW')} />
        <ActionButton label="Approve" disabled={busy} onPress={() => onDecision('APPROVE')} primary />
        <ActionButton label="Request changes" disabled={busy} onPress={() => onDecision('REQUEST_CHANGES')} />
        <ActionButton label="Reject" disabled={busy} onPress={() => onDecision('REJECT')} />
      </View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[filterChip, active && activeFilterChip]}>
      <Text style={[filterText, active && activeFilterText]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[buttonStyle, primary && { backgroundColor: theme.terracotta, borderColor: theme.terracotta }, disabled && { opacity: 0.55 }]}>
      <Text style={[buttonTextStyle, primary && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderBottomColor: theme.border, borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <Text style={{ color: theme.subtle, flex: 1, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.cream, flex: 2, fontSize: 12, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const filterChip = { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 } as const;
const activeFilterChip = { backgroundColor: theme.terracotta, borderColor: theme.terracotta };
const filterText = { color: theme.muted, fontSize: 12, fontWeight: '600' as const };
const activeFilterText = { color: '#FFFFFF' };
const buttonStyle = { alignItems: 'center' as const, backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: 20, borderWidth: 1, justifyContent: 'center' as const, minHeight: 40, paddingHorizontal: 14 };
const buttonTextStyle = { color: theme.cream, fontSize: 12, fontWeight: '700' as const };
const inputStyle = { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, borderWidth: 1, color: theme.cream, fontSize: 13, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12 };
