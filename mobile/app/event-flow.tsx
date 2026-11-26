import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatText as Text, MessageState, PageHeading, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, EventFlowContent, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import { useRefreshOnFocus } from '@/lib/query-refresh';

export default function EventFlowScreen() {
  useRefreshOnFocus('event-flow');
  const flow = useQuery({
    queryKey: ['event-flow'],
    queryFn: async () => (await api.get<EventFlowContent>('/event-flow')).data,
  });

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={flow.isRefetching} onRefresh={() => void flow.refetch()} tintColor={theme.terracotta} />}
        showsVerticalScrollIndicator={false}>
        {flow.isPending ? (
          <MessageState title="Loading event flow" description="Getting the published event schedule." loading />
        ) : flow.isError ? (
          <MessageState title="Event flow could not load" description={getApiErrorMessage(flow.error)} />
        ) : (
          <>
            <PageHeading eyebrow={flow.data.kicker} title={flow.data.title} description={flow.data.subtitle} />
            {flow.data.phases.map((phase) => (
              <View key={phase.id} style={[styles.surface, { gap: 10 }]}>
                {phase.imageUrl ? (
                  <Image source={{ uri: resolveMediaUrl(phase.imageUrl) ?? undefined }} contentFit="cover" accessibilityLabel={phase.title} style={{ borderRadius: 12, height: 155, width: '100%' }} />
                ) : null}
                <Text style={styles.eyebrow}>{phase.number} · {phase.timeframe}</Text>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 21 }}>{phase.title}</Text>
                <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{phase.introduction}</Text>
                {phase.audience.length ? <Text style={{ color: theme.terracotta, fontSize: 11, fontWeight: '700' }}>{phase.audience.join(' · ')}</Text> : null}
                {phase.activities.map((activity, index) => (
                  <Text key={`${phase.id}-${index}`} style={{ color: theme.cream, fontSize: 12, lineHeight: 19 }}>• {activity}</Text>
                ))}
              </View>
            ))}
            {flow.data.schedule.map((day) => (
              <View key={`${day.day}-${day.title}`} style={[styles.surface, { gap: 9 }]}>
                <Text style={styles.eyebrow}>{day.day}</Text>
                <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 18 }}>{day.title}</Text>
                {day.items.map((item, index) => (
                  <View key={`${day.day}-${index}`} style={{ borderTopColor: theme.border, borderTopWidth: 1, gap: 3, paddingTop: 8 }}>
                    <Text style={{ color: theme.terracotta, fontSize: 10, fontWeight: '700' }}>{item.period} · {item.time}</Text>
                    <Text style={{ color: theme.cream, fontSize: 12 }}>{item.activity}</Text>
                  </View>
                ))}
              </View>
            ))}
            <Link href="/book-stall" asChild>
              <Pressable style={{ alignItems: 'center', backgroundColor: theme.terracotta, borderRadius: 22, justifyContent: 'center', minHeight: 44 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{flow.data.ctaTitle}</Text>
              </Pressable>
            </Link>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
