CREATE TABLE IF NOT EXISTS about_settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  hero_kicker VARCHAR(100) NOT NULL DEFAULT 'About Us',
  hero_title VARCHAR(160) NOT NULL DEFAULT 'The Haat of Art',
  hero_subtitle VARCHAR(500) NOT NULL DEFAULT '',
  hero_image_asset_id CHAR(36) NULL,
  hero_visible TINYINT(1) NOT NULL DEFAULT 1,
  story_kicker VARCHAR(100) NOT NULL DEFAULT 'OUR STORY',
  story_heading VARCHAR(160) NOT NULL DEFAULT 'The Haat of Art Foundation',
  story_body_html MEDIUMTEXT NULL,
  story_image_asset_id CHAR(36) NULL,
  story_image_position ENUM('left','right') NOT NULL DEFAULT 'right',
  story_tags JSON NOT NULL,
  story_visible TINYINT(1) NOT NULL DEFAULT 1,
  journey_kicker VARCHAR(100) NOT NULL DEFAULT 'A Living Art Movement',
  journey_heading VARCHAR(160) NOT NULL DEFAULT 'Our Journey & Milestones (2022–2027)',
  journey_visible TINYINT(1) NOT NULL DEFAULT 1,
  ecosystem_kicker VARCHAR(100) NOT NULL DEFAULT 'A transparent art ecosystem',
  ecosystem_heading VARCHAR(160) NOT NULL DEFAULT 'Built for Artists, Partners & Collectors',
  ecosystem_subtitle VARCHAR(500) NOT NULL DEFAULT 'Clear value for every participant—and a sustainable model that keeps the focus on art.',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_about_settings_hero_image FOREIGN KEY(hero_image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  CONSTRAINT fk_about_settings_story_image FOREIGN KEY(story_image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

INSERT INTO about_settings (
  id, hero_kicker, hero_title, hero_subtitle, hero_image_asset_id, hero_visible,
  story_kicker, story_heading, story_body_html, story_image_asset_id, story_image_position,
  story_tags, story_visible
)
SELECT
  1, 'About Us', COALESCE(NULLIF(hero.title, ''), 'The Haat of Art'),
  COALESCE(hero.subtitle, ''), hero.image_asset_id, COALESCE(hero.visible, 1),
  COALESCE(NULLIF(story.subtitle, ''), 'OUR STORY'),
  COALESCE(NULLIF(story.title, ''), 'The Haat of Art Foundation'),
  story.body_html, story.image_asset_id, COALESCE(story.image_position, 'right'),
  JSON_ARRAY('Art Exhibitions', 'Artist Community', 'Cultural Dialogues', 'Creative Collaborations'),
  COALESCE(story.visible, 1)
FROM (SELECT 1) seed
LEFT JOIN about_sections hero ON hero.section_key = 'hero'
LEFT JOIN about_sections story ON story.section_key = 'foundation'
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS about_metrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metric_key VARCHAR(80) NOT NULL UNIQUE,
  value VARCHAR(80) NOT NULL,
  label VARCHAR(160) NOT NULL,
  sublabel VARCHAR(200) NOT NULL DEFAULT '',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_about_metrics_visible_order(is_visible, sort_order)
);

INSERT INTO about_metrics(metric_key, value, label, sublabel, sort_order, is_visible) VALUES
  ('editions', '18+', 'Curated Art Editions', '', 1, 1),
  ('artists', '2,500+', 'Participating Artists', '', 2, 1),
  ('artworks', '40,000+', 'Artworks Showcased', '', 3, 1),
  ('visitors', '77,000+', 'Collectors & Visitors', '', 4, 1),
  ('direct-sales', '₹17.60 Cr+', 'Direct Artwork Sales', '0% Commission', 5, 1)
ON DUPLICATE KEY UPDATE metric_key = VALUES(metric_key);

CREATE TABLE IF NOT EXISTS about_milestones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  milestone_key VARCHAR(80) NOT NULL UNIQUE,
  year_range VARCHAR(80) NOT NULL,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_about_milestones_visible_order(is_visible, sort_order)
);

INSERT INTO about_milestones(milestone_key, year_range, title, description, sort_order, is_visible) VALUES
  ('2022', '2022', 'Inaugural New Delhi Editions', 'The Haat of Art began with its inaugural editions in New Delhi.', 1, 1),
  ('2023-2024', '2023–2024', 'Multi-City Expansion & Specially-Abled Artist Inclusion', 'Expanded across cities while including specially-abled artists.', 2, 1),
  ('2025-2026', '2025–2026', 'NESCO Mumbai, Bengaluru, Indore & Pune Milestones', 'Milestones across NESCO Mumbai, Bengaluru, Indore and Pune.', 3, 1),
  ('2027', '2027', 'Pan-India Art Exhibition Tour', 'The next chapter: a pan-India art exhibition tour.', 4, 1)
