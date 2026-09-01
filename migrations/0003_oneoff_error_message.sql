-- Persist the most recent one-off delivery failure for dashboard diagnostics.
ALTER TABLE oneoff_reminders ADD COLUMN error_message TEXT;
