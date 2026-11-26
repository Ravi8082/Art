import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatText as Text, MessageState, PageHeading, formatDateRange, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, BookingExhibition, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function BookStallScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState('All');
  useRefreshOnFocus('bookings');
  const exhibitions = useQuery({
    queryKey: ['bookings', 'exhibitions'],
    queryFn: async () => (await api.get<BookingExhibition[]>('/bookings/exhibitions')).data,
  });
  const items = exhibitions.data ?? [];
  const cities = useMemo(() => [...new Set(items.map((event) => event.city.trim()).filter(Boolean))], [items]);
  const filtered = selectedCity === 'All' ? items : items.filter((event) => event.city.trim() === selectedCity);

  function chooseExhibition(selectedEventId: string) {
    router.push({ pathname: '/stall-application', params: { eventId: selectedEventId } });
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={exhibitions.isRefetching} onRefresh={() => void exhibitions.refetch()} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        <PageHeading
          eyebrow="Exhibitor registration"
          title="Choose an exhibition"
          description="Compare upcoming editions and current stall availability."
        />
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
          {['All', ...cities].map((city) => {
            const selected = selectedCity === city;
            return (
              <Pressable
                key={city}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCity(city)}
                style={{
                  backgroundColor: selected ? theme.terracotta : theme.surface,
                  borderColor: selected ? theme.terracotta : theme.border,
                  borderRadius: 18,
                  borderWidth: 1,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                }}>
                <Text numberOfLines={1} style={{ color: selected ? '#FFFFFF' : theme.cream, fontSize: 11, fontWeight: '700' }}>
                  {city}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {exhibitions.isPending ? (
          <MessageState title="Loading editions" description="Getting live exhibitions and stall availability." loading />
        ) : exhibitions.isError ? (
          <MessageState title="Exhibitions could not load" description={getApiErrorMessage(exhibitions.error)} />
        ) : filtered.length ? (
          filtered.map((event) => {
            const image = event.media.find((media) => media.mediaType === 'IMAGE');
            return (
              <View key={event.id} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }}>
                {image?.url ? (
                  <Image
                    source={{ uri: resolveMediaUrl(image.url) ?? undefined }}
                    contentFit="cover"
                    transition={180}
                    accessibilityLabel={image.altText || event.title}
                    style={{ backgroundColor: theme.surfaceRaised, height: 170, width: '100%' }}
                  />
                ) : null}
                <View style={{ gap: 6, padding: 14 }}>
                  <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {[event.city, event.state].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 19, fontWeight: '600' }}>{event.title}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{formatDateRange(event.startsAt, event.endsAt)}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>{event.venue}</Text>
                  <Text style={{ color: theme.cream, fontSize: 12, fontWeight: '700' }}>
                    {event.availableStalls} of {event.totalStalls} stalls available
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!event.registrationOpen || event.availableStalls <= 0}
                    onPress={() => chooseExhibition(event.id)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: theme.terracotta,
                      borderRadius: 20,
                      justifyContent: 'center',
                      marginTop: 4,
                      minHeight: 42,
                      opacity: event.registrationOpen && event.availableStalls > 0 ? 1 : 0.55,
                    }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                      {event.registrationOpen && event.availableStalls > 0 ? 'Select this exhibition' : 'Registration unavailable'}
                    </Text>
                  </Pressable>
                  {eventId === event.id ? <Text style={{ color: theme.terracotta, fontSize: 11 }}>Selected from your exhibition details.</Text> : null}
                </View>
              </View>
            );
          })
        ) : (
          <MessageState title="No exhibitions available" description="There are no upcoming editions open for stall booking." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
