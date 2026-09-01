// Database operations for subscribers

export async function getSubscribers(db) {
  const result = await db
    .prepare('SELECT line_target_id FROM subscribers WHERE active = 1')
    .all();
  return result.results.map((row) => row.line_target_id);
}

export async function saveSubscriber(db, lineTargetId, targetType) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO subscribers (id, line_target_id, target_type, active, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now', 'utc'), datetime('now', 'utc'))
       ON CONFLICT(line_target_id) DO UPDATE SET
         target_type = excluded.target_type,
         active = 1,
         updated_at = datetime('now', 'utc')`
    )
    .bind(id, lineTargetId, targetType)
    .run();
}

export async function getAllSubscribers(db) {
  const result = await db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all();
  return result.results;
}

export async function toggleSubscriber(db, id) {
  await db
    .prepare(
      `UPDATE subscribers SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now', 'utc') WHERE id = ?`
    )
    .bind(id)
    .run();
}