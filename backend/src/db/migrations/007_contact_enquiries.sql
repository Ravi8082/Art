UPDATE contact_enquiries SET status='NEW' WHERE status='OPEN';
UPDATE contact_enquiries SET status='CLOSED' WHERE status='CLOSED';

ALTER TABLE contact_enquiries
  MODIFY status ENUM('NEW','ASSIGNED','IN_PROGRESS','WAITING_FOR_REPLY','RESOLVED','CLOSED','SPAM') NOT NULL DEFAULT 'NEW',
  ADD COLUMN ref_code VARCHAR(20) NULL UNIQUE AFTER id,
  ADD COLUMN phone VARCHAR(30) NOT NULL DEFAULT '' AFTER email,
  ADD COLUMN category VARCHAR(60) NOT NULL DEFAULT 'General' AFTER phone,
  ADD COLUMN subject VARCHAR(200) NOT NULL DEFAULT '' AFTER category,
  ADD COLUMN priority ENUM('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL' AFTER status,
  ADD COLUMN assigned_to CHAR(36) NULL AFTER priority,
  ADD COLUMN follow_up_at DATETIME NULL AFTER assigned_to,
  ADD COLUMN resolved_at DATETIME NULL AFTER follow_up_at,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_enquiries_status(status, created_at),
  ADD INDEX idx_enquiries_assigned(assigned_to, status);

UPDATE contact_enquiries SET ref_code = CONCAT('ENQ-', UPPER(SUBSTRING(REPLACE(id, '-', ''), 1, 8))) WHERE ref_code IS NULL;
ALTER TABLE contact_enquiries MODIFY ref_code VARCHAR(20) NOT NULL;

CREATE TABLE IF NOT EXISTS enquiry_messages (
  id CHAR(36) PRIMARY KEY,
  enquiry_id CHAR(36) NOT NULL,
  direction ENUM('INCOMING','OUTGOING','SYSTEM') NOT NULL,
  author_user_id CHAR(36) NULL,
  body TEXT NOT NULL,
  email_status VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(enquiry_id) REFERENCES contact_enquiries(id) ON DELETE CASCADE,
  FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_enquiry_messages(enquiry_id, created_at)
);

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id CHAR(36) PRIMARY KEY,
  enquiry_id CHAR(36) NOT NULL,
  author_user_id CHAR(36) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(enquiry_id) REFERENCES contact_enquiries(id) ON DELETE CASCADE,
  FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_enquiry_notes(enquiry_id, created_at)
);

CREATE TABLE IF NOT EXISTS enquiry_attachments (
  id CHAR(36) PRIMARY KEY,
  enquiry_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  data LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(enquiry_id) REFERENCES contact_enquiries(id) ON DELETE CASCADE,
  INDEX idx_enquiry_attachments(enquiry_id)
);
