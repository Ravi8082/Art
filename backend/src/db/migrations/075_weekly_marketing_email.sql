ALTER TABLE email_outbox
  ADD COLUMN category ENUM('TRANSACTIONAL','MARKETING') NOT NULL DEFAULT 'TRANSACTIONAL' AFTER subscriber_id,
  ADD COLUMN marketing_week DATE NULL AFTER category,
  ADD UNIQUE KEY uq_outbox_marketing_week (recipient_email, marketing_week);

UPDATE email_outbox SET category='MARKETING';
