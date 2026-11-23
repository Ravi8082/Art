ALTER TABLE gallery_upcoming_editions
  MODIFY COLUMN start_date DATETIME NOT NULL,
  MODIFY COLUMN end_date DATETIME NULL,
  ADD COLUMN archive_edition_id CHAR(36) NULL AFTER show_on_gallery,
  ADD INDEX idx_gallery_upcoming_archive (archive_edition_id),
  ADD CONSTRAINT fk_gallery_upcoming_archive
    FOREIGN KEY (archive_edition_id) REFERENCES exhibition_archive_editions(id) ON DELETE SET NULL;

UPDATE gallery_upcoming_editions
SET end_date = CONCAT(DATE_FORMAT(end_date, '%Y-%m-%d'), ' 23:59:59')
WHERE end_date IS NOT NULL;

UPDATE exhibition_archive_media
SET source_url = '/media/exhibition-gallery.jpeg',
    alt_text = 'A high-resolution view across a contemporary exhibition gallery'
WHERE media_key = 'delhi-sept-2022-gallery-01';
