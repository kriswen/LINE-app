// Config API routes for dashboard

import { Hono } from 'hono';
import { authenticateAdmin } from '../middleware/auth.js';
import { getAllReminderRoutines, replaceAllReminderRoutines } from '../db/reminder-routines.js';

export const configRoutes = new Hono();

configRoutes.use('*', authenticateAdmin);

configRoutes.get('/', async (c) => {
  const reminders = await getAllReminderRoutines(c.env.DB);
  return c.json({ reminders });
});

configRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!body || !Array.isArray(body.reminders) || body.reminders.length === 0) {
      return c.json({ error: 'Invalid payload format' }, 400);
    }

    const invalidIndex = body.reminders.findIndex((reminder) => !isValidReminder(reminder));
    if (invalidIndex !== -1) {
      return c.json({ error: `Invalid reminder at index ${invalidIndex}` }, 400);
    }

    await replaceAllReminderRoutines(c.env.DB, body.reminders);
    return c.json({ success: true, message: 'Configuration saved successfully!' });
  } catch (error) {
    console.error('Config save error:', error);
    return c.json({ error: 'Failed to save configuration' }, 500);
  }
});

function isValidReminder(reminder) {
  if (!reminder || typeof reminder !== 'object') return false;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) return false;
  if (
    !Array.isArray(reminder.daysOfWeek) ||
    reminder.daysOfWeek.length === 0 ||
    reminder.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    return false;
  }
  if (typeof reminder.message !== 'string') return false;
  if (typeof reminder.includeMedicineReminder !== 'boolean' && reminder.includeMedicineReminder !== undefined) return false;
  if (reminder.includeMedicineReminder !== false && !reminder.message.trim()) return false;
  if (typeof reminder.includeWeather !== 'boolean' && reminder.includeWeather !== undefined) return false;
  if (typeof reminder.includeCalendarReminder !== 'boolean' && reminder.includeCalendarReminder !== undefined) return false;
  if (typeof reminder.excludePastCalendarEvents !== 'boolean' && reminder.excludePastCalendarEvents !== undefined) return false;
  if (typeof reminder.excludeTodayCalendarEvents !== 'boolean' && reminder.excludeTodayCalendarEvents !== undefined) return false;

  const calendarDays = reminder.includeCalendarReminderDays ?? 4;
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 14) return false;
  return true;
}