// Database operations for reminder routines

export async function getReminderRoutines(db) {
  const result = await db
    .prepare('SELECT * FROM reminder_routines WHERE enabled = 1 ORDER BY time')
    .all();
  return result.results.map((row) => ({
    id: row.id,
    time: row.time,
    daysOfWeek: JSON.parse(row.days_of_week),
    message: row.message,
    includeMedicineReminder: Boolean(row.include_medicine),
    includeWeather: Boolean(row.include_weather),
    includeCalendarReminder: Boolean(row.include_calendar),
    includeCalendarReminderDays: row.calendar_days,
    excludePastCalendarEvents: Boolean(row.exclude_past_events),
    excludeTodayCalendarEvents: Boolean(row.exclude_today_events),
    enabled: Boolean(row.enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getAllReminderRoutines(db) {
  const result = await db.prepare('SELECT * FROM reminder_routines ORDER BY time').all();
  return result.results.map((row) => ({
    id: row.id,
    time: row.time,
    daysOfWeek: JSON.parse(row.days_of_week),
    message: row.message,
    includeMedicineReminder: Boolean(row.include_medicine),
    includeWeather: Boolean(row.include_weather),
    includeCalendarReminder: Boolean(row.include_calendar),
    includeCalendarReminderDays: row.calendar_days,
    excludePastCalendarEvents: Boolean(row.exclude_past_events),
    excludeTodayCalendarEvents: Boolean(row.exclude_today_events),
    enabled: Boolean(row.enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function createReminderRoutine(db, data) {
  const id = crypto.randomUUID();
  await prepareReminderInsert(db, id, data).run();
  return id;
}

function prepareReminderInsert(db, id, data) {
  return db
    .prepare(
      `INSERT INTO reminder_routines (id, time, days_of_week, message, include_medicine, include_weather, include_calendar, calendar_days, exclude_past_events, exclude_today_events, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc'))`
    )
    .bind(
      id,
      data.time,
      JSON.stringify(data.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]),
      data.message || '',
      data.includeMedicineReminder ? 1 : 0,
      data.includeWeather ? 1 : 0,
      data.includeCalendarReminder ? 1 : 0,
      data.includeCalendarReminderDays || 4,
      data.excludePastCalendarEvents !== false ? 1 : 0,
      data.excludeTodayCalendarEvents ? 1 : 0,
      data.enabled !== false ? 1 : 0
    );
}

export async function updateReminderRoutine(db, id, data) {
  await db
    .prepare(
      `UPDATE reminder_routines SET
        time = ?, days_of_week = ?, message = ?, include_medicine = ?, include_weather = ?,
        include_calendar = ?, calendar_days = ?, exclude_past_events = ?, exclude_today_events = ?,
        enabled = ?, updated_at = datetime('now', 'utc')
       WHERE id = ?`
    )
    .bind(
      data.time,
      JSON.stringify(data.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]),
      data.message || '',
      data.includeMedicineReminder ? 1 : 0,
      data.includeWeather ? 1 : 0,
      data.includeCalendarReminder ? 1 : 0,
      data.includeCalendarReminderDays || 4,
      data.excludePastCalendarEvents !== false ? 1 : 0,
      data.excludeTodayCalendarEvents ? 1 : 0,
      data.enabled !== false ? 1 : 0,
      id
    )
    .run();
}

export async function deleteReminderRoutine(db, id) {
  await db.prepare('DELETE FROM reminder_routines WHERE id = ?').bind(id).run();
}

export async function replaceAllReminderRoutines(db, routines) {
  const statements = [
    db.prepare('DELETE FROM reminder_routines'),
    ...routines.map((routine) => prepareReminderInsert(db, crypto.randomUUID(), routine)),
  ];
  await db.batch(statements);
}