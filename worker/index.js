// Cloudflare Worker entry point for LINE Reminder Bot
// Uses Hono framework for routing

import { Hono } from 'hono';

// Create Hono app
const app = new Hono();

// Import route handlers
import { lineWebhook } from './routes/webhook';
import { configRoutes } from './routes/config';
import { bpRoutes } from './routes/bp';
import { oneoffRoutes } from './routes/oneoff';
import { scheduledHandler } from './handlers/scheduled';
import { verifyLineSignature } from './utils/line';

// LINE Webhook endpoint
app.post('/webhook', async (c) => {
  const signature = c.req.header('x-line-signature');
  const body = await c.req.text();

  // Verify LINE signature
  if (!signature || !(await verifyLineSignature(body, signature, c.env.CHANNEL_SECRET))) {
    console.log('Invalid LINE signature');
    return c.text('Invalid signature', 401);
  }

  return lineWebhook(c, body);
});

// Dashboard API routes (protected by admin password)
app.route('/api/config', configRoutes);
app.route('/api/bp', bpRoutes);
app.route('/api/oneoff', oneoffRoutes);

// Health check / keep-alive
app.get('/keep-alive', (c) => c.text('OK'));

// Static assets are served automatically via the assets binding in wrangler.jsonc
// The dashboard is available at /dashboard

// Scheduled handler for Cron Triggers
export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};