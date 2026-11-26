ALTER TABLE visitor_registration_challenges
  ADD COLUMN pass_tier ENUM('FREE','PAID') NOT NULL DEFAULT 'FREE',
  ADD COLUMN preferred_visit_day DATE NULL,
  ADD COLUMN quantity TINYINT UNSIGNED NOT NULL DEFAULT 1;
