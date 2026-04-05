const express = require("express");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");

const { botRouter, pushMessageToAll } = require("./bot");
const { getUpcomingCalendarReminders } = require("./calendar");

const app = express();
const port = process.env.PORT || 3000;

// LINE middleware requires the raw body, so we mount the botRouter *before* any other body parsers
app.use(botRouter);

// Regular middleware for other routes (if any)
app.use(express.json());

// Serve the frontend web dashboard
app.use(express.static(path.join(__dirname, "..", "public")));

function loadReminders() {
  const messagePath = path.join(__dirname, "..", "message.json");
  let reminders = [
    { time: "morning", message: "爸爸，記得吃藥喔！" },
    { time: "evening", message: "爸爸，記得吃藥喔！" }
  ];

  try {
    if (fs.existsSync(messagePath)) {
      const data = fs.readFileSync(messagePath, "utf8");
      const parsed = JSON.parse(data);
      if (parsed.reminders && Array.isArray(parsed.reminders)) {
        reminders = parsed.reminders;
      }
    }
  } catch (err) {
    console.error("Error reading message.json:", err);
  }
  return reminders;
}

async function getMedicineWeatherText(reminder) {
  let finalMessage = reminder.message;

  // Check if we requested weather for this schedule
  if (reminder.includeWeather) {
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

        finalMessage += `\n\n(💡 台北今日平均溫度：${avgTemp}°C，降雨機率：${rainChance}%)`;
      } else {
        console.log("Failed to fetch weather after 3 attempts.");
      }
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
    }
  }

  return finalMessage;
}

async function processReminder(reminder) {
  try {
    let messagesToSend = [];

    // 1. Prepare Medicine + Weather payload
    if (reminder.includeMedicineReminder !== false) {
      const medicineText = await getMedicineWeatherText(reminder);
      if (medicineText) messagesToSend.push(medicineText);
    }

    // 2. Fetch and append Calendar features
    if (reminder.includeCalendarReminder) {
      const days = reminder.includeCalendarReminderDays || 4;
      const excludePast = reminder.excludePastCalendarEvents !== false;
      const excludeToday = reminder.excludeTodayCalendarEvents === true;
      const calendarText = await getUpcomingCalendarReminders(days, excludePast, excludeToday);
      if (calendarText && calendarText.trim()) {
        messagesToSend.push(calendarText.trim());
      }
    }

    if (messagesToSend.length > 0) {
      console.log(`Sending bundled messages (${messagesToSend.length} bubbles) via Messaging API...`);
      await pushMessageToAll(messagesToSend);
    }
  } catch (err) {
    console.error("Failed to process reminder:", err);
  }
}

// Backward-compatible HTTP Triggers for manual ping testing
app.get("/send-morning-reminder", async (req, res) => {
  try {
    const reminders = loadReminders();
    if (reminders.length > 0) await processReminder(reminders[0]);
    res.status(200).send("First reminder triggered manually.");
  } catch (error) {
    res.status(500).send("Failed to trigger reminder.");
  }
});

app.get("/send-evening-reminder", async (req, res) => {
  try {
    const reminders = loadReminders();
    if (reminders.length > 1) await processReminder(reminders[1]);
    res.status(200).send("Second reminder triggered manually.");
  } catch (error) {
    res.status(500).send("Failed to trigger reminder.");
  }
});

// Configure internal crons based on message.json
let cronJobs = [];

function scheduleCronJobs() {
  const reminders = loadReminders();

  // Stop all existing jobs
  cronJobs.forEach(job => job.stop());
  cronJobs = [];

  reminders.forEach((r, index) => {
    if (!r.time) return; // Skip if no time defined
    const [hour, minute] = r.time.split(":");

    let dayStr = "*";
    if (r.daysOfWeek && Array.isArray(r.daysOfWeek) && r.daysOfWeek.length > 0 && r.daysOfWeek.length < 7) {
      dayStr = r.daysOfWeek.join(",");
    }

    const job = cron.schedule(`${minute} ${hour} * * ${dayStr}`, async () => {
      console.log(`[CRON] Firing dynamic routine for index ${index} at ${r.time} on days ${dayStr}...`);
      await processReminder(r);
    }, { timezone: "Asia/Taipei" });

    cronJobs.push(job);
  });

  console.log(`[CRON] Scheduled ${cronJobs.length} active internal jobs (Asia/Taipei)`);
}

// Initial scheduling on boot
scheduleCronJobs();

// API ROUTES FOR FRONTEND DASHBOARD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

// Middleware to check password
function authenticateAPI(req, res, next) {
  const providedPassword = req.headers['x-admin-password'];
  if (providedPassword === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/config", authenticateAPI, (req, res) => {
  res.json({ reminders: loadReminders() });
});