ON DUPLICATE KEY UPDATE milestone_key = VALUES(milestone_key);

CREATE TABLE IF NOT EXISTS about_vision_mission (
  section_key ENUM('vision','mission') PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  body_html MEDIUMTEXT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO about_vision_mission(section_key, title, body_html, sort_order, is_visible)
SELECT 'vision', COALESCE(NULLIF(section.title, ''), 'Our Vision'), section.body_html, 1, COALESCE(section.visible, 1)
FROM (SELECT 1) seed
LEFT JOIN about_sections section ON section.section_key = 'vision'
ON DUPLICATE KEY UPDATE section_key = VALUES(section_key);

INSERT INTO about_vision_mission(section_key, title, body_html, sort_order, is_visible)
SELECT 'mission', COALESCE(NULLIF(section.title, ''), 'Our Mission'), section.body_html, 2, COALESCE(section.visible, 1)
FROM (SELECT 1) seed
LEFT JOIN about_sections section ON section.section_key = 'mission'
ON DUPLICATE KEY UPDATE section_key = VALUES(section_key);

CREATE TABLE IF NOT EXISTS about_ecosystem_cards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  card_key VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  `lead` VARCHAR(240) NOT NULL DEFAULT '',
  body_html MEDIUMTEXT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_about_ecosystem_visible_order(is_visible, sort_order)
);

INSERT INTO about_ecosystem_cards(card_key, title, `lead`, body_html, sort_order, is_visible) VALUES
  ('artists', 'For Artists', 'Keep 100% of your exhibition sales', '<ul><li>0% commission on artworks sold directly at physical exhibition stalls.</li><li>Meet verified collectors, architects and interior designers across major Indian cities.</li><li>Build a year-round digital portfolio on <a href="/artists">Artists</a> and <a href="/gallery">Gallery</a>, with curated press and social promotion.</li></ul>', 1, 1),
  ('partners', 'For Brand & Gallery Partners', 'High-intent cultural visibility', '<ul><li>Connect your brand with affluent, design-forward audiences and HNI art buyers.</li><li>Explore title sponsorships, VIP preview lounge branding, curated catalog features and co-hosted art residencies.</li><li>Our exhibition team manages end-to-end event curation and footfall.</li></ul>', 2, 1),
  ('sustainability', 'How the ecosystem is sustained', 'Transparent fees. Shared value.', '<ul><li>Flat stall-booking fees and curated brand partnerships fund world-class venues, lighting, security and marketing.</li><li>This transparent model lets artists exhibit without gallery commissions on their direct stall sales.</li></ul>', 3, 1)
ON DUPLICATE KEY UPDATE card_key = VALUES(card_key);

ALTER TABLE team_members
  ADD COLUMN role VARCHAR(160) NOT NULL DEFAULT '' AFTER designation,
  ADD COLUMN badge_label VARCHAR(120) NOT NULL DEFAULT '' AFTER role,
  ADD COLUMN is_featured_mentor TINYINT(1) NOT NULL DEFAULT 0 AFTER badge_label;

UPDATE team_members SET role = designation WHERE role = '';

INSERT INTO team_members (
  id, name, designation, role, badge_label, bio, is_featured_mentor, sort_order, active
)
SELECT UUID(), seed.name, seed.role, seed.role, seed.role, seed.bio, seed.is_featured_mentor, seed.sort_order, 1
FROM (
  SELECT 'Vinod Dara Singh' name, 'Mentor' role, 'Strategic guidance and cultural mentorship for India’s emerging and established artists.' bio, 1 is_featured_mentor, 1 sort_order
  UNION ALL SELECT 'Mita V. Agarwal', 'Co-Founder', 'Curatorial direction, artist community building, and exhibition partnerships.', 0, 2
  UNION ALL SELECT 'Anil Kumar B. G.', 'Founder & CEO', 'Leading the vision, pan-India expansion, and creative ecosystem of The Haat of Art.', 0, 3
  UNION ALL SELECT 'L. Sankar Ramakrishnan', 'Chairman', 'Institutional governance, strategic advisory, and cultural stewardship.', 0, 4
  UNION ALL SELECT 'Ravi Gupta', 'Director - Operations', 'Exhibition logistics, venue execution, and seamless exhibitor experience.', 0, 5
  UNION ALL SELECT 'Priya Menon', 'Director - Programs', 'Curated art showcases, artist workshops, and collector engagement programs.', 0, 6
) seed
WHERE NOT EXISTS (SELECT 1 FROM team_members existing WHERE LOWER(existing.name) = LOWER(seed.name));

