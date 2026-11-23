CREATE TABLE homepage_media_uploads (
  id CHAR(36) PRIMARY KEY,
  mime_type VARCHAR(100) NOT NULL,
  data LONGBLOB NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_homepage_media_uploads_created_at (created_at),
  CONSTRAINT fk_homepage_media_uploads_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE homepage_hero_slides (
  id CHAR(36) PRIMARY KEY,
  image_url VARCHAR(1000) NOT NULL,
  alt_text VARCHAR(255) NOT NULL DEFAULT '',
  caption VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_homepage_hero_slides_order (is_active, sort_order, created_at)
);

CREATE TABLE homepage_hero_video_settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  hero_video_url VARCHAR(1000) NULL,
  hero_video_poster_url VARCHAR(1000) NULL,
  hero_video_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  hero_video_autoplay BOOLEAN NOT NULL DEFAULT TRUE,
  hero_video_loop BOOLEAN NOT NULL DEFAULT TRUE,
  hero_slides_managed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_homepage_hero_video_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO homepage_hero_slides (id, image_url, alt_text, sort_order)
SELECT UUID(), CONCAT('/api/homepage/media/', media_key), alt_text,
  CASE media_key WHEN 'hero' THEN 0 WHEN 'hero2' THEN 1 ELSE 2 END
FROM homepage_media
WHERE media_key IN ('hero', 'hero2', 'hero3');

INSERT INTO homepage_hero_video_settings (
  id, hero_video_url, hero_video_poster_url, hero_video_enabled, hero_video_autoplay, hero_video_loop, hero_slides_managed
)
SELECT
  1,
  CASE WHEN EXISTS(SELECT 1 FROM homepage_media WHERE media_key='film') THEN '/api/homepage/media/film' ELSE NULL END,
  CASE WHEN EXISTS(SELECT 1 FROM homepage_media WHERE media_key='filmPoster') THEN '/api/homepage/media/filmPoster' ELSE NULL END,
  FALSE,
  TRUE,
  TRUE,
  EXISTS(SELECT 1 FROM homepage_hero_slides);
