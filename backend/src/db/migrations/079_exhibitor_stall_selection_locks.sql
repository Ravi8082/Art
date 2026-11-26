UPDATE stall_holds
SET released_at = NOW()
WHERE released_at IS NULL AND expires_at <= NOW();

UPDATE stall_bookings b
SET status = 'EXPIRED'
WHERE b.status = 'PAYMENT_PENDING'
  AND NOT EXISTS (
    SELECT 1
    FROM stall_holds h
    WHERE h.booking_id = b.id
      AND h.released_at IS NULL
      AND h.expires_at > NOW()
  );

UPDATE payments p
JOIN stall_bookings b ON b.id = p.booking_id
SET p.status = 'FAILED'
WHERE p.status = 'PENDING' AND b.status = 'EXPIRED';

ALTER TABLE stall_holds
  MODIFY COLUMN application_id CHAR(36) NULL,
  ADD COLUMN user_id CHAR(36) NULL AFTER application_id,
  ADD COLUMN active_stall_id CHAR(36)
    GENERATED ALWAYS AS (CASE WHEN released_at IS NULL THEN stall_id ELSE NULL END) STORED,
  ADD COLUMN active_selection_user_id CHAR(36)
    GENERATED ALWAYS AS (CASE WHEN released_at IS NULL AND booking_id IS NULL THEN user_id ELSE NULL END) STORED,
  ADD INDEX idx_stall_holds_user_active (user_id, released_at, expires_at),
  ADD UNIQUE KEY uq_active_stall_hold (active_stall_id),
  ADD UNIQUE KEY uq_active_selection_user (active_selection_user_id);

UPDATE stall_holds h
JOIN stall_bookings b ON b.id = h.booking_id
SET h.user_id = b.user_id
WHERE h.user_id IS NULL;

ALTER TABLE stall_bookings
  ADD COLUMN active_stall_id CHAR(36)
    GENERATED ALWAYS AS (
      CASE WHEN status IN ('PAYMENT_PENDING', 'CONFIRMED', 'REFUND_PENDING') THEN stall_id ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_active_stall_booking (active_stall_id);
