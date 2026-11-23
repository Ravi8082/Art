CREATE TABLE IF NOT EXISTS invited_guests (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  designation VARCHAR(200) NOT NULL DEFAULT '',
  edition_tag VARCHAR(120) NOT NULL DEFAULT '',
  photo_url VARCHAR(600) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  show_on_home TINYINT(1) NOT NULL DEFAULT 1,
  show_on_about TINYINT(1) NOT NULL DEFAULT 1,
  show_on_gallery TINYINT(1) NOT NULL DEFAULT 1,
  show_on_exhibitions TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invited_guests_active_order(is_active, sort_order, id)
);

INSERT IGNORE INTO invited_guests
  (id, name, designation, edition_tag, sort_order, is_active, show_on_home, show_on_about, show_on_gallery, show_on_exhibitions)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Guest of Honour (Placeholder)', 'Placeholder profile · Update with verified guest details', 'Mumbai Edition', 1, 1, 1, 1, 1, 1),
  ('a0000000-0000-4000-8000-000000000002', 'Art Patron (Placeholder)', 'Placeholder profile · Update with verified guest details', 'New Delhi Edition', 2, 1, 1, 1, 1, 1),
  ('a0000000-0000-4000-8000-000000000003', 'Cultural Dignitary (Placeholder)', 'Placeholder profile · Update with verified guest details', 'Bengaluru Showcase', 3, 1, 1, 1, 1, 1),
  ('a0000000-0000-4000-8000-000000000004', 'Distinguished Guest (Placeholder)', 'Placeholder profile · Update with verified guest details', 'Indore Edition', 4, 1, 1, 1, 1, 1);
