INSERT IGNORE INTO permissions(name) VALUES ('reports:read');

INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name = 'reports:read'
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN');
