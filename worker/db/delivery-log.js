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

function deliveryClaimKey(entry) {
  return [
    entry.reminder_type,
    entry.reminder_id,
    entry.scheduled_for,
    entry.subscriber_id,
  ].join(':');
}

export async function claimDelivery(db, entry) {
  const claimKey = deliveryClaimKey(entry);
  // Allow retrying failed deliveries for the same scheduled slot, while preventing concurrent or successful duplicates.
  const existing = await db
    .prepare('SELECT status FROM delivery_log WHERE claim_key = ?')
    .bind(claimKey)
    .first();

  if (existing) {
    if (existing.status === 'failed') {
      await db
        .prepare('UPDATE delivery_log SET status = \'sending\', error_message = NULL WHERE claim_key = ?')
        .bind(claimKey)
        .run();
      return true;
    }
    return false;
  }

  const result = await db
    .prepare(
      `INSERT INTO delivery_log
       (id, reminder_type, reminder_id, scheduled_for, subscriber_id, status, claim_key, created_at)
       VALUES (?, ?, ?, ?, ?, 'sending', ?, datetime('now', 'utc'))`
    )
    .bind(
      crypto.randomUUID(),
      entry.reminder_type,
      entry.reminder_id,
      entry.scheduled_for,
      entry.subscriber_id,
      claimKey
    )
    .run();
  return result.meta.changes === 1;
}

export async function completeDelivery(db, entry, status, errorMessage = null) {
  await db
    .prepare(
      `UPDATE delivery_log
       SET status = ?, error_message = ?
       WHERE claim_key = ?`
    )
    .bind(status, errorMessage, deliveryClaimKey(entry))
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