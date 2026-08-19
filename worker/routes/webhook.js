// LINE Webhook handler

import { pushMessage, replyMessage } from '../utils/line-api.js';
import { getUpcomingCalendarReminders } from '../utils/calendar.js';
import { fetchTaipeiWeather } from '../utils/weather.js';
import { getSubscribers, saveSubscriber } from '../db/subscribers.js';
import { getReminderRoutines } from '../db/reminder-routines.js';
import { logDelivery } from '../db/delivery-log.js';

export async function lineWebhook(c, body) {
  try {
    const events = JSON.parse(body).events;
    await Promise.all(events.map((event) => handleEvent(c, event)));
    return c.text('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.text('Error', 500);
  }
}

async function handleEvent(c, event) {
  const targetId = event.source.groupId || event.source.roomId || event.source.userId;
  const targetType = event.source.groupId ? 'group' : event.source.roomId ? 'room' : 'user';
  const accessToken = c.env.CHANNEL_ACCESS_TOKEN;

  // Join or follow event - register the chat
  if (event.type === 'join' || event.type === 'follow') {
    console.log(`Bot added to chat: ${targetId}`);
    await saveSubscriber(c.env.DB, targetId, targetType);

    return replyMessage(accessToken, event.replyToken, [
      {
        type: 'text',
        text: 'Hello! I am your Medicine Reminder Bot. I will send scheduled reminders to this chat at 9 AM and 9 PM everyday.',
      },
    ]);
  }

  // Only handle text messages
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userText = event.message.text.toLowerCase().trim();

  // Register command
  if (userText === 'register') {
    await saveSubscriber(c.env.DB, targetId, targetType);
    return replyMessage(accessToken, event.replyToken, [
      {
        type: 'text',
        text: 'This chat has been registered to receive medicine reminders!',
      },
    ]);
  }

  // Weather command
  if (userText === '今日天氣') {
    const weather = await fetchTaipeiWeather();
    if (weather) {
      return replyMessage(accessToken, event.replyToken, [
        {
          type: 'text',
          text: `☀️ 台北今日氣象\n平均溫度：${weather.avgTemp}°C\n降雨機率：${weather.rainChance}%`,
        },
      ]);
    } else {
      return replyMessage(accessToken, event.replyToken, [
        { type: 'text', text: '無法獲取天氣資訊 (API無回應)。' },
      ]);
    }
  }

  // Calendar command
  if (userText === '近期行程' || userText === 'next events') {
    const calendarText = await getUpcomingCalendarReminders(
      c.env.CALENDAR_URL,
      5,
      true,
      false
    );
    const msg = calendarText ? calendarText.trim() : '最近5天內沒有即將到來的行程。';
    return replyMessage(accessToken, event.replyToken, [{ type: 'text', text: msg }]);
  }

  // Settings command - return dashboard URL
  if (userText === '設定' || userText === 'settings') {
    const dashboardUrl = c.env.DASHBOARD_URL || '設定連結尚未配置 (No URL configured)';
    return replyMessage(accessToken, event.replyToken, [
      { type: 'text', text: `請點擊以下連結開啟設定儀表板：\n${dashboardUrl}` },
    ]);
  }
}

// Push messages to all subscribers (used by scheduled reminders)
export async function pushMessageToAll(env, messages) {
  const subs = await getSubscribers(env.DB);
  if (subs.length === 0) {
    console.log('No registered chats to send reminders to.');
    return;
  }

  const messageObjects = messages.map((text) => ({ type: 'text', text }));
  const chunks = chunkMessages(messageObjects);

  for (const id of subs) {
    for (const chunk of chunks) {
      try {
        await pushMessage(env.CHANNEL_ACCESS_TOKEN, id, chunk);
        console.log(`Successfully sent bundle to ${id}`);
        await logDelivery(env.DB, {
          reminder_type: 'routine',
          reminder_id: 'scheduled',
          scheduled_for: new Date().toISOString(),
          subscriber_id: id,
          status: 'success',
        });
      } catch (error) {
        console.error(`Failed to send bundle to ${id}:`, error);
        await logDelivery(env.DB, {
          reminder_type: 'routine',
          reminder_id: 'scheduled',
          scheduled_for: new Date().toISOString(),
          subscriber_id: id,
          status: 'failed',
          error_message: String(error),
        });
      }
    }
  }
}

// Helper function - should be in a utils file
function chunkMessages(messages, maxChunk = 5) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += maxChunk) {
    chunks.push(messages.slice(i, i + maxChunk));
  }
  return chunks;
}