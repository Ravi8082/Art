ALTER TABLE gallery_upcoming_editions
  ADD COLUMN venue VARCHAR(220) NOT NULL DEFAULT '' AFTER city_label,
  ADD COLUMN show_on_gallery TINYINT(1) NOT NULL DEFAULT 1 AFTER published;

UPDATE gallery_upcoming_editions
SET venue = 'Palace Grounds, Bengaluru'
WHERE edition_key = 'bengaluru-2026-december';

UPDATE gallery_upcoming_editions
SET venue = 'Multiple Exhibition Venues — India Tour'
WHERE edition_key = 'india-art-exhibition-tour-2027-january';

INSERT INTO gallery_upcoming_editions
  (id, edition_key, title, schedule_label, city_label, venue, start_date, end_date, status_label, sort_order, published, show_on_gallery)
VALUES
  (UUID(), 'new-delhi-third-edition-coming-soon', 'New Delhi 3rd Edition', 'Coming Soon', 'New Delhi', 'New Delhi', '2027-12-30', NULL, 'Coming Soon', 4, 1, 0)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  schedule_label = VALUES(schedule_label),
  city_label = VALUES(city_label),
  venue = VALUES(venue),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  status_label = VALUES(status_label),
  sort_order = VALUES(sort_order),
  published = VALUES(published),
  show_on_gallery = VALUES(show_on_gallery);

CREATE TABLE concierge_leads (
  id CHAR(36) PRIMARY KEY,
  session_token_hash CHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone CHAR(10) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role ENUM('ARTIST_EXHIBITOR','ART_VISITOR','COLLECTOR_BUYER','BRAND_VENUE_PARTNER') NOT NULL,
  source_page VARCHAR(220) NOT NULL,
  consented_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_concierge_leads_created (created_at),
  INDEX idx_concierge_leads_email (email),
  INDEX idx_concierge_leads_phone (phone)
);

CREATE TABLE concierge_messages (
  id CHAR(36) PRIMARY KEY,
  lead_id CHAR(36) NOT NULL,
  sender ENUM('USER','ASSISTANT') NOT NULL,
  text TEXT NOT NULL,
  detected_intent VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_concierge_messages_lead FOREIGN KEY (lead_id) REFERENCES concierge_leads(id) ON DELETE CASCADE,
  INDEX idx_concierge_messages_lead_time (lead_id, created_at, id)
);
