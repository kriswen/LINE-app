// Migration script to import existing JSON data into D1
// Usage: wrangler d1 execute line-reminder-db --remote --file migrations/import-data.sql
// Or run with: node scripts/import-data.js (after installing dependencies)

import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client'; // For local testing with libsql
// Note: For actual migration, use wrangler d1 commands or the Cloudflare dashboard

const DATA_DIR = path.join(process.cwd(), '..'); // Root of the old project

// Helper to read JSON files
function readJsonFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return null;
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
        `INSERT OR IGNORE INTO subscribers (id, line_target_id, target_type, active, created_at, updated_at) VALUES ('${id}', '${targetId.replace(/'/g, "''")}', 'group', 1, datetime('now', 'utc'), datetime('now', 'utc'));`
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
      const message = (reminder.message || '').replace(/'/g, "''");
      const includeMedicine = reminder.includeMedicineReminder !== false ? 1 : 0;
      const includeWeather = reminder.includeWeather === true ? 1 : 0;
      const includeCalendar = reminder.includeCalendarReminder === true ? 1 : 0;
      const calendarDays = reminder.includeCalendarReminderDays || 4;
      const excludePast = reminder.excludePastCalendarEvents !== false ? 1 : 0;
      const excludeToday = reminder.excludeTodayCalendarEvents === true ? 1 : 0;
      const enabled = 1;

      sql.push(
        `INSERT INTO reminder_routines (id, time, days_of_week, message, include_medicine, include_weather, include_calendar, calendar_days, exclude_past_events, exclude_today_events, enabled, created_at, updated_at) VALUES ('${id}', '${time}', '${JSON.stringify(daysOfWeek)}', '${message}', ${includeMedicine}, ${includeWeather}, ${includeCalendar}, ${calendarDays}, ${excludePast}, ${excludeToday}, ${enabled}, datetime('now', 'utc'), datetime('now', 'utc'));`
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
      const sys = log.sys || log.systolic;
      const dia = log.dia || log.diastolic;
      const hr = log.hr || log.heart_rate;
      const weight = log.weight;

      if (date && sys && dia) {
        sql.push(
          `INSERT INTO bp_logs (id, measured_date, systolic, diastolic, heart_rate, weight, created_at) VALUES ('${id}', '${date}', ${sys}, ${dia}, ${hr || 'NULL'}, ${weight || 'NULL'}, datetime('now', 'utc'));`
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
      const message = (reminder.message || '').replace(/'/g, "''");
      const status = reminder.status || 'pending';
      const attempts = reminder.attempts || 0;
      const lastAttemptAt = reminder.last_attempt_at || reminder.lastAttemptAt;
      const sentAt = reminder.sent_at || reminder.sentAt;
      const createdAt = reminder.created_at || reminder.createdAt || new Date().toISOString();

      if (scheduledAt && message) {
        let lastAttemptSql = 'NULL';
        if (lastAttemptAt) {
          lastAttemptSql = `'${lastAttemptAt}'`;
        }
        let sentAtSql = 'NULL';
        if (sentAt) {
          sentAtSql = `'${sentAt}'`;
        }

        sql.push(
          `INSERT INTO oneoff_reminders (id, scheduled_at, message, status, attempts, last_attempt_at, sent_at, created_at) VALUES ('${id}', '${scheduledAt}', '${message}', '${status}', ${attempts}, ${lastAttemptSql}, ${sentAtSql}, '${createdAt}');`
        );
      }
    }
  }

  return sql.join('\n');
}

// For direct Node.js execution with wrangler
async function runMigration() {
  console.log('Generating migration SQL...');
  const sql = generateMigrationSQL();
  console.log(sql);
  console.log('\n---');
  console.log('To apply this migration:');
  console.log('1. Save the above SQL to a file (e.g., import-data.sql)');
  console.log('2. Run: wrangler d1 execute line-reminder-db --remote --file import-data.sql');
}

// Export for module usage
export { generateMigrationSQL, runMigration };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}