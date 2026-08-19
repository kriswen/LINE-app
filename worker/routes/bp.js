// BP Logs API routes for dashboard

import { Hono } from 'hono';
import { authenticateAdmin } from '../middleware/auth.js';
import { getBpLogs, createBpLog, deleteBpLog } from '../db/bp-logs.js';

export const bpRoutes = new Hono();

bpRoutes.use('*', authenticateAdmin);

bpRoutes.get('/', async (c) => {
  const logs = await getBpLogs(c.env.DB);
  return c.json({ logs });
});

bpRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { date, sys, dia, hr, weight } = body;

    if (!date || !sys || !dia) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const id = await createBpLog(c.env.DB, { date, sys, dia, hr, weight });
    const logs = await getBpLogs(c.env.DB);
    const newLog = logs.find((l) => l.id === id);

    return c.json({ success: true, log: newLog });
  } catch (error) {
    console.error('BP log creation error:', error);
    return c.json({ error: 'Failed to save BP log' }, 500);
  }
});

bpRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteBpLog(c.env.DB, id);
    return c.json({ success: true });
  } catch (error) {
    console.error('BP log deletion error:', error);
    return c.json({ error: 'Failed to delete BP log' }, 500);
  }
});