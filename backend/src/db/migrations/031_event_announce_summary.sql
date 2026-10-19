ALTER TABLE events
  ADD COLUMN announce_summary JSON NULL AFTER announced_at;
