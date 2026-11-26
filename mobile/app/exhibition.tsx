import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventImage, HaatButton, HaatText as Text, MessageState, PageHeading, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, Exhibition, getApiErrorMessage } from '@/lib/api';
import { scheduleEventReminder } from '@/lib/event-reminders';

type PassOffer = {
  slug: string;
  passConfig: {
    passMode: 'FREE' | 'PAID' | 'BOTH';
    freeRemaining: number | null;
    paidPrice: number;
    paidRemaining: number | null;
  };
};

export default function ExhibitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reminderMessage, setReminderMessage] = useState('');
  const exhibitions = useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api.get<Exhibition>(`/events/${encodeURIComponent(id ?? '')}`)).data,
    enabled: Boolean(id),
  });
  const passOffers = useQuery({
    queryKey: ['open-pass-events'],
    queryFn: async () => (await api.get<{ events: PassOffer[] }>('/exhibitions/nearest')).data.events,
  });
  const exhibition = exhibitions.data;
  const passOffer = passOffers.data?.find((item) => item.slug === exhibition?.slug);
  const reminder = useMutation({
    mutationFn: async () => {
      if (!exhibition) throw new Error('Exhibition details are unavailable.');
      const result = await scheduleEventReminder(exhibition);
      return result.alreadyScheduled
        ? 'A reminder is already scheduled for this exhibition.'
        : `Reminder scheduled for ${result.reminderDate.toLocaleString('en-IN')}.`;
    },
    onSuccess: setReminderMessage,
    onError: (error) => setReminderMessage(getApiErrorMessage(error)),
  });

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {exhibitions.isPending ? (
          <MessageState title="Loading exhibition" description="Getting live event information." loading />
        ) : exhibitions.isError ? (
          <MessageState title="Exhibition could not load" description={getApiErrorMessage(exhibitions.error)} />
        ) : exhibition ? (
          <>
            <EventImage
              path={exhibition.media.find((item) => item.mediaType === 'IMAGE')?.url}
              alt={exhibition.title}
              style={{ height: 250 }}
            />
            <PageHeading
              eyebrow={[exhibition.city, exhibition.state].filter(Boolean).join(' · ')}
              title={exhibition.title}
              description={formatDateRange(exhibition.startsAt, exhibition.endsAt)}
            />
            <View style={[styles.surface, { gap: 12 }]}>
              <Detail label="Venue" value={exhibition.venue} />
              {exhibition.city ? <Detail label="City" value={exhibition.city} /> : null}
              <Detail label="About this exhibition" value={exhibition.description} />
            </View>
            {passOffers.isError ? (
              <Text style={styles.errorText}>Visitor pass availability could not load: {getApiErrorMessage(passOffers.error)}</Text>
            ) : passOffers.isPending ? (
              <MessageState title="Checking visitor pass availability" description="Loading registration information." loading />
            ) : passOffer ? (
              <>
                <View style={[styles.surface, { gap: 7 }]}>
                  <Text style={styles.label}>Visitor registration</Text>
                  <Text style={{ color: theme.cream, fontSize: 14 }}>
                    {passOffer.passConfig.passMode === 'FREE'
                      ? 'Free visitor passes are available.'
                      : passOffer.passConfig.passMode === 'PAID'
                        ? `VIP passes from ₹${passOffer.passConfig.paidPrice.toLocaleString('en-IN')}.`
                        : `Free and VIP visitor passes are available. VIP from ₹${passOffer.passConfig.paidPrice.toLocaleString('en-IN')}.`}
                  </Text>
                </View>
                <HaatButton
                  label="Register for this exhibition"
                  onPress={() => router.push({ pathname: '/pass-register', params: { eventSlug: passOffer.slug } })}
                />
              </>
            ) : (
              <MessageState title="Registration is not open" description="Visitor pass registration is not currently available for this exhibition." />
            )}
            {reminderMessage ? (
              <Text style={reminder.isError ? styles.errorText : { color: theme.success, fontSize: 12 }}>
                {reminderMessage}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={reminder.isPending}
              onPress={() => {
                setReminderMessage('');
                reminder.mutate();
              }}
              style={{ alignSelf: 'flex-start', borderBottomColor: theme.border, borderBottomWidth: 1, paddingBottom: 5 }}>
              <Text style={{ color: theme.terracottaLight, fontSize: 13, fontWeight: '700' }}>
                {reminder.isPending ? 'Setting reminder…' : 'Remind me before this event'}
              </Text>
            </Pressable>
            <HaatButton label="Back to exhibitions" onPress={() => router.back()} variant="secondary" />
          </>
        ) : (
          <MessageState title="Exhibition not found" description="This event may no longer be publicly listed." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: theme.cream, fontSize: 14, lineHeight: 22 }}>{value || 'Details to be announced'}</Text>
    </View>
  );
}
