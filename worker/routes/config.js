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
    if (!body || !Array.isArray(body.reminders)) {
      return c.json({ error: 'Invalid payload format' }, 400);
    }

    await replaceAllReminderRoutines(c.env.DB, body.reminders);
    return c.json({ success: true, message: 'Configuration saved successfully!' });
  } catch (error) {
    console.error('Config save error:', error);
    return c.json({ error: 'Failed to save configuration' }, 500);
  }
});