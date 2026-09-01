// Scheduled handler for Cron Triggers
// Runs every minute to check for due reminders

import { pushMessage } from '../utils/line-api.js';
import { getReminderRoutines } from '../db/reminder-routines.js';
import { getSubscribers } from '../db/subscribers.js';
import { claimPendingOneOffReminders, updateOneOffReminderStatus } from '../db/oneoff-reminders.js';
import { getUpcomingCalendarReminders } from '../utils/calendar.js';
import { fetchTaipeiWeather } from '../utils/weather.js';
import { claimDelivery, completeDelivery, logDelivery } from '../db/delivery-log.js';
import { getTaipeiDateString, getTaipeiDayOfWeek, getTaipeiTimeString } from '../utils/timezone.js';

export async function scheduledHandler(controller, env, ctx) {
  const scheduledAt = new Date(controller.scheduledTime);
  console.log('[CRON] Scheduled handler triggered at', scheduledAt.toISOString());

  try {
    // Process routine reminders
    await processRoutineReminders(env, scheduledAt);

    // Process one-off reminders
    await processOneOffReminders(env, scheduledAt);

    console.log('[CRON] Scheduled handler completed');
  } catch (error) {
    console.error('[CRON] Scheduled handler error:', error);
    throw error;
  }
}

async function processRoutineReminders(env, now) {
  const routines = await getReminderRoutines(env.DB);
  const taipeiDate = getTaipeiDateString(now);
  const taipeiTime = getTaipeiTimeString(now); // "HH:MM"

  // Check if today is a valid day for each routine
  const dayOfWeek = getTaipeiDayOfWeek(now); // 0 = Sunday, explicitly in Asia/Taipei

  for (const routine of routines) {
    // Check if this routine should run today
    const daysOfWeek = routine.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    if (!daysOfWeek.includes(dayOfWeek)) {
      continue;
    }

    // Check if the time matches (compare HH:MM)
    if (routine.time !== taipeiTime) {
      continue;
    }

    console.log(`[CRON] Firing routine reminder: ${routine.id} at ${taipeiTime}`);

    // Build messages for this routine
    const messagesToSend = [];

    // 1. Medicine + Weather
    if (routine.includeMedicineReminder) {
      let medicineText = routine.message;

      if (routine.includeWeather) {
        const weather = await fetchTaipeiWeather();
        if (weather) {
          medicineText += `\n\n(💡 台北今日平均溫度：${weather.avgTemp}°C，降雨機率：${weather.rainChance}%)`;
        }
      }

      if (medicineText) messagesToSend.push(medicineText);
    }

    // 2. Calendar
    if (routine.includeCalendarReminder) {
      const days = routine.includeCalendarReminderDays || 4;
      const excludePast = routine.excludePastCalendarEvents !== false;
      const excludeToday = routine.excludeTodayCalendarEvents === true;

      const calendarText = await getUpcomingCalendarReminders(
        env.CALENDAR_URL,
        days,
        excludePast,
        excludeToday
      );

      if (calendarText && calendarText.trim()) {
        messagesToSend.push(calendarText.trim());
      }
    }

    if (messagesToSend.length > 0) {
      await sendReminderMessages(env, routine.id, messagesToSend, taipeiDate, taipeiTime);
    }
  }
}

async function processOneOffReminders(env, now) {
  const pending = await claimPendingOneOffReminders(env.DB, now.toISOString());

  if (pending.length === 0) return;

  for (const reminder of pending) {
    try {
      console.log(`[CRON] Sending one-off reminder: ${reminder.id} - ${reminder.message}`);

      const messages = [{ type: 'text', text: `🔔 提醒：${reminder.message}` }];
      const subs = await getSubscribers(env.DB);
      if (subs.length === 0) {
        await updateOneOffReminderStatus(env.DB, reminder.id, 'failed', 'No active subscribers');
        console.warn(`[ONE-OFF] No active subscribers for reminder ${reminder.id}`);
        continue;
      }

      let allSuccess = true;

      for (const subId of subs) {
        try {
          await pushMessage(env.CHANNEL_ACCESS_TOKEN, subId, messages);
          await logDelivery(env.DB, {
            reminder_type: 'oneoff',
            reminder_id: reminder.id,
            scheduled_for: reminder.scheduled_at,
            subscriber_id: subId,
            status: 'success',
          });
        } catch (error) {
          console.error(`[ONE-OFF] Failed to send to ${subId}:`, error);
          await logDelivery(env.DB, {
            reminder_type: 'oneoff',
            reminder_id: reminder.id,
            scheduled_for: reminder.scheduled_at,
            subscriber_id: subId,
            status: 'failed',
            error_message: String(error),
          });
          allSuccess = false;
        }
      }

      if (allSuccess) {
        await updateOneOffReminderStatus(env.DB, reminder.id, 'sent');
      } else {
        await updateOneOffReminderStatus(env.DB, reminder.id, 'failed', 'Some deliveries failed');
      }

      console.log(`[CRON] One-off reminder sent and marked ${allSuccess ? 'sent' : 'failed'} (id: ${reminder.id})`);
    } catch (error) {
      console.error(`[CRON] Failed to process one-off reminder (id: ${reminder.id}):`, error);
      await updateOneOffReminderStatus(env.DB, reminder.id, 'failed', String(error));
    }
  }
}

async function sendReminderMessages(
  env,
  routineId,
  messages,
  taipeiDate,
  taipeiTime
) {
  const messageObjects = messages.map((text) => ({ type: 'text', text }));
  const chunks = chunkMessages(messageObjects);
  const scheduledFor = `${taipeiDate}T${taipeiTime}:00+08:00`;
  const subs = await getSubscribers(env.DB);

  for (const subId of subs) {
    const delivery = {
      reminder_type: 'routine',
      reminder_id: routineId,
      scheduled_for: scheduledFor,
      subscriber_id: subId,
    };

    if (!(await claimDelivery(env.DB, delivery))) {
      console.log(`[ROUTINE] Skipping already claimed delivery for ${subId}`);
      continue;
    }

    try {
      for (const chunk of chunks) {
        await pushMessage(env.CHANNEL_ACCESS_TOKEN, subId, chunk);
      }
      await completeDelivery(env.DB, delivery, 'success');
    } catch (error) {
      console.error(`[ROUTINE] Failed to send to ${subId}:`, error);
      await completeDelivery(env.DB, delivery, 'failed', String(error));
    }
  }
}

function chunkMessages(messages, maxChunk = 5) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += maxChunk) {
    chunks.push(messages.slice(i, i + maxChunk));
  }
  return chunks;
}