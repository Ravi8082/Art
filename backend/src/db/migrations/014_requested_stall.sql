-- 014: an application records the exact stall the artist picked on the floor plan.
ALTER TABLE exhibition_applications
  ADD COLUMN requested_stall_id CHAR(36) NULL AFTER preferred_stall_type_id,
  ADD FOREIGN KEY(requested_stall_id) REFERENCES stalls(id) ON DELETE SET NULL;
