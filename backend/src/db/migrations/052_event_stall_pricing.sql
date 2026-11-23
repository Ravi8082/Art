CREATE TABLE IF NOT EXISTS event_stall_pricing (
  event_id CHAR(36) NOT NULL,
  stall_type_id CHAR(36) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  public_visible TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, stall_type_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (stall_type_id) REFERENCES stall_types(id),
  INDEX idx_event_stall_pricing_visible (event_id, public_visible)
);

UPDATE stall_types
SET includes = '4 spotlights, 2 display tables, 2 chairs, fascia name board'
WHERE code = 'STANDARD';
