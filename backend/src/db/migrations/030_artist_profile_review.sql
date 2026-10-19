ALTER TABLE artist_profiles
  ADD COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING' AFTER facebook_url,
  ADD COLUMN review_note VARCHAR(1000) NULL AFTER status,
  ADD COLUMN reviewed_by CHAR(36) NULL AFTER review_note,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by,
  ADD INDEX idx_artist_profiles_status(status, updated_at);
