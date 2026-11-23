INSERT INTO stall_types
  (id, code, name, category, width_m, depth_m, price, tax_rate, includes, active, sort_order)
VALUES
  ('11111111-1111-4111-8111-111111111104', 'STANDARD', 'Standard Stall', 'INDIVIDUAL', 3, 3, 28000, 18, '', 1, 2)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  width_m = VALUES(width_m),
  depth_m = VALUES(depth_m),
  price = VALUES(price),
  tax_rate = VALUES(tax_rate),
  includes = IF(includes = '', VALUES(includes), includes),
  active = 1,
  sort_order = VALUES(sort_order);

UPDATE stall_types SET sort_order = 3 WHERE code = 'GROUP';
UPDATE stall_types SET sort_order = 4 WHERE code = 'GALLERY';

INSERT INTO stalls
  (id, event_id, stall_type_id, code, location, status, sort_order, floor_x, floor_y)
SELECT UUID(), e.id, standard.id, booth.code, 'Hall A', booth.status, booth.sort_order, booth.floor_x, booth.floor_y
FROM events AS e
CROSS JOIN (
  SELECT 'A9' AS code, 'BOOKED' AS status, 18 AS sort_order, 1 AS floor_x, 1 AS floor_y
  UNION ALL SELECT 'A10', 'AVAILABLE', 19, 2, 1
  UNION ALL SELECT 'A11', 'RESERVED', 20, 3, 1
  UNION ALL SELECT 'A12', 'AVAILABLE', 21, 4, 1
) AS booth
JOIN stall_types AS standard ON standard.code = 'STANDARD'
WHERE e.title IN (
  'The Haat of Art — Indore',
  'The Haat of Art — Mumbai Art Fair',
  'The Haat of Art — Bengaluru Art Collective',
  'The Haat of Art — India Art Exhibition Tour 2027'
)
ON DUPLICATE KEY UPDATE
  stall_type_id = IF(
    NOT EXISTS (SELECT 1 FROM stall_bookings AS booking WHERE booking.stall_id = stalls.id)
      AND NOT EXISTS (SELECT 1 FROM stall_holds AS hold WHERE hold.stall_id = stalls.id AND hold.released_at IS NULL AND hold.expires_at > NOW()),
    VALUES(stall_type_id),
    stalls.stall_type_id
  ),
  location = VALUES(location),
  sort_order = VALUES(sort_order),
  floor_x = VALUES(floor_x),
  floor_y = VALUES(floor_y);
