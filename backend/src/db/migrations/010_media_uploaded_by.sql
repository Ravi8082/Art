-- Track who uploaded an application media asset so previews stay private to the
-- uploader (and admins) instead of being served by the public blob endpoint.
ALTER TABLE media_assets
  ADD COLUMN uploaded_by CHAR(36) NULL AFTER data,
  ADD INDEX idx_media_uploaded_by(uploaded_by);
