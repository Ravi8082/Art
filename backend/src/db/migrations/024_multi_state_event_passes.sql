ALTER TABLE events
  ADD COLUMN state VARCHAR(80) NOT NULL DEFAULT '' AFTER city,
  ADD COLUMN announced_at DATETIME NULL;

UPDATE events SET state='Madhya Pradesh' WHERE state='' AND (city='Indore' OR slug LIKE '%indore%');

ALTER TABLE qr_passes
  ADD COLUMN reference_code CHAR(12) NULL AFTER token_hash,
  ADD UNIQUE KEY uq_qr_passes_reference(reference_code);

UPDATE qr_passes
  SET reference_code=UPPER(SUBSTRING(SHA2(CONCAT(id,UUID(),RAND()),256),1,12))
  WHERE reference_code IS NULL;

CREATE TABLE staff_state_access (
  user_id CHAR(36) NOT NULL,
  state VARCHAR(80) NOT NULL,
  assigned_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,state),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
