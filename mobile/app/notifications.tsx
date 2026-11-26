import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, PageHeading, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, Exhibition, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { cancelEventReminder, getScheduledEventReminders, scheduleEventReminder } from '@/lib/event-reminders';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function NotificationsScreen() {
  const [reminders, setReminders] = useState<Map<string, string>>(new Map());
  const [busyEventId, setBusyEventId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useRefreshOnFocus('notifications');

  const events = useQuery({
    queryKey: ['notifications', 'events'],
    queryFn: async () => (await api.get<{ events: Exhibition[] }>('/events', {
      params: { page: 1, pageSize: 30, upcoming: 'true' },
    })).data.events,
  });

  async function loadReminders() {
    if (Platform.OS === 'web') return;
    try {
      const scheduled = await getScheduledEventReminders();
      setReminders(new Map(scheduled.map((reminder) => [reminder.eventId, reminder.id])));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  useEffect(() => {
    void loadReminders();
  }, []);

  async function toggleReminder(event: Exhibition) {
    setBusyEventId(event.id);
    setError('');
    setMessage('');
    try {
      const reminderId = reminders.get(event.id);
      if (reminderId) {
        await cancelEventReminder(reminderId);
        setReminders((current) => {
          const next = new Map(current);
          next.delete(event.id);
          return next;
        });
        setMessage(`Reminder removed for ${event.title}.`);
      } else {
        const scheduled = await scheduleEventReminder(event);
        setReminders((current) => new Map(current).set(event.id, scheduled.id));
        setMessage(scheduled.alreadyScheduled
          ? `A reminder is already scheduled for ${event.title}.`
          : `Reminder set for ${scheduled.reminderDate.toLocaleString('en-IN')}.`);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyEventId('');
    }
  }

  async function refresh() {
    await Promise.all([events.refetch(), loadReminders()]);
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void refresh()} tintColor={theme.champagne} />}
        showsVerticalScrollIndicator={false}>
        <PageHeading eyebrow="Stay in the loop" title="Event reminders" description="Get a local reminder before an upcoming Haat of Art exhibition." />
        {Platform.OS === 'web' ? (
          <MessageState title="Reminders need the mobile app" description="Open The Haat of Art on Android or iOS to schedule event notifications." />
        ) : null}
        {events.isPending ? (
          <MessageState title="Loading upcoming events" description="Getting current exhibitions from The Haat of Art." loading />
        ) : events.isError ? (
          <MessageState title="Upcoming events could not load" description={getApiErrorMessage(events.error)} action={<HaatButton label="Retry" onPress={() => void events.refetch()} />} />
        ) : events.data?.length ? (
          <View style={{ gap: 11 }}>
            {events.data.map((event) => {
              const imageUrl = resolveMediaUrl(event.media.find((item) => item.mediaType === 'IMAGE')?.url);
              const reminderSet = reminders.has(event.id);
              return (
                <View key={event.id} style={[styles.surface, { flexDirection: 'row', gap: 11, padding: 11 }]}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} contentFit="cover" transition={250} accessibilityLabel={event.title} style={{ backgroundColor: theme.surfaceRaised, borderRadius: 11, height: 94, width: 92 }} />
                  ) : null}
                  <View style={{ flex: 1, gap: 5, justifyContent: 'center' }}>
                    <Text numberOfLines={2} style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 17, fontWeight: '600' }}>{event.title}</Text>
                    <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10 }}>{formatDateRange(event.startsAt, event.endsAt)} · {event.city}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: Platform.OS === 'web' || busyEventId === event.id, selected: reminderSet }}
                      disabled={Platform.OS === 'web' || busyEventId === event.id}
                      onPress={() => void toggleReminder(event)}
                      style={{ alignSelf: 'flex-start', backgroundColor: reminderSet ? theme.surfaceRaised : theme.terracotta, borderRadius: 15, marginTop: 2, paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ color: reminderSet ? theme.terracotta : '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                        {busyEventId === event.id ? 'Updating…' : reminderSet ? 'Reminder set · Remove' : 'Remind me'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <MessageState title="No upcoming exhibitions" description="Event reminders will be available when new exhibitions are published." />
        )}
        {message ? <Text style={{ color: theme.terracotta, fontSize: 13 }}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
