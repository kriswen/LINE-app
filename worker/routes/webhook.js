// LINE Webhook handler

import { replyMessage } from '../utils/line-api.js';
import { getUpcomingCalendarReminders } from '../utils/calendar.js';
import { fetchTaipeiWeather } from '../utils/weather.js';
import { saveSubscriber } from '../db/subscribers.js';

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
