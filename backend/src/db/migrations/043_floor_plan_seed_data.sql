ALTER TABLE stalls
  MODIFY COLUMN status ENUM('AVAILABLE', 'DISABLED', 'BOOKED', 'RESERVED') NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN floor_x SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER sort_order,
  ADD COLUMN floor_y SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER floor_x,
  ADD INDEX idx_stalls_floor_plan(event_id, floor_y, floor_x);

INSERT INTO stall_types
  (id, code, name, category, width_m, depth_m, price, tax_rate, includes, active, sort_order)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'COMPACT', 'Compact Stall', 'INDIVIDUAL', 2, 2, 15000, 18, '2 spotlights, 1 table, 2 chairs, fascia name board', 1, 1),
  ('11111111-1111-4111-8111-111111111102', 'GROUP', 'Group Stall', 'GROUP', 6, 4, 55000, 18, '6 spotlights, 3 tables, 6 chairs, 3-wall display panel', 1, 2),
  ('11111111-1111-4111-8111-111111111103', 'GALLERY', 'Gallery Space', 'GALLERY', 10, 8, 120000, 18, '12 track lights, lounge seating, VIP wall branding, storage closet', 1, 3)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  width_m = VALUES(width_m),
  depth_m = VALUES(depth_m),
  price = VALUES(price),
  tax_rate = VALUES(tax_rate),
  includes = VALUES(includes),
  active = VALUES(active),
  sort_order = VALUES(sort_order);

INSERT INTO stalls
  (id, event_id, stall_type_id, code, location, status, sort_order, floor_x, floor_y)
SELECT UUID(), e.id, stall_type.id, booth.code, 'Main Hall', booth.status, booth.sort_order, booth.floor_x, booth.floor_y
FROM events AS e
CROSS JOIN (
  SELECT 'COMPACT' AS type_code, 'A1' AS code, 'BOOKED' AS status, 1 AS sort_order, 1 AS floor_x, 1 AS floor_y
  UNION ALL SELECT 'COMPACT', 'A2', 'AVAILABLE', 2, 2, 1
  UNION ALL SELECT 'COMPACT', 'A3', 'AVAILABLE', 3, 3, 1
  UNION ALL SELECT 'COMPACT', 'A4', 'AVAILABLE', 4, 4, 1
  UNION ALL SELECT 'COMPACT', 'A5', 'AVAILABLE', 5, 1, 2
  UNION ALL SELECT 'COMPACT', 'A6', 'AVAILABLE', 6, 2, 2
  UNION ALL SELECT 'COMPACT', 'A7', 'RESERVED', 7, 3, 2
  UNION ALL SELECT 'COMPACT', 'A8', 'AVAILABLE', 8, 4, 2
  UNION ALL SELECT 'GROUP', 'B1', 'BOOKED', 9, 1, 1
  UNION ALL SELECT 'GROUP', 'B2', 'AVAILABLE', 10, 2, 1
  UNION ALL SELECT 'GROUP', 'B3', 'AVAILABLE', 11, 3, 1
  UNION ALL SELECT 'GROUP', 'B4', 'RESERVED', 12, 4, 1
  UNION ALL SELECT 'GROUP', 'B5', 'AVAILABLE', 13, 1, 2
  UNION ALL SELECT 'GALLERY', 'G1', 'RESERVED', 14, 1, 1
  UNION ALL SELECT 'GALLERY', 'G2', 'AVAILABLE', 15, 2, 1
  UNION ALL SELECT 'GALLERY', 'G3', 'AVAILABLE', 16, 3, 1
  UNION ALL SELECT 'GALLERY', 'G4', 'BOOKED', 17, 4, 1
) AS booth
JOIN stall_types AS stall_type ON stall_type.code = booth.type_code
WHERE e.title IN (
  'The Haat of Art — Indore',
  'The Haat of Art — Mumbai Art Fair',
  'The Haat of Art — Bengaluru Art Collective',
  'The Haat of Art — India Art Exhibition Tour 2027'
)
ON DUPLICATE KEY UPDATE
  status = IF(
    VALUES(status) IN ('BOOKED', 'RESERVED')
      AND stalls.status = 'AVAILABLE'
      AND NOT EXISTS (SELECT 1 FROM stall_bookings AS booking WHERE booking.stall_id = stalls.id)
      AND NOT EXISTS (SELECT 1 FROM stall_holds AS hold WHERE hold.stall_id = stalls.id AND hold.released_at IS NULL AND hold.expires_at > NOW()),
    VALUES(status),
    stalls.status
  ),
  location = VALUES(location),
  sort_order = VALUES(sort_order),
  floor_x = VALUES(floor_x),
  floor_y = VALUES(floor_y);
