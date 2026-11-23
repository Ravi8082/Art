CREATE TABLE IF NOT EXISTS gallery_upcoming_editions (
  id CHAR(36) PRIMARY KEY,
  edition_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  schedule_label VARCHAR(100) NOT NULL,
  city_label VARCHAR(180) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status_label VARCHAR(100) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gallery_upcoming_public (published, start_date, sort_order)
);

INSERT INTO gallery_upcoming_editions
  (id, edition_key, title, schedule_label, city_label, start_date, end_date, status_label, sort_order)
VALUES
  (UUID(), 'bengaluru-2026-december', 'Bengaluru Art Collective', 'Dec 5–7, 2026', 'Bengaluru', '2026-12-05', '2026-12-07', 'Applications Open', 1),
  (UUID(), 'india-art-exhibition-tour-2027-january', 'India Art Exhibition Tour', 'Jan 15–17, 2027', 'India', '2027-01-15', '2027-01-17', 'Early Stall Allocation', 2),
  (UUID(), 'india-2027-season', 'Mumbai, Indore & New Delhi', '2027 Season', 'Mumbai, Indore & New Delhi', '2027-12-31', NULL, 'Registrations Open', 3)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  schedule_label = VALUES(schedule_label),
  city_label = VALUES(city_label),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  status_label = VALUES(status_label),
  sort_order = VALUES(sort_order);
