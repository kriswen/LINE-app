# LINE Reminder Bot - Cloudflare Workers Migration

This is the Cloudflare Workers + D1 migration of the original LINE Medicine & Calendar Reminder Bot.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Cloudflare Worker                    │
│                                                  │
│  • fetch() handler - Webhook, API, Static assets │
│  • scheduled() handler - Cron triggers           │
│                                                  │
│  Bindings:                                       │
│  • DB (D1 Database)                              │
│  • ASSETS (Static files)                         │
│  • Secrets (LINE credentials, Admin password)    │
└────────────────────────┬─────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │   D1      │   │ Open-Meteo│   │ Google Cal│
   │ Database  │   │  Weather  │   │  .ics     │
   └───────────┘   └───────────┘   └───────────┘
```

## Prerequisites

- Node.js 20+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)
- LINE Developer Console account
- Google Calendar with public iCal feed

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
# Create the database (run once)
npm run d1:create

# Apply migrations locally
npm run d1:migrate:local

# Apply migrations to remote (production)
npm run d1:migrate:remote
```

### 3. Configure Secrets

```bash
# Set LINE credentials
wrangler secret put CHANNEL_ACCESS_TOKEN
wrangler secret put CHANNEL_SECRET
wrangler secret put GROUP_ID
wrangler secret put CALENDAR_URL

# Set admin password hash (SHA-256)
# Generate with: echo -n "your_password" | sha256sum
wrangler secret put ADMIN_PASSWORD_HASH

# Set dashboard URL
wrangler secret put DASHBOARD_URL
```

### 4. Local Development

Create `.dev.vars` from the example:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your values
```

Start the dev server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:8787/`.

Run the automated Worker, D1, and dashboard security tests with:

```bash
npm test
```

Test the webhook endpoint:
```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{"events":[]}'
```

### 5. Deploy to Production

```bash
# Apply pending production D1 migrations first
npm run d1:migrate:remote

# Deploy the Worker and static assets
npm run deploy
```

## Migration from Old Version

### 1. Export Data from Vultr

On your Vultr VPS, copy the JSON files:
```bash
scp user@vultr:~/LINE-app/{message.json,subs.json,bp-logs.json,oneoff-reminders.json} ./
```

### 2. Import Data into D1

```bash
# Generate migration SQL
node scripts/import-data.js > import-data.sql

# Apply to remote D1
wrangler d1 execute line-reminder-db --remote --file import-data.sql
```

### 3. Update LINE Webhook URL

In LINE Developer Console, change the webhook URL to:
```
https://your-worker.your-subdomain.workers.dev/webhook
```

### 4. Verify

1. Test webhook by sending "今日天氣" to the bot
2. Check dashboard at `https://your-worker.your-subdomain.workers.dev/`
3. Verify scheduled reminders work (Cron runs every minute)

## Project Structure

```
line-app-migration/
├── worker/
│   ├── index.js              # Worker entry point
│   ├── routes/
│   │   ├── webhook.js        # LINE webhook handler
│   │   ├── config.js         # Reminder config API
│   │   ├── bp.js             # BP logs API
│   │   └── oneoff.js         # One-off reminders API
│   ├── handlers/
│   │   └── scheduled.js      # Cron trigger handler
│   ├── db/
│   │   ├── subscribers.js
│   │   ├── reminder-routines.js
│   │   ├── bp-logs.js
│   │   ├── oneoff-reminders.js
│   │   └── delivery-log.js
│   ├── utils/
│   │   ├── line.js           # Signature verification
│   │   ├── line-api.js       # LINE API client
│   │   ├── weather.js        # Open-Meteo client
│   │   ├── calendar.js       # iCal parser
│   │   └── timezone.js       # Asia/Taipei helpers
│   └── middleware/
│       └── auth.js           # Admin authentication
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_delivery_idempotency.sql
│   └── 0003_oneoff_error_message.sql
├── public/
│   ├── index.html            # Dashboard HTML
│   ├── app.js                # Dashboard JS
│   └── style.css             # Dashboard CSS
├── scripts/
│   └── import-data.js        # Data migration script
├── wrangler.jsonc            # Wrangler configuration
├── package.json
├── .dev.vars.example
└── README.md
```

## Key Differences from Original

| Feature | Original (Vultr) | Cloudflare Workers |
|---------|------------------|-------------------|
| Runtime | Node.js + Express | Workers Runtime + Hono |
| Scheduling | node-cron | Cloudflare Cron Triggers |
| Storage | JSON files | D1 (SQLite) |
| Deployment | Docker + SSH | `wrangler deploy` |
| Static Assets | Express static | Worker Static Assets |
| Scaling | Manual | Automatic |
| Cost | VPS monthly | Free tier likely sufficient |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | LINE webhook (public) |
| GET | `/` | Dashboard UI |
| GET | `/api/config` | Get reminder config (auth) |
| POST | `/api/config` | Save reminder config (auth) |
| GET | `/api/bp` | Get BP logs (auth) |
| POST | `/api/bp` | Create BP log (auth) |
| DELETE | `/api/bp/:id` | Delete BP log (auth) |
| GET | `/api/oneoff` | Get one-off reminders (auth) |
| POST | `/api/oneoff` | Create one-off reminder (auth) |
| DELETE | `/api/oneoff/:id` | Delete one-off reminder (auth) |
| GET | `/keep-alive` | Health check |

## Scheduled Reminders

The Cron Trigger runs every minute (`* * * * *`). The scheduled handler:

1. Checks for routine reminders matching current Taipei time
2. Checks for pending one-off reminders due now
3. Fetches weather/calendar data only when needed
4. Sends messages via LINE Messaging API
5. Logs delivery status to D1

## Dashboard Features

- **Reminders Tab**: Configure routine reminders (time, days, message, weather, calendar)
- **One-Off Tab**: Create one-time reminders with datetime picker
- **BP/Weight Logs Tab**: Log and view blood pressure/weight history
- Password-protected with SHA-256 hashed password

## Free Tier Limits

| Resource | Free Limit | Expected Usage |
|----------|------------|----------------|
| Worker Requests | 100,000/day | ~1,500/day |
| Worker CPU | 10ms/invocation | <5ms typical |
| D1 Reads | 5M rows/day | ~1,000/day |
| D1 Writes | 100K rows/day | ~100/day |
| D1 Storage | 5 GB | <1 MB |
| Cron Triggers | Included | 1,440/day |

## Troubleshooting

### Worker CPU Limit Exceeded

If calendar parsing exceeds CPU limit:
- Reduce `calendar_days` in reminder config
- Use Google Calendar API instead of iCal
- Cache parsed calendar events in D1

### Webhook Signature Verification Fails

- Ensure `CHANNEL_SECRET` is correctly set in secrets
- Check that raw request body is used for verification
- Verify LINE Developer Console webhook URL matches

### D1 Migration Issues

```bash
# Check migration status
wrangler d1 migrations list line-reminder-db --remote

# View database contents
wrangler d1 execute line-reminder-db --remote --command "SELECT * FROM reminder_routines"
```

### Dashboard Not Loading

- Check `assets.directory` in `wrangler.jsonc` points to `public`
- Verify static asset routes in `worker/index.js`

## License

MIT