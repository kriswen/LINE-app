// Database operations for BP logs

export async function getBpLogs(db) {
  const result = await db.prepare('SELECT * FROM bp_logs ORDER BY measured_date DESC').all();
  return result.results.map((row) => ({
    id: row.id,
    date: row.measured_date,
    sys: row.systolic,
    dia: row.diastolic,
    hr: row.heart_rate,
    weight: row.weight,
  }));
}

export async function createBpLog(db, data) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO bp_logs (id, measured_date, systolic, diastolic, heart_rate, weight, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'))`
    )
    .bind(id, data.date, data.sys, data.dia, data.hr || null, data.weight || null)
    .run();
  return id;
}

export async function deleteBpLog(db, id) {
  await db.prepare('DELETE FROM bp_logs WHERE id = ?').bind(id).run();
}