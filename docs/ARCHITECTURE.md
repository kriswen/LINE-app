# LINE Bot Architecture Diagram

## System Overview

```mermaid
flowchart TB
    subgraph External["☁️ External Services"]
        LINE["LINE Platform"]
        GCAL["Google Calendar<br/>(iCal .ics Feed)"]
        WEATHER["Open-Meteo<br/>Weather API"]
        NGROK["ngrok Tunnel<br/>(ngrok-free.dev)"]
    end

    subgraph Vultr["🖥️ Vultr VPS"]
        subgraph Docker["🐳 Docker Container (my-line-bot)"]
            subgraph Server["Express Server (port 3000)"]
                INDEX["src/index.js<br/>─────────────<br/>• App entry point<br/>• Cron scheduler<br/>• API routes<br/>• Static file server"]
                BOT["src/bot.js<br/>─────────────<br/>• LINE webhook handler<br/>• pushMessageToAll()<br/>• Chat commands"]
                CAL["src/calendar.js<br/>─────────────<br/>• iCal feed parser<br/>• Recurring event logic<br/>• Timezone handling"]
            end

            subgraph Frontend["📱 Frontend Dashboard (public/)"]
                HTML["index.html<br/>─────────────<br/>• Login screen<br/>• Tab layout"]
                APPJS["app.js<br/>─────────────<br/>• Auth logic<br/>• Reminder CRUD<br/>• BP log CRUD"]
                CSS["style.css<br/>─────────────<br/>• LINE green theme<br/>• Responsive design"]
            end

            subgraph Data["💾 JSON Data Files (Volume Mounted)"]
                MSG["message.json<br/>Scheduled reminder config"]
                SUBS["subs.json<br/>Subscriber chat IDs"]
                BP["bp-logs.json<br/>Blood pressure logs"]
                ONEOFF["oneoff-reminders.json<br/>One-off reminders"]
            end
        end

        SYSTEMD["systemd service<br/>(ngrok.service)"]
    end

    subgraph GitHub["🐙 GitHub Actions"]
        DEPLOY["deploy.yml<br/>─────────────<br/>• SSH into Vultr<br/>• Backup JSON files<br/>• git pull<br/>• Restore JSON files<br/>• Docker rebuild"]
    end

    LINE <-->|"Webhook POST /webhook<br/>+ Push API"| NGROK
    NGROK <-->|"Port 4000 → 3000"| Server
    GCAL -->|"HTTP fetch .ics"| CAL
    WEATHER -->|"HTTP REST API"| INDEX
    WEATHER -->|"HTTP REST API"| BOT
    SYSTEMD -->|"Manages tunnel"| NGROK

    INDEX --> BOT
    INDEX --> CAL
    INDEX -->|"Read/Write"| MSG
    INDEX -->|"Read/Write"| BP
    INDEX -->|"Read/Write"| ONEOFF
    BOT -->|"Read/Write"| SUBS
    HTML --> APPJS
    HTML --> CSS
    APPJS -->|"fetch() API calls"| INDEX

    DEPLOY -->|"SSH deploy"| Vultr
```

## Request Flow

```mermaid
sequenceDiagram
    participant U as LINE User
    participant L as LINE Platform
    participant N as ngrok Tunnel
    participant E as Express Server
    participant B as bot.js

    U->>L: Send message
    L->>N: POST /webhook
    N->>E: Forward to port 3000
    E->>B: Route to handleEvent()

    alt "今日天氣" command
        B->>B: Fetch Open-Meteo API
        B->>L: Reply with weather
    else "近期行程" command
        B->>B: Call getUpcomingCalendarReminders()
        B->>L: Reply with events
    else "register" command
        B->>B: Save to subs.json
        B->>L: Reply confirmation
    else "設定" command
        B->>L: Reply with dashboard URL
    end

    L->>U: Display reply
```

## Scheduled Reminder Flow

```mermaid
sequenceDiagram
    participant C as node-cron
    participant I as index.js
    participant B as bot.js
    participant W as Open-Meteo API
    participant G as Google Calendar
    participant L as LINE Platform

    C->>I: Cron triggers at scheduled time
    I->>I: processReminder(reminder)

    alt includeMedicineReminder
        opt includeWeather
            I->>W: Fetch today's weather
            W-->>I: Temperature & rain data
        end
        I->>B: pushMessageToAll(message)
        B->>L: Push to all subscribers
    end

    alt includeCalendarReminder
        I->>G: Fetch iCal feed
        G-->>I: Calendar events
        I->>I: Filter upcoming events
        I->>B: pushMessageToAll(calendarText)
        B->>L: Push to all subscribers
    end
```

## Dashboard UI Flow

```mermaid
sequenceDiagram
    participant U as Admin User
    participant D as Dashboard (browser)
    participant A as API Routes (index.js)
    participant F as JSON Files

    U->>D: Open dashboard URL
    D->>D: Show login screen
    U->>D: Enter admin password
    D->>A: GET /api/config (x-admin-password header)
    A->>A: authenticateAPI() middleware
    A->>F: Read message.json
    F-->>A: Reminder config
    A-->>D: JSON response
    D->>D: Show dashboard with tabs

    alt Reminders Tab
        U->>D: Edit reminder settings
        U->>D: Click "Save Changes"
        D->>A: POST /api/config
        A->>F: Write message.json
        A->>A: scheduleCronJobs() (reschedule)
        A-->>D: Success
    end

    alt One-Off Reminders Tab
        U->>D: Create one-off reminder
        D->>A: POST /api/oneoff
        A->>F: Write oneoff-reminders.json
        A-->>D: Success + refresh list
    end

    alt BP/Weight Logs Tab
        U->>D: Enter BP readings
        D->>A: POST /api/bp
        A->>F: Write bp-logs.json
        A-->>D: Success + refresh table
    end
```

## Deployment Pipeline

```mermaid
flowchart LR
    A["Push to<br/>main branch"] --> B["GitHub Actions<br/>triggered"]
    B --> C["SSH into Vultr"]
    C --> D["Backup JSON files<br/>to /tmp/"]
    D --> E["git fetch + reset<br/>to origin/main"]
    E --> F["Restore JSON files<br/>from /tmp/"]
    F --> G["Remove old<br/>Docker container"]
    G --> H["docker build<br/>new image"]
    H --> I["docker run<br/>with volume mounts<br/>+ env vars"]
    I --> J["✅ Bot live on<br/>port 4000"]
```

## File Structure

```
LINE-Notify/
├── src/
│   ├── index.js          # Express server, cron jobs, API routes
│   ├── bot.js            # LINE webhook handler, push messaging
│   └── calendar.js       # Google Calendar iCal feed parser
├── public/
│   ├── index.html        # Dashboard HTML (login + tabs)
│   ├── app.js            # Dashboard frontend logic
│   └── style.css         # LINE green themed styles
├── .github/
│   └── workflows/
│       └── deploy.yml    # Auto-deploy to Vultr via SSH
├── message.json          # Reminder schedules config (volume mounted)
├── subs.json             # Subscriber IDs (volume mounted)
├── bp-logs.json          # Blood pressure logs (volume mounted)
├── oneoff-reminders.json # One-off reminders (volume mounted)
├── Dockerfile            # Node 20 Alpine container
├── package.json          # Dependencies & scripts
└── .env                  # Local env vars (not deployed)
```
