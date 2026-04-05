require("dotenv").config();
const { pushMessageToAll } = require("./src/bot.js");
const { getUpcomingCalendarReminders } = require("./src/calendar.js");
const path = require("path");
const fs = require("fs");

let message = "This is a test message. 阿伯，記得吃藥喔！";
let includeWeather = false;
let includeCalendarReminder = false;
let includeCalendarReminderDays = 4;
let excludePastCalendarEvents = true;
let excludeTodayCalendarEvents = false;
const messagePath = path.join(__dirname, "message.json");

try {
  if (fs.existsSync(messagePath)) {
    const data = fs.readFileSync(messagePath, "utf8");
    const parsed = JSON.parse(data);
    if (parsed.reminders && Array.isArray(parsed.reminders) && parsed.reminders.length > 1) {
      // Use the configured logic but replace the raw text with a generic timestamped message
      const config = parsed.reminders.length > 1 ? parsed.reminders[1] : parsed.reminders[0];
      const now = new Date();
      const timeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      message = `【手動發送測試】目前時間：${timeString}`;
      
      includeWeather = config.includeWeather;
      includeCalendarReminder = config.includeCalendarReminder;
      includeCalendarReminderDays = config.includeCalendarReminderDays || 4;
      excludePastCalendarEvents = config.excludePastCalendarEvents !== false;
      excludeTodayCalendarEvents = config.excludeTodayCalendarEvents === true;
    }
  }
} catch (err) {
  console.error("Error reading message.json:", err);
}

async function send() {
  if (includeWeather) {
    try {
      console.log("Fetching weather data for Taipei...");
      const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=25.0478&longitude=121.5319&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=1";
      
      let weatherData = null;
      let attempts = 0;
      
      while (attempts < 3 && !weatherData) {
        try {
          const weatherResp = await fetch(weatherUrl, { headers: { "User-Agent": "LINE-Bot/1.0" } });
          if (!weatherResp.ok) throw new Error(`HTTP Error: ${weatherResp.status}`);
          weatherData = await weatherResp.json();
        } catch (e) {
          attempts++;
          console.log(`Weather fetch failed (Attempt ${attempts}/3). Retrying in 2s...`);
          if (attempts < 3) await new Promise(res => setTimeout(res, 2000));
        }
      }

      if (weatherData && weatherData.daily) {
        const high = weatherData.daily.temperature_2m_max[0];
        const low = weatherData.daily.temperature_2m_min[0];
        const avgTemp = ((high + low) / 2).toFixed(1);
        const rainChance = weatherData.daily.precipitation_probability_max[0];

        message += `\n\n(💡 台北今日平均溫度：${avgTemp}°C，降雨機率：${rainChance}%)`;
      } else {
        console.log("Failed to fetch weather after 3 attempts.");
      }
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
    }
  }

  // 3. Test Calendar fetching
  if (includeCalendarReminder) {
    console.log(`\nFetching upcoming calendar events for next ${includeCalendarReminderDays} days (Exclude Today: ${excludeTodayCalendarEvents})...`);
    const calendarText = await getUpcomingCalendarReminders(includeCalendarReminderDays, excludePastCalendarEvents, excludeTodayCalendarEvents);
    if (calendarText) {
      message += calendarText;
    } else {
      console.log("No upcoming events found or error occurred.");
    }
  }

  console.log(`Sending immediate test: ${message}\n`);

  try {
    await pushMessageToAll(message);
    console.log("If your group is registered in subs.json, the message was sent!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to push message:", err);
    process.exit(1);
  }
}

send();
