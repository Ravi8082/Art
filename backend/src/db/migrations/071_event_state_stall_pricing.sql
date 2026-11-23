ALTER TABLE events
  MODIFY COLUMN state VARCHAR(700) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS event_state_stall_pricing (
  event_id CHAR(36) NOT NULL,
  state VARCHAR(120) NOT NULL,
  stall_type_id CHAR(36) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  slot_count INT UNSIGNED NOT NULL DEFAULT 0,
  public_visible TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, state, stall_type_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (stall_type_id) REFERENCES stall_types(id),
  INDEX idx_event_state_pricing_visible (event_id, state, public_visible)
);
