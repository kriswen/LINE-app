# LINE Medicine & Calendar Reminder Bot (Messaging API)

This application sends automated, highly configurable medicine reminders, weather forecasts, and calendar event schedules to a LINE Chat using the modern **LINE Messaging API**.

*Note: This application has been entirely redesigned. It was migrated from the deprecated LINE Notify service to the official LINE Messaging API, and it now utilizes external HTTP chron triggers instead of keeping the server awake 24/7.*

## Project Structure

```
LINE-Notify/
├── src/              # Core application code (index.js, bot.js, calendar.js)
├── public/           # Web dashboard (HTML, CSS, JS)
├── scripts/          # Utility scripts (send-now, setup_rich_menu, debug_cal)
├── sandbox/          # Ad-hoc test/debug scripts
├── assets/           # Rich menu images
├── docs/             # Architecture docs & deploy guides
├── .github/workflows # CI/CD & scheduled triggers
├── message.json      # Reminder config (auto-created, gitignored)
├── subs.json         # Subscriber list (auto-created, gitignored)
├── bp-logs.json      # Blood pressure logs (auto-created, gitignored)
└── oneoff-reminders.json # One-off reminders (auto-created, gitignored)
```

> **Note:** The `.json` data files above are auto-created at runtime — you don't need to create them manually. See the `*.example.json` files in the project root for the expected formats.

## Overview

1. You create a Bot on the [LINE Developer Console](https://developers.line.biz/console/).
2. You configure the Bot's Webhook URL to point to this application's `/webhook` route.
3. You invite the Bot to your family group chat.
4. When the Bot is invited, it automatically saves the `Chat ID` to a local `subs.json` file.
5. GitHub Actions workflows automatically hit your server's `/send-morning-reminder` or `/send-evening-reminder` endpoints at scheduled times.
6. The bot reads your `message.json` preferences and pushes the tailored message to the chat!

## Prerequisites

1. Create a LINE Official Account and get your **Channel Secret** and **Channel Access Token** from the [LINE Developer Console](https://developers.line.biz/console/).
2. **Important**: By default, LINE bots are not allowed to join group chats. In your LINE Official Account Manager (under **Settings > Account details > Features**), you must change **Allow bot to join group chats** to "Enabled".
3. Add a public Google Calendar `Secret address in iCal format` (.ics link) to fetch events.

## Setup Instructions

### 1. Configure the Environment
Create a `.env` file in the project root and add your credentials:
```env
CHANNEL_ACCESS_TOKEN="YOUR_CHANNEL_ACCESS_TOKEN"
CHANNEL_SECRET="YOUR_CHANNEL_SECRET"
GROUP_ID="YOUR_LINE_GROUP_ID"
CALENDAR_ID="YOUR_CALENDAR_ID@group.calendar.google.com"
```

### 2. Configure the Reminder Messages
Edit the `message.json` file at the root of the project to customize the specific messages and features the bot will send (see `message.example.json` for the expected format):
```json
{
    "reminders": [
        {
            "message": "早安！這是早上 9 點的吃藥提醒！",
            "includeMedicineReminder": true,
            "includeWeather": true,
            "includeCalendarReminder": true,
            "includeCalendarReminderDays": 4
        },
        {
            "message": "晚安！這是晚上 9 點的吃藥提醒！"
        }
    ]
}
```
* **includeMedicineReminder**: Set to `false` to disable the main medicine text.
* **includeWeather**: Set to `true` to fetch and append the daily Taipei average temperature and rain chance.
* **includeCalendarReminder**: Set to `true` to fetch upcoming events via your `CALENDAR_ID`.
* **includeCalendarReminderDays**: The number of days (including today) to fetch calendar events for.

### 3. Install & Run the Server Local Testing
Install dependencies and run the local test script to verify your `message.json` payload without relying on the web server:
```bash
npm install
node scripts/send-now.js
```

### 4. Deploy to Render.com (Free Hosting)

This application is designed to be hosted on Render.com's Free Tier.

1. Go to [Render](https://dashboard.render.com).
2. Connect your GitHub account and create a new **Web Service** using this repository.
3. In the Render Dashboard, add your **Environment Variables**:
    * `CHANNEL_ACCESS_TOKEN`
    * `CHANNEL_SECRET`
    * `GROUP_ID`
    * `CALENDAR_ID`
4. Render will automatically launch the web server.

### 5. Setup the External Triggers (GitHub Actions)
Because Render's free tier sleeps after 15 minutes of inactivity, we removed the internal node chron timers. Instead, this repository uses **GitHub Actions** to automatically wake the server up and trigger the messages.

1. Go to the **Actions** tab in your GitHub Repository.
2. You will see three baked-in workflows:
   * **Wake Up Render Server**: Pings the server at 8:55 AM and 8:55 PM (Taipei Time) to force it to wake up before the heavy calendar processing starts.
   * **Trigger Morning Reminder**: Hits `/send-morning-reminder` at exactly 9:00 AM.
   * **Trigger Evening Reminder**: Hits `/send-evening-reminder` at exactly 9:00 PM.
3. Because these actions are already in the `.github/workflows` folder, GitHub will automatically run them on schedule! No extra setup is required.

Whenever GitHub Actions hits those URLs, your bot wakes up, compiles the required data, and sends the LINE message to your family group!
