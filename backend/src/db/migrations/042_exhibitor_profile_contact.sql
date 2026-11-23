ALTER TABLE artist_profiles
  ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER display_name,
  ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT '' AFTER first_name,
  ADD COLUMN address VARCHAR(500) NOT NULL DEFAULT '' AFTER phone;
