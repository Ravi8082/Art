import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type ReminderEvent = { id: string; title: string; startsAt: string };

export async function getScheduledEventReminders() {
  if (Platform.OS === 'web') return [];
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.flatMap((notification) => {
    const eventId = notification.content.data?.eventId;
    return typeof eventId === 'string' ? [{ id: notification.identifier, eventId }] : [];
  });
}

export async function scheduleEventReminder(event: ReminderEvent) {
  if (Platform.OS === 'web') throw new Error('Event reminders are available in the Android and iOS app.');
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) throw new Error('The exhibition start date is invalid.');
  const reminderDate = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  if (reminderDate.getTime() <= Date.now()) {
    if (start.getTime() <= Date.now()) throw new Error('This exhibition has already started.');
    reminderDate.setTime(start.getTime());
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) permissions = await Notifications.requestPermissionsAsync();
  if (!permissions.granted) throw new Error('Notification permission was not granted.');

  const existing = (await getScheduledEventReminders()).find((reminder) => reminder.eventId === event.id);
  if (existing) return { id: existing.id, alreadyScheduled: true, reminderDate };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: event.title,
      body: 'Your Haat of Art exhibition is coming up.',
      data: { eventId: event.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
  });
  return { id, alreadyScheduled: false, reminderDate };
}

export async function cancelEventReminder(notificationId: string) {
  if (Platform.OS === 'web') throw new Error('Event reminders are available in the Android and iOS app.');
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
