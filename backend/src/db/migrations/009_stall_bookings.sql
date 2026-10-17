-- Stall booking system: exhibitions gain city + registration deadline; stall catalogue,
-- applications, holds, bookings, payments, invoices and notification logs.
ALTER TABLE events
  ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT '' AFTER venue,
  ADD COLUMN registration_deadline DATETIME NULL AFTER city;

CREATE TABLE IF NOT EXISTS stall_types (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category ENUM('INDIVIDUAL','GROUP','GALLERY') NOT NULL DEFAULT 'INDIVIDUAL',
  width_m DECIMAL(4,1) NOT NULL DEFAULT 3.0,
  depth_m DECIMAL(4,1) NOT NULL DEFAULT 3.0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  includes VARCHAR(255) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stalls (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  stall_type_id CHAR(36) NOT NULL,
  code VARCHAR(20) NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT '',
  status ENUM('AVAILABLE','DISABLED') NOT NULL DEFAULT 'AVAILABLE',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(stall_type_id) REFERENCES stall_types(id),
  UNIQUE KEY uq_event_stall(event_id, code),
  INDEX idx_stalls_event(event_id, status)
);

CREATE TABLE IF NOT EXISTS exhibition_applications (
  id CHAR(36) PRIMARY KEY,
  application_ref VARCHAR(40) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(500) NOT NULL DEFAULT '',
  website_url VARCHAR(500) NULL,
  instagram_url VARCHAR(500) NULL,
  art_form VARCHAR(120) NOT NULL DEFAULT '',
  fascia_name VARCHAR(160) NOT NULL DEFAULT '',
  bio TEXT NOT NULL,
  space_category ENUM('INDIVIDUAL','GROUP','GALLERY') NOT NULL DEFAULT 'INDIVIDUAL',
  preferred_stall_type_id CHAR(36) NULL,
  approx_size_sqm DECIMAL(6,1) NULL,
  special_requirements VARCHAR(500) NOT NULL DEFAULT '',
  agree_terms TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED') NOT NULL DEFAULT 'SUBMITTED',
  admin_notes TEXT NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(preferred_stall_type_id) REFERENCES stall_types(id) ON DELETE SET NULL,
  FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_applications_status(status, created_at),
  INDEX idx_applications_user(user_id),
  INDEX idx_applications_event(event_id)
);

CREATE TABLE IF NOT EXISTS application_media (
  application_id CHAR(36) NOT NULL,
  media_asset_id CHAR(36) NOT NULL,
  kind ENUM('ARTWORK','PORTFOLIO_PDF','DOCUMENT') NOT NULL DEFAULT 'ARTWORK',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY(application_id, media_asset_id),
  FOREIGN KEY(application_id) REFERENCES exhibition_applications(id) ON DELETE CASCADE,
  FOREIGN KEY(media_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stall_holds (
  id CHAR(36) PRIMARY KEY,
  stall_id CHAR(36) NOT NULL,
  application_id CHAR(36) NOT NULL,
  booking_id CHAR(36) NULL,
  expires_at DATETIME NOT NULL,
  released_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(stall_id) REFERENCES stalls(id),
  FOREIGN KEY(application_id) REFERENCES exhibition_applications(id),
  INDEX idx_holds_expiry(expires_at, released_at)
);

CREATE TABLE IF NOT EXISTS stall_bookings (
  id CHAR(36) PRIMARY KEY,
  booking_ref VARCHAR(40) NOT NULL UNIQUE,
  application_id CHAR(36) NOT NULL UNIQUE,
  event_id CHAR(36) NOT NULL,
  stall_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  stall_type_id CHAR(36) NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('PAYMENT_PENDING','CONFIRMED','CANCELLED','EXPIRED','REFUND_PENDING','REFUNDED') NOT NULL DEFAULT 'PAYMENT_PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES exhibition_applications(id),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(stall_id) REFERENCES stalls(id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(stall_type_id) REFERENCES stall_types(id),
  INDEX idx_bookings_status(status),
  INDEX idx_bookings_user(user_id),
  INDEX idx_bookings_event(event_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'SANDBOX',
  method VARCHAR(40) NOT NULL DEFAULT 'ONLINE',
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('PENDING','VERIFIED','FAILED','REJECTED') NOT NULL DEFAULT 'PENDING',
  transaction_ref VARCHAR(120) NULL,
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,
  raw_payload JSON NULL,
  verified_by CHAR(36) NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(booking_id) REFERENCES stall_bookings(id),
  FOREIGN KEY(verified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payments_status(status),
  INDEX idx_payments_txn(transaction_ref)
);

CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  invoice_no VARCHAR(40) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  issued_at DATETIME NOT NULL,
  FOREIGN KEY(booking_id) REFERENCES stall_bookings(id)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id CHAR(36) PRIMARY KEY,
  application_id CHAR(36) NULL,
  booking_id CHAR(36) NULL,
  recipient_email VARCHAR(255) NOT NULL,
  type VARCHAR(60) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES exhibition_applications(id) ON DELETE SET NULL,
  FOREIGN KEY(booking_id) REFERENCES stall_bookings(id) ON DELETE SET NULL,
  INDEX idx_notifications_recipient(recipient_email)
);
