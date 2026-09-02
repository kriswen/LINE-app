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
    const normalized = {
      date,
      sys: Number(sys),
      dia: Number(dia),
      hr: hr === '' || hr == null ? null : Number(hr),
      weight: weight === '' || weight == null ? null : Number(weight),
    };

    if (!isValidBpLog(normalized)) {
      return c.json({ error: 'Invalid blood-pressure record' }, 400);
    }

    const id = await createBpLog(c.env.DB, normalized);
    const logs = await getBpLogs(c.env.DB);
    const newLog = logs.find((l) => l.id === id);

    return c.json({ success: true, log: newLog });
  } catch (error) {
    console.error('BP log creation error:', error);
    return c.json({ error: 'Failed to save BP log' }, 500);
  }
});

function isValidBpLog(log) {
  if (typeof log.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) return false;
  const parsedDate = new Date(`${log.date}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== log.date) {
    return false;
  }
  if (!Number.isInteger(log.sys) || log.sys <= 0) return false;
  if (!Number.isInteger(log.dia) || log.dia <= 0) return false;
  if (log.hr !== null && (!Number.isInteger(log.hr) || log.hr <= 0)) return false;
  if (log.weight !== null && (!Number.isFinite(log.weight) || log.weight <= 0)) return false;
  return true;
}

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