UPDATE team_members member
JOIN (
  SELECT 'Vinod Dara Singh' name, 'Mentor' role, 'Strategic guidance and cultural mentorship for India’s emerging and established artists.' bio, 1 is_featured_mentor
  UNION ALL SELECT 'Mita V. Agarwal', 'Co-Founder', 'Curatorial direction, artist community building, and exhibition partnerships.', 0
  UNION ALL SELECT 'Anil Kumar B. G.', 'Founder & CEO', 'Leading the vision, pan-India expansion, and creative ecosystem of The Haat of Art.', 0
  UNION ALL SELECT 'L. Sankar Ramakrishnan', 'Chairman', 'Institutional governance, strategic advisory, and cultural stewardship.', 0
  UNION ALL SELECT 'Ravi Gupta', 'Director - Operations', 'Exhibition logistics, venue execution, and seamless exhibitor experience.', 0
  UNION ALL SELECT 'Priya Menon', 'Director - Programs', 'Curated art showcases, artist workshops, and collector engagement programs.', 0
) seed ON LOWER(member.name) = LOWER(seed.name)
SET member.role = IF(member.role = '', seed.role, member.role),
    member.badge_label = IF(member.badge_label = '', seed.role, member.badge_label),
    member.bio = IF(member.bio = '', seed.bio, member.bio),
    member.is_featured_mentor = IF(seed.is_featured_mentor = 1, 1, member.is_featured_mentor);

ALTER TABLE event_partners
  ADD COLUMN short_code VARCHAR(24) NOT NULL DEFAULT '' AFTER name;

INSERT INTO event_partners(id, name, short_code, category, sort_order, active)
SELECT UUID(), seed.name, seed.short_code, seed.category, seed.sort_order, 1
FROM (
  SELECT 'Reliance Industries Limited' name, 'RIL' short_code, 'Corporate Partner' category, 1 sort_order
  UNION ALL SELECT 'Asian Paints', 'AP', 'Corporate Partner', 2
  UNION ALL SELECT 'TAJ Hotels - Palaces - Resorts', 'TAJ', 'Hospitality Partner', 3
  UNION ALL SELECT 'NESCO', 'NESCO', 'Venue Partner', 4
  UNION ALL SELECT 'KCC: Kolkata Centre for Creativity', 'KCC', 'Cultural Institution', 5
  UNION ALL SELECT 'NSDC', 'NSDC', 'Institutional Partner', 6
  UNION ALL SELECT 'ART INDIA', 'ART', 'Cultural Institution', 7
  UNION ALL SELECT 'Billboard', 'BILL', 'Media Partner', 8
  UNION ALL SELECT 'DANUBE', 'DANUBE', 'Corporate Partner', 9
  UNION ALL SELECT 'KB', 'KB', 'Event Partner', 10
  UNION ALL SELECT 'FII', 'FII', 'Event Partner', 11
  UNION ALL SELECT 'AAF', 'AAF', 'Cultural Institution', 12
) seed
WHERE NOT EXISTS (
  SELECT 1 FROM event_partners existing
  WHERE LOWER(REPLACE(existing.name, ' ', '')) = LOWER(REPLACE(seed.name, ' ', ''))
);

UPDATE event_partners SET name = 'Asian Paints'
WHERE LOWER(REPLACE(name, ' ', '')) = 'asianpaints';

UPDATE event_partners partner
JOIN (
  SELECT 'Reliance Industries Limited' name, 'RIL' short_code, 'Corporate Partner' category
  UNION ALL SELECT 'Asian Paints', 'AP', 'Corporate Partner'
  UNION ALL SELECT 'TAJ Hotels - Palaces - Resorts', 'TAJ', 'Hospitality Partner'
  UNION ALL SELECT 'NESCO', 'NESCO', 'Venue Partner'
  UNION ALL SELECT 'KCC: Kolkata Centre for Creativity', 'KCC', 'Cultural Institution'
  UNION ALL SELECT 'NSDC', 'NSDC', 'Institutional Partner'
  UNION ALL SELECT 'ART INDIA', 'ART', 'Cultural Institution'
  UNION ALL SELECT 'Billboard', 'BILL', 'Media Partner'
  UNION ALL SELECT 'DANUBE', 'DANUBE', 'Corporate Partner'
  UNION ALL SELECT 'KB', 'KB', 'Event Partner'
  UNION ALL SELECT 'FII', 'FII', 'Event Partner'
  UNION ALL SELECT 'AAF', 'AAF', 'Cultural Institution'
) seed ON LOWER(REPLACE(partner.name, ' ', '')) = LOWER(REPLACE(seed.name, ' ', ''))
SET partner.short_code = IF(partner.short_code = '', seed.short_code, partner.short_code),
    partner.category = IF(partner.category = '', seed.category, partner.category);
