// Database operations for one-off reminders

export async function getOneOffReminders(db) {
  const result = await db
    .prepare('SELECT * FROM oneoff_reminders ORDER BY scheduled_at')
    .all();
  return result.results.map((row) => ({
    id: row.id,
    datetime: row.scheduled_at,
    message: row.message,
    status: row.status,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    sentAt: row.sent_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function getPendingOneOffReminders(db) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `SELECT * FROM oneoff_reminders
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at`
    )
    .bind(now)
    .all();
  return result.results;
}

export async function claimPendingOneOffReminders(
  db,
  now = new Date().toISOString(),
  limit = 25
) {
  const result = await db
    .prepare(
      `SELECT * FROM oneoff_reminders
       WHERE (status = 'pending' OR (status = 'sending' AND last_attempt_at <= datetime('now', '-5 minutes')))
       AND scheduled_at <= ?
       ORDER BY scheduled_at
       LIMIT ?`
    )
    .bind(now, limit)
    .all();

  if (result.results.length === 0) return [];

  const claims = await db.batch(
    result.results.map((reminder) =>
      db
        .prepare(
          `UPDATE oneoff_reminders
           SET status = 'sending',
               attempts = attempts + 1,
               last_attempt_at = datetime('now', 'utc')
           WHERE id = ? AND (status = 'pending' OR (status = 'sending' AND last_attempt_at <= datetime('now', '-5 minutes')))`
        )
        .bind(reminder.id)
    )
  );

  return result.results.filter((_, index) => claims[index].meta.changes === 1);
}

export async function createOneOffReminder(db, data) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO oneoff_reminders (id, scheduled_at, message, status, attempts, created_at)
       VALUES (?, ?, ?, 'pending', 0, datetime('now', 'utc'))`
    )
    .bind(id, data.datetime, data.message)
    .run();
  return id;
}

export async function updateOneOffReminderStatus(db, id, status, errorMessage) {
  const updates = ['status = ?'];
  const params = [status];

  if (status === 'sent') {
    updates.push('sent_at = datetime(\'now\', \'utc\')');
  }
  if (errorMessage) {
    updates.push('error_message = ?');
    params.push(errorMessage);
  }

  params.push(id);

  await db
    .prepare(`UPDATE oneoff_reminders SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}

export async function deleteOneOffReminder(db, id) {
  await db.prepare('DELETE FROM oneoff_reminders WHERE id = ?').bind(id).run();
}