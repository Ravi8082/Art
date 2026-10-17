-- Application portfolios are PDFs, not images/videos.
ALTER TABLE media_assets MODIFY COLUMN media_type ENUM('IMAGE','VIDEO','DOCUMENT') NOT NULL;
