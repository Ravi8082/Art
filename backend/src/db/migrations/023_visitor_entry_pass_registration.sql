ALTER TABLE visitor_profiles
  ADD COLUMN phone VARCHAR(24) NULL,
  ADD COLUMN city VARCHAR(120) NULL,
  ADD COLUMN attending_as VARCHAR(100) NULL;

CREATE TABLE visitor_registration_challenges (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  city VARCHAR(120) NOT NULL,
  attending_as VARCHAR(100) NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_visitor_registration_challenge_lookup(email,event_id,expires_at),
  INDEX idx_visitor_registration_challenge_expiry(expires_at,consumed_at)
);
