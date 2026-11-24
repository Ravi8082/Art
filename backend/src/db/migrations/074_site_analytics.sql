CREATE TABLE IF NOT EXISTS site_analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id CHAR(36) NOT NULL,
  event_type ENUM('PAGE_VIEW','LINK_CLICK','FORM_SUBMIT') NOT NULL,
  page_path VARCHAR(255) NOT NULL,
  target_path VARCHAR(255) NULL,
  source ENUM('DIRECT','INSTAGRAM','FACEBOOK','GOOGLE','WHATSAPP','NEWSLETTER','REFERRAL','OTHER') NOT NULL,
  medium VARCHAR(64) NULL,
  campaign VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_site_analytics_created (created_at),
  INDEX idx_site_analytics_visitor (visitor_id, created_at),
  INDEX idx_site_analytics_source (source, created_at),
  INDEX idx_site_analytics_page (page_path, created_at)
);
