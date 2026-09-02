// Migration script to import existing JSON data into D1
// Usage: wrangler d1 execute line-reminder-db --remote --file migrations/import-data.sql
// Or run with: node scripts/import-data.js (after installing dependencies)

import fs from 'fs';
import path from 'path';

const DATA_DIR = process.cwd();

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value, label, { nullable = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (nullable && (value === undefined || value === null || value === '')) return 'NULL';
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`Invalid ${label}: expected an integer from ${min} to ${max}`);
  }
  return String(number);
}

function sqlNumber(value, label, { nullable = false, min = 0 } = {}) {
  if (nullable && (value === undefined || value === null || value === '')) return 'NULL';
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new Error(`Invalid ${label}: expected a finite number greater than or equal to ${min}`);
  }
  return String(number);
}

// Helper to read JSON files
function readJsonFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Error reading ${filename}: ${error.message}`, { cause: error });
  }
}

// Generate SQL INSERT statements
function generateMigrationSQL() {
  const sql = [];

  // Import subscribers
  const subs = readJsonFile('subs.json');
  if (subs && Array.isArray(subs) && subs.length > 0) {
    sql.push('-- Subscribers');
    for (const targetId of subs) {
      const id = crypto.randomUUID();
      sql.push(
        `INSERT OR IGNORE INTO subscribers (id, line_target_id, target_type, active, created_at, updated_at) VALUES (${sqlString(id)}, ${sqlString(targetId)}, 'group', 1, datetime('now', 'utc'), datetime('now', 'utc'));`
      );
    }
  }

  // Import reminder routines from message.json
  const messageConfig = readJsonFile('message.json');
  if (messageConfig && messageConfig.reminders && Array.isArray(messageConfig.reminders)) {
    sql.push('\n-- Reminder Routines');
    for (const reminder of messageConfig.reminders) {
      const id = crypto.randomUUID();
      const time = reminder.time || '09:00';
      const daysOfWeek = reminder.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      const message = reminder.message || '';
      const includeMedicine = reminder.includeMedicineReminder !== false ? 1 : 0;
      const includeWeather = reminder.includeWeather === true ? 1 : 0;
      const includeCalendar = reminder.includeCalendarReminder === true ? 1 : 0;
      const calendarDays = sqlInteger(
        reminder.includeCalendarReminderDays || 4,
        'calendar days',
        { min: 1, max: 14 }
      );
      const excludePast = reminder.excludePastCalendarEvents !== false ? 1 : 0;
      const excludeToday = reminder.excludeTodayCalendarEvents === true ? 1 : 0;
      const enabled = 1;

      sql.push(
        `INSERT INTO reminder_routines (id, time, days_of_week, message, include_medicine, include_weather, include_calendar, calendar_days, exclude_past_events, exclude_today_events, enabled, created_at, updated_at) VALUES (${sqlString(id)}, ${sqlString(time)}, ${sqlString(JSON.stringify(daysOfWeek))}, ${sqlString(message)}, ${includeMedicine}, ${includeWeather}, ${includeCalendar}, ${calendarDays}, ${excludePast}, ${excludeToday}, ${enabled}, datetime('now', 'utc'), datetime('now', 'utc'));`
      );
    }
  }

  // Import BP logs
  const bpLogs = readJsonFile('bp-logs.json');
  if (bpLogs && Array.isArray(bpLogs) && bpLogs.length > 0) {
    sql.push('\n-- BP Logs');
    for (const log of bpLogs) {
      const id = log.id || crypto.randomUUID();
      const date = log.date;
      const rawSys = log.sys ?? log.systolic;
      const rawDia = log.dia ?? log.diastolic;
      const rawHr = log.hr ?? log.heart_rate;
      const hasMeasurement = [rawSys, rawDia, rawHr, log.weight].some(
        (value) => value !== undefined && value !== null && value !== ''
      );

      if (date && hasMeasurement) {
        const sys = sqlInteger(rawSys, 'systolic', { nullable: true, min: 1 });
        const dia = sqlInteger(rawDia, 'diastolic', { nullable: true, min: 1 });
        const hr = sqlInteger(rawHr, 'heart rate', {
          nullable: true,
          min: 1,
        });
        const weight = sqlNumber(log.weight, 'weight', { nullable: true, min: 0 });
        sql.push(
          `INSERT INTO bp_logs (id, measured_date, systolic, diastolic, heart_rate, weight, created_at) VALUES (${sqlString(id)}, ${sqlString(date)}, ${sys}, ${dia}, ${hr}, ${weight}, datetime('now', 'utc'));`
        );
      }
    }
  }

  // Import one-off reminders
  const oneOff = readJsonFile('oneoff-reminders.json');
  if (oneOff && Array.isArray(oneOff) && oneOff.length > 0) {
    sql.push('\n-- One-off Reminders');
    for (const reminder of oneOff) {
      const id = reminder.id || crypto.randomUUID();
      const scheduledAt = reminder.datetime || reminder.scheduled_at;
      const message = reminder.message || '';
      const status = reminder.status || 'pending';
      const attempts = sqlInteger(reminder.attempts || 0, 'attempts');
      const lastAttemptAt = reminder.last_attempt_at || reminder.lastAttemptAt;
      const sentAt = reminder.sent_at || reminder.sentAt;
      const createdAt = reminder.created_at || reminder.createdAt || new Date().toISOString();

      if (scheduledAt && message) {
        let lastAttemptSql = 'NULL';
        if (lastAttemptAt) {
          lastAttemptSql = sqlString(lastAttemptAt);
        }
        let sentAtSql = 'NULL';
        if (sentAt) {
          sentAtSql = sqlString(sentAt);
        }

        sql.push(
          `INSERT INTO oneoff_reminders (id, scheduled_at, message, status, attempts, last_attempt_at, sent_at, created_at) VALUES (${sqlString(id)}, ${sqlString(scheduledAt)}, ${sqlString(message)}, ${sqlString(status)}, ${attempts}, ${lastAttemptSql}, ${sentAtSql}, ${sqlString(createdAt)});`
        );
      }
    }
  }

  return sql.join('\n');
}

// For direct Node.js execution with wrangler
async function runMigration() {
  const sql = generateMigrationSQL();
  console.log(sql);
}

// Export for module usage
export { generateMigrationSQL, runMigration };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}