// One-off Reminders API routes for dashboard

import { Hono } from 'hono';
import { authenticateAdmin } from '../middleware/auth.js';
import { getOneOffReminders, createOneOffReminder, deleteOneOffReminder } from '../db/oneoff-reminders.js';

export const oneoffRoutes = new Hono();

oneoffRoutes.use('*', authenticateAdmin);

oneoffRoutes.get('/', async (c) => {
  const reminders = await getOneOffReminders(c.env.DB);
  return c.json({ reminders });
});

oneoffRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { datetime, message } = body;

    if (typeof datetime !== 'string' || typeof message !== 'string' || !message.trim()) {
      return c.json({ error: 'Missing required fields (datetime, message)' }, 400);
    }

    // datetime-local values have no offset; the dashboard operates in Taipei time.
    const hasTimezone = /[+-]\d{2}:\d{2}|Z$/.test(datetime);
    const normalized = hasTimezone ? datetime : `${datetime}+08:00`;
    const scheduledAt = new Date(normalized);
    if (!Number.isFinite(scheduledAt.getTime())) {
      return c.json({ error: 'Invalid datetime.' }, 400);
    }
    // Reject impossible calendar dates such as February 30 that silently roll over.
    const formatMatch = datetime.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-]\d{2}:\d{2}|Z)?$/
    );
    if (!formatMatch) {
      return c.json({ error: 'Invalid datetime format.' }, 400);
    }
    const [, y, mo, d, h, mi, s = '00', tz] = formatMatch;
    // For datetime-local strings we effectively parsed them as Taipei (+08:00).
    const effectiveOffsetMinutes = !hasTimezone
      ? 480
      : tz === 'Z'
        ? 0
        : (tz.startsWith('-') ? -1 : 1) * (parseInt(tz.slice(1, 3)) * 60 + parseInt(tz.slice(4, 6)));
    // scheduledAt already represents the UTC moment; add the offset back to recover the original wall-clock components and verify they round-trip.
    const asUtc = new Date(scheduledAt.getTime() + effectiveOffsetMinutes * 60000);
    if (
      asUtc.getUTCFullYear() !== parseInt(y) ||
      asUtc.getUTCMonth() + 1 !== parseInt(mo) ||
      asUtc.getUTCDate() !== parseInt(d) ||
      asUtc.getUTCHours() !== parseInt(h) ||
      asUtc.getUTCMinutes() !== parseInt(mi) ||
      asUtc.getUTCSeconds() !== parseInt(s)
    ) {
      return c.json({ error: 'Invalid calendar date.' }, 400);
    }
    if (scheduledAt <= new Date()) {
      return c.json({ error: 'Please select a future date and time.' }, 400);
    }

    const id = await createOneOffReminder(c.env.DB, {
      datetime: scheduledAt.toISOString(),
      message: message.trim(),
    });
    const reminders = await getOneOffReminders(c.env.DB);
    const newReminder = reminders.find((r) => r.id === id);

    return c.json({ success: true, reminder: newReminder });
  } catch (error) {
    console.error('One-off reminder creation error:', error);
    return c.json({ error: 'Failed to save one-off reminder' }, 500);
  }
});

oneoffRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteOneOffReminder(c.env.DB, id);
    return c.json({ success: true });
  } catch (error) {
    console.error('One-off reminder deletion error:', error);
    return c.json({ error: 'Failed to delete reminder' }, 500);
  }
});