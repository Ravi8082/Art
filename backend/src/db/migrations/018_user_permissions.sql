CREATE TABLE IF NOT EXISTS user_permissions (
  user_id CHAR(36) NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  granted_by CHAR(36) NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_permissions_permission(permission_id)
);
