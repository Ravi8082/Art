-- 015: payment proof attachment for manual (bank transfer / UPI) payments.
-- The mockup's "Stall Payment Verification" panel shows a downloadable proof, so the
-- reference a payer submits has to be stored against the booking, not just logged.
ALTER TABLE stall_bookings
  ADD COLUMN payment_proof_asset_id CHAR(36) NULL AFTER cancellation_reason,
  ADD CONSTRAINT fk_booking_payment_proof FOREIGN KEY (payment_proof_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
