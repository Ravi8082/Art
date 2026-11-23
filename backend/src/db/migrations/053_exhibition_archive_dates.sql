ALTER TABLE exhibition_archive_editions
  ADD COLUMN edition_number VARCHAR(40) NOT NULL DEFAULT '' AFTER title,
  ADD COLUMN start_date DATE NULL AFTER month_label,
  ADD COLUMN end_date DATE NULL AFTER start_date,
  ADD COLUMN date_is_exact TINYINT(1) NOT NULL DEFAULT 0 AFTER end_date;

UPDATE exhibition_archive_editions
SET start_date = CASE
  WHEN month_label REGEXP '^[0-9]{4}$'
    THEN STR_TO_DATE(CONCAT(month_label, '-01-01'), '%Y-%m-%d')
  WHEN month_label REGEXP '^[A-Za-z]+ [0-9]{4}$'
    THEN STR_TO_DATE(CONCAT('01 ', month_label), '%d %M %Y')
  ELSE NULL
END;

UPDATE exhibition_archive_editions
SET month_label = 'October 2025',
    venue = 'NESCO Centre, Mumbai',
    start_date = '2025-10-01'
WHERE edition_key = 'mumbai-2025';

CREATE INDEX idx_archive_edition_chronology
  ON exhibition_archive_editions (published, start_date, city);
