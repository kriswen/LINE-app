-- Preserve legacy partial BP/weight history while keeping new API submissions strict.
DROP INDEX IF EXISTS idx_bp_logs_date;

CREATE TABLE bp_logs_rebuilt (
  id TEXT PRIMARY KEY,
  measured_date TEXT NOT NULL,
  systolic INTEGER,
  diastolic INTEGER,
  heart_rate INTEGER,
  weight REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

INSERT INTO bp_logs_rebuilt
  (id, measured_date, systolic, diastolic, heart_rate, weight, created_at)
SELECT id, measured_date, systolic, diastolic, heart_rate, weight, created_at
FROM bp_logs;

DROP TABLE bp_logs;
ALTER TABLE bp_logs_rebuilt RENAME TO bp_logs;
CREATE INDEX idx_bp_logs_date ON bp_logs(measured_date DESC);
