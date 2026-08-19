// Database operations for one-off reminders

export async function getOneOffReminders(db) {
  const result = await db
    .prepare('SELECT * FROM oneoff_reminders ORDER BY scheduled_at')
    .all();
  return result.results;
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
  const updates = ['status = ?', 'attempts = attempts + 1', 'last_attempt_at = datetime(\'now\', \'utc\')'];
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