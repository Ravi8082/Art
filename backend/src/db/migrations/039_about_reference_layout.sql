ALTER TABLE about_sections
  ADD COLUMN link_url VARCHAR(500) NULL AFTER image_position,
  ADD COLUMN button_label VARCHAR(120) NULL AFTER link_url;

INSERT IGNORE INTO about_sections(section_key, image_position, sort_order) VALUES
  ('vision', 'right', 4),
  ('mission', 'right', 5),
  ('features', 'right', 6),
  ('team', 'right', 7),
  ('partners', 'right', 8),
  ('cta', 'right', 9);
