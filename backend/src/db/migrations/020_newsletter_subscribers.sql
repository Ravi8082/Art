CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME NULL,
  INDEX idx_newsletter_active (unsubscribed_at, subscribed_at)
);

CREATE TABLE IF NOT EXISTS newsletter_unsubscribe_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  subscriber_id CHAR(36) NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  INDEX idx_newsletter_token_subscriber (subscriber_id)
);
