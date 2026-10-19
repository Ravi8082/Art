ALTER TABLE blog_posts
  ADD COLUMN upload_token_hash CHAR(64) NULL AFTER submitter_email;

CREATE TABLE IF NOT EXISTS blog_media (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  media_type ENUM('IMAGE', 'VIDEO') NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  data LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blog_media_post(post_id, created_at),
  FOREIGN KEY(post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);
