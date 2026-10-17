ALTER TABLE artworks
  ADD COLUMN artist_id CHAR(36) NULL AFTER artist_name,
  ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '' AFTER title,
  ADD INDEX idx_artworks_artist (artist_id);

CREATE TABLE IF NOT EXISTS blog_posts (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(400) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  author VARCHAR(120) NOT NULL DEFAULT '',
  cover_mime VARCHAR(100) NULL,
  cover_data LONGBLOB NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blog_published (published_at)
);
