CREATE TABLE IF NOT EXISTS exhibition_archive_editions (
  id CHAR(36) PRIMARY KEY,
  edition_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  city VARCHAR(120) NOT NULL,
  month_label VARCHAR(80) NOT NULL,
  venue VARCHAR(220) NOT NULL,
  artist_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_archive_edition_published (published, sort_order, month_label)
);

CREATE TABLE IF NOT EXISTS exhibition_archive_media (
  id CHAR(36) PRIMARY KEY,
  media_key VARCHAR(120) NOT NULL UNIQUE,
  edition_id CHAR(36) NOT NULL,
  media_type ENUM('IMAGE', 'VIDEO') NOT NULL,
  source_type ENUM('ASSET', 'UPLOAD', 'YOUTUBE') NOT NULL,
  source_url VARCHAR(1024) NULL,
  mime_type VARCHAR(100) NULL,
  file_size INT UNSIGNED NULL,
  file_data LONGBLOB NULL,
  caption VARCHAR(240) NOT NULL,
  artist_name VARCHAR(140) NOT NULL DEFAULT '',
  stall_name VARCHAR(80) NOT NULL DEFAULT '',
  alt_text VARCHAR(255) NOT NULL DEFAULT '',
  duration_seconds SMALLINT UNSIGNED NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exhibition_archive_media_edition
    FOREIGN KEY (edition_id) REFERENCES exhibition_archive_editions(id) ON DELETE CASCADE,
  INDEX idx_exhibition_archive_media_public (edition_id, published, sort_order, created_at)
);

INSERT INTO exhibition_archive_editions
  (id, edition_key, title, city, month_label, venue, artist_count, sort_order)
VALUES
  (UUID(), 'mumbai-2025', 'NESCO / Bombay Exhibition Centre Showcase', 'Mumbai', '2025', 'NESCO / Bombay Exhibition Centre', 0, 1),
  (UUID(), 'bengaluru-2025', 'Palace Grounds Edition', 'Bengaluru', '2025', 'Palace Grounds / Karnataka Chitrakala Parishath', 0, 2),
  (UUID(), 'new-delhi-sept-2022', 'Autumn Edition II', 'New Delhi', 'September 2022', 'New Delhi', 0, 3),
  (UUID(), 'new-delhi-may-2022', 'Spring Edition I', 'New Delhi', 'May 2022', 'New Delhi', 0, 4)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  city = VALUES(city),
  month_label = VALUES(month_label),
  venue = VALUES(venue),
  sort_order = VALUES(sort_order);

INSERT INTO exhibition_archive_media
  (id, media_key, edition_id, media_type, source_type, source_url, caption, artist_name, stall_name, alt_text, sort_order)
SELECT UUID(), seed.media_key, edition.id, 'IMAGE', 'ASSET', seed.source_url, seed.caption,
       seed.artist_name, seed.stall_name, seed.alt_text, seed.sort_order
FROM exhibition_archive_editions edition
JOIN (
  SELECT 'mumbai-2025-floor-01' media_key, 'mumbai-2025' edition_key, '/media/exhibition-gallery.jpeg' source_url,
         'A wide view across the exhibition floor' caption, '' artist_name, '' stall_name,
         'Framed artworks displayed across a contemporary exhibition gallery' alt_text, 1 sort_order
  UNION ALL SELECT 'mumbai-2025-painting-02', 'mumbai-2025', '/media/homepage-reference/gallery2.png',
         'A close look at paintings presented in the showcase', '', '',
         'Colourful paintings displayed together at an art exhibition', 2
  UNION ALL SELECT 'bengaluru-2025-artists-01', 'bengaluru-2025', '/media/homepage-reference/exhibition2.png',
         'Artists and visitors share the exhibition floor', '', '',
         'Artists and visitors gathered among works at an exhibition', 1
  UNION ALL SELECT 'bengaluru-2025-craft-02', 'bengaluru-2025', '/media/homepage-reference/gallery5.png',
         'Hand-crafted works on view during the edition', '', '',
         'Decorative ceramic works displayed at an art exhibition', 2
  UNION ALL SELECT 'delhi-sept-2022-gallery-01', 'new-delhi-sept-2022', '/media/homepage-reference/exhibition3.png',
         'A moment from the Autumn Edition II', '', '',
         'Visitors viewing artwork at the Autumn Edition II exhibition', 1
  UNION ALL SELECT 'delhi-sept-2022-sculpture-02', 'new-delhi-sept-2022', '/media/homepage-reference/gallery3.png',
         'Sculptural works from the exhibition floor', '', '',
         'Sculptures displayed in an exhibition gallery', 2
  UNION ALL SELECT 'delhi-may-2022-gallery-01', 'new-delhi-may-2022', '/media/homepage-reference/exhibition1.png',
         'A moment from the Spring Edition I', '', '',
         'Visitors viewing artwork at the Spring Edition I exhibition', 1
  UNION ALL SELECT 'delhi-may-2022-painting-02', 'new-delhi-may-2022', '/media/live-mural.jpeg',
         'A detailed view of a large-scale painted work', '', '',
         'Colourful painted mural presented at an exhibition', 2
) seed ON seed.edition_key = edition.edition_key
ON DUPLICATE KEY UPDATE
  source_url = VALUES(source_url),
  caption = VALUES(caption),
  artist_name = VALUES(artist_name),
  stall_name = VALUES(stall_name),
  alt_text = VALUES(alt_text),
  sort_order = VALUES(sort_order);
