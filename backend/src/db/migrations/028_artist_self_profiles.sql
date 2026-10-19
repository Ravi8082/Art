CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id CHAR(36) PRIMARY KEY,
  display_name VARCHAR(160) NOT NULL DEFAULT '',
  headline VARCHAR(160) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  state VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  art_style VARCHAR(160) NOT NULL DEFAULT '',
  bio TEXT NULL,
  website_url VARCHAR(512) NOT NULL DEFAULT '',
  instagram_url VARCHAR(512) NOT NULL DEFAULT '',
  facebook_url VARCHAR(512) NOT NULL DEFAULT '',
  photo_asset_id CHAR(36) NULL,
  cover_asset_id CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(photo_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY(cover_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artist_portfolio_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  medium VARCHAR(160) NOT NULL DEFAULT '',
  dimensions VARCHAR(80) NOT NULL DEFAULT '',
  year_made SMALLINT UNSIGNED NULL,
  price_inr DECIMAL(12,2) NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  image_asset_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portfolio_user(user_id, created_at),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(image_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
);
