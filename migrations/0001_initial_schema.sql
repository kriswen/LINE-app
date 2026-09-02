-- Initial schema for LINE Reminder Bot
-- Migration: 0001_initial_schema

-- Reminder routines (scheduled reminders)
CREATE TABLE IF NOT EXISTS reminder_routines (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,                    -- "HH:MM" format in Asia/Taipei
  days_of_week TEXT NOT NULL,            -- JSON array: [0,1,2,3,4,5,6] (0=Sunday)
  message TEXT NOT NULL,
  include_medicine INTEGER NOT NULL DEFAULT 1,
  include_weather INTEGER NOT NULL DEFAULT 0,
  include_calendar INTEGER NOT NULL DEFAULT 0,
  calendar_days INTEGER NOT NULL DEFAULT 4,
  exclude_past_events INTEGER NOT NULL DEFAULT 1,
  exclude_today_events INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Subscribers (LINE chats that receive reminders)
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  line_target_id TEXT NOT NULL UNIQUE,   -- groupId, roomId, or userId
  target_type TEXT NOT NULL,             -- 'group', 'room', 'user'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Blood pressure logs
CREATE TABLE IF NOT EXISTS bp_logs (
  id TEXT PRIMARY KEY,
  measured_date TEXT NOT NULL,           -- YYYY-MM-DD in Asia/Taipei
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  heart_rate INTEGER,
  weight REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- One-off reminders
CREATE TABLE IF NOT EXISTS oneoff_reminders (
  id TEXT PRIMARY KEY,
  scheduled_at TEXT NOT NULL,            -- ISO 8601 datetime in UTC
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Delivery log (audit trail for LINE message deliveries)
CREATE TABLE IF NOT EXISTS delivery_log (
  id TEXT PRIMARY KEY,
  reminder_type TEXT NOT NULL,           -- 'routine', 'oneoff'
  reminder_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,           -- ISO 8601 datetime when reminder was due
  subscriber_id TEXT NOT NULL,
  status TEXT NOT NULL,                  -- 'success', 'failed', 'skipped'
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reminder_routines_enabled ON reminder_routines(enabled) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_bp_logs_date ON bp_logs(measured_date DESC);
CREATE INDEX IF NOT EXISTS idx_oneoff_status_scheduled ON oneoff_reminders(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_delivery_log_reminder ON delivery_log(reminder_type, reminder_id, scheduled_for);

-- Trigger to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS trigger_reminder_routines_updated
AFTER UPDATE ON reminder_routines
BEGIN
  UPDATE reminder_routines SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_subscribers_updated
AFTER UPDATE ON subscribers
BEGIN
  UPDATE subscribers SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;