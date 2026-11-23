ALTER TABLE stalls
  ADD COLUMN state VARCHAR(120) NOT NULL DEFAULT '' AFTER event_id,
  ADD INDEX idx_stalls_event_state (event_id, state, sort_order);

UPDATE stalls s
JOIN event_state_stall_pricing p
  ON p.event_id = s.event_id
 AND p.state = s.location
 AND p.stall_type_id = s.stall_type_id
SET s.state = p.state,
    s.location = '';
