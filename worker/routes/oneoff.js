// One-off Reminders API routes for dashboard

import { Hono } from 'hono';
import { authenticateAdmin } from '../middleware/auth.js';
import { getOneOffReminders, getPendingOneOffReminders, createOneOffReminder, updateOneOffReminderStatus, deleteOneOffReminder } from '../db/oneoff-reminders.js';

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

    if (!datetime || !message) {
      return c.json({ error: 'Missing required fields (datetime, message)' }, 400);
    }

    // Validate that the time is in the future
    if (new Date(datetime) <= new Date()) {
      return c.json({ error: 'Please select a future date and time.' }, 400);
    }

    const id = await createOneOffReminder(c.env.DB, { datetime, message });
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