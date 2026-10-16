BEGIN;
-- Keep durable revision triggers; remove only the retired SSE NOTIFY path.
DROP TRIGGER IF EXISTS gdgoc_tasks_changed ON tasks;
DROP TRIGGER IF EXISTS gdgoc_assignees_changed ON task_assignees;
DROP TRIGGER IF EXISTS gdgoc_events_changed ON events;
DROP TRIGGER IF EXISTS gdgoc_contributions_changed ON event_contributions;
DROP TRIGGER IF EXISTS gdgoc_gems_changed ON gems_transactions;
DROP TRIGGER IF EXISTS gdgoc_notifications_changed ON notifications;
DROP TRIGGER IF EXISTS gdgoc_periods_changed ON semesters;
DROP FUNCTION IF EXISTS gdgoc_publish_changes();
COMMIT;
