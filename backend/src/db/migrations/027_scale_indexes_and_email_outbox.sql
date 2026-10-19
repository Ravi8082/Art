CREATE INDEX idx_events_status_ends ON events(status, ends_at);
CREATE INDEX idx_events_state ON events(state);
CREATE INDEX idx_registrations_event_status ON event_registrations(event_id, status);
CREATE INDEX idx_visitor_marketing ON visitor_profiles(marketing_consent);
CREATE INDEX idx_check_ins_time ON check_ins(checked_in_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);

CREATE TABLE IF NOT EXISTS email_outbox (
  id CHAR(36) PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  subscriber_id CHAR(36) NULL,
  status ENUM('PENDING','SENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claim_token CHAR(36) NULL,
  locked_until DATETIME NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  INDEX idx_outbox_due(status, next_attempt_at),
  INDEX idx_outbox_claim(claim_token)
);
