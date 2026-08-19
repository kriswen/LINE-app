// Database operations for delivery log

export async function logDelivery(db, entry) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO delivery_log (id, reminder_type, reminder_id, scheduled_for, subscriber_id, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'))`
    )
    .bind(
      id,
      entry.reminder_type,
      entry.reminder_id,
      entry.scheduled_for,
      entry.subscriber_id,
      entry.status,
      entry.error_message || null
    )
    .run();
}

export async function getDeliveryLog(db, limit = 100) {
  const result = await db
    .prepare('SELECT * FROM delivery_log ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();
  return result.results;
}

export async function getDeliveryStats(db) {
  const total = await db.prepare('SELECT COUNT(*) as count FROM delivery_log').first();
  const success = await db
    .prepare('SELECT COUNT(*) as count FROM delivery_log WHERE status = \'success\'')
    .first();
  const failed = await db
    .prepare('SELECT COUNT(*) as count FROM delivery_log WHERE status = \'failed\'')
    .first();

  return {
    total: total?.count || 0,
    success: success?.count || 0,
    failed: failed?.count || 0,
  };
}