INSERT IGNORE INTO permissions(name) VALUES ('passes:read'), ('passes:scan'), ('registrations:read');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'dashboard:read', 'registrations:read', 'passes:read', 'passes:scan'
)
WHERE r.name = 'REGISTRATION_MANAGER';
