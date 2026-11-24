ALTER TABLE contact_enquiries
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'direct' AFTER priority,
  ADD COLUMN medium VARCHAR(40) NULL AFTER source,
  ADD COLUMN campaign VARCHAR(80) NULL AFTER medium,
  ADD COLUMN email_marketing_consent BOOLEAN NOT NULL DEFAULT FALSE AFTER campaign,
  ADD COLUMN whatsapp_marketing_consent BOOLEAN NOT NULL DEFAULT FALSE AFTER email_marketing_consent,
  ADD INDEX idx_enquiries_attribution (source, medium, campaign, created_at);
