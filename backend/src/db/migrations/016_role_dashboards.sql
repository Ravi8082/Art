INSERT IGNORE INTO roles(name) VALUES ('REGISTRATION_MANAGER');

INSERT IGNORE INTO permissions(name) VALUES
  ('events:read'),
  ('events:create'),
  ('events:edit'),
  ('events:approve'),
  ('events:publish'),
  ('visitors:read'),
  ('audit:read'),
  ('dashboard:read'),
  ('content:manage'),
  ('content:publish'),
  ('events:manage'),
  ('bookings:manage'),
  ('bookings:read'),
  ('payments:verify'),
  ('enquiries:manage'),
  ('users:manage'),
  ('roles:manage'),
  ('registrations:read'),
  ('passes:scan'),
  ('passes:read'),
  ('applications:read'),
  ('profile:manage'),
  ('settings:manage');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'content:manage', 'content:publish', 'events:manage',
  'bookings:manage', 'bookings:read', 'payments:verify', 'enquiries:manage',
  'users:manage', 'events:read', 'events:create', 'events:edit', 'events:approve',
  'events:publish', 'visitors:read', 'audit:read', 'registrations:read',
  'passes:scan', 'passes:read', 'applications:read', 'profile:manage', 'settings:manage'
)
WHERE r.name = 'ADMIN';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'content:manage', 'events:manage', 'events:read', 'events:create', 'events:edit'
)
WHERE r.name = 'CONTENT_MANAGER';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'registrations:read', 'bookings:read'
)
WHERE r.name = 'REGISTRATION_MANAGER';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'applications:read', 'bookings:read', 'profile:manage'
)
WHERE r.name = 'ARTIST_EXHIBITOR';

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'registrations:read', 'passes:read'
)
WHERE r.name = 'VISITOR';
