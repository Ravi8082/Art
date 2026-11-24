CREATE TABLE visitor_marketing_unsubscribe_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  visitor_id CHAR(36) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visitor_id) REFERENCES visitor_profiles(id) ON DELETE CASCADE,
  INDEX idx_visitor_marketing_unsubscribe_visitor (visitor_id, used_at)
);