app.post("/api/config", authenticateAPI, (req, res) => {
  try {
    const newConfig = req.body;
    if (!newConfig || !newConfig.reminders) {
      return res.status(400).json({ error: "Invalid payload format" });
    }

    const messagePath = path.join(__dirname, "..", "message.json");
    fs.writeFileSync(messagePath, JSON.stringify(newConfig, null, 4), "utf8");

    // Reschedule the internal node-cron jobs immediately
    scheduleCronJobs();

    res.json({ success: true, message: "Configuration saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

// BP Logs Helper Functions
function loadBpLogs() {
  const bpPath = path.join(__dirname, "..", "bp-logs.json");
  try {
    if (fs.existsSync(bpPath)) {
      const data = fs.readFileSync(bpPath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading bp-logs.json:", err);
  }
  return [];
}

function saveBpLogs(logs) {
  const bpPath = path.join(__dirname, "..", "bp-logs.json");
  fs.writeFileSync(bpPath, JSON.stringify(logs, null, 4), "utf8");
}

app.get("/api/bp", authenticateAPI, (req, res) => {
  res.json({ logs: loadBpLogs() });
});

app.post("/api/bp", authenticateAPI, (req, res) => {
  try {
    const { date, sys, dia, hr, weight } = req.body;
    if (!date || !sys || !dia) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const logs = loadBpLogs();
    const newLog = {
      id: Date.now().toString(),
      date,
      sys: Number(sys),
      dia: Number(dia),
      hr: hr ? Number(hr) : null,
      weight: weight ? Number(weight) : null
    };
    logs.push(newLog);
    // Sort by date descending
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveBpLogs(logs);
    res.json({ success: true, log: newLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save BP log" });
  }
});

app.delete("/api/bp/:id", authenticateAPI, (req, res) => {
  try {
    let logs = loadBpLogs();
    logs = logs.filter(l => l.id !== req.params.id);
    saveBpLogs(logs);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete BP log" });
  }
});

// ==========================================
// One-Off Reminders
// ==========================================
function loadOneOffReminders() {
  const oneoffPath = path.join(__dirname, "..", "oneoff-reminders.json");
  try {
    if (fs.existsSync(oneoffPath)) {
      const data = fs.readFileSync(oneoffPath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading oneoff-reminders.json:", err);
  }
  return [];
}

function saveOneOffReminders(reminders) {
  const oneoffPath = path.join(__dirname, "..", "oneoff-reminders.json");
  fs.writeFileSync(oneoffPath, JSON.stringify(reminders, null, 4), "utf8");
}

app.get("/api/oneoff", authenticateAPI, (req, res) => {
  const reminders = loadOneOffReminders();
  // Sort soonest first
  reminders.sort((a, b) => {
    const timeA = a.datetime.includes('+') || a.datetime.includes('Z') ? new Date(a.datetime) : new Date(a.datetime + '+08:00');
    const timeB = b.datetime.includes('+') || b.datetime.includes('Z') ? new Date(b.datetime) : new Date(b.datetime + '+08:00');
    return timeA - timeB;
  });
  res.json({ reminders });
});

app.post("/api/oneoff", authenticateAPI, (req, res) => {
  try {
    const { datetime, message } = req.body;
    if (!datetime || !message) {
      return res.status(400).json({ error: "Missing required fields (datetime, message)" });
    }
    const reminders = loadOneOffReminders();

    let absoluteDatetime = datetime;
    if (!absoluteDatetime.includes('+') && !absoluteDatetime.includes('Z')) {
      absoluteDatetime += "+08:00";
    }

    const newReminder = {
      id: Date.now().toString(),
      datetime: absoluteDatetime,
      message,
      createdAt: new Date().toISOString()
    };
    reminders.push(newReminder);
    saveOneOffReminders(reminders);
    res.json({ success: true, reminder: newReminder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save one-off reminder" });
  }
});

app.delete("/api/oneoff/:id", authenticateAPI, (req, res) => {
  try {
    let reminders = loadOneOffReminders();
    reminders = reminders.filter(r => r.id !== req.params.id);
    saveOneOffReminders(reminders);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete one-off reminder" });
  }
});

// Cron: check every minute for due one-off reminders
cron.schedule('* * * * *', async () => {
  const reminders = loadOneOffReminders();
  if (reminders.length === 0) return;

  const now = new Date();
  const due = [];
  const remaining = [];

  for (const r of reminders) {
    const rDate = r.datetime.includes('+') || r.datetime.includes('Z') ? new Date(r.datetime) : new Date(r.datetime + '+08:00');
    if (rDate <= now) {
      due.push(r);
    } else {
      remaining.push(r);
    }
  }

  if (due.length === 0) return;

  for (const r of due) {
    try {
      console.log(`[ONE-OFF] Sending reminder: ${r.message}`);
      await pushMessageToAll(`🔔 提醒：${r.message}`);
      console.log(`[ONE-OFF] Reminder sent and removed (id: ${r.id})`);
    } catch (err) {
      console.error(`[ONE-OFF] Failed to send reminder (id: ${r.id}):`, err.message);
    }
  }

  saveOneOffReminders(remaining);
}, { timezone: 'Asia/Taipei' });

// A lightweight ping endpoint to keep Render alive via GitHub Actions
app.get("/keep-alive", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
