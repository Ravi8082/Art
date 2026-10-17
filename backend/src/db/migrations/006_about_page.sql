CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) PRIMARY KEY,
  kind VARCHAR(40) NOT NULL DEFAULT 'about',
  mime_type VARCHAR(100) NOT NULL,
  media_type ENUM('IMAGE','VIDEO') NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  alt_text VARCHAR(255) NOT NULL DEFAULT '',
  data LONGBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_assets_kind(kind)
);

CREATE TABLE IF NOT EXISTS about_sections (
  section_key VARCHAR(40) PRIMARY KEY,
  title VARCHAR(160) NOT NULL DEFAULT '',
  subtitle VARCHAR(500) NOT NULL DEFAULT '',
  body_html MEDIUMTEXT NULL,
  image_asset_id CHAR(36) NULL,
  image_position ENUM('left','right') NOT NULL DEFAULT 'right',
  visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  designation VARCHAR(120) NOT NULL DEFAULT '',
  bio VARCHAR(1000) NOT NULL DEFAULT '',
  photo_asset_id CHAR(36) NULL,
  facebook_url VARCHAR(500) NULL,
  linkedin_url VARCHAR(500) NULL,
  instagram_url VARCHAR(500) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(photo_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  INDEX idx_team_members_order(sort_order)
);

CREATE TABLE IF NOT EXISTS event_partners (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT '',
  website_url VARCHAR(500) NULL,
  logo_asset_id CHAR(36) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(logo_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  INDEX idx_event_partners_order(sort_order)
);

CREATE TABLE IF NOT EXISTS about_publish_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  snapshot JSON NOT NULL,
  published_by CHAR(36) NULL,
  published_by_name VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(published_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_about_publish_created(created_at)
);

INSERT IGNORE INTO about_sections(section_key, sort_order, image_position) VALUES
  ('hero', 1, 'right'), ('foundation', 2, 'right'), ('company', 3, 'left');
