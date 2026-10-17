ALTER TABLE blog_posts
  ADD COLUMN submitter_email VARCHAR(255) NOT NULL DEFAULT '' AFTER author,
  ADD COLUMN status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER submitter_email,
  ADD COLUMN review_note VARCHAR(1000) NULL AFTER status,
  ADD COLUMN reviewed_by CHAR(36) NULL AFTER review_note,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by,
  ADD INDEX idx_blog_status_published (status, published_at);
