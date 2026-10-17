-- 013: database-level guarantee that a stall never holds two live bookings.
-- active_marker is non-NULL only while a booking still occupies the stall, so the
-- unique index lets cancelled/expired/refunded history rows coexist.
ALTER TABLE stall_bookings
  ADD COLUMN active_marker CHAR(36)
    GENERATED ALWAYS AS (CASE WHEN status IN ('PAYMENT_PENDING', 'CONFIRMED', 'REFUND_PENDING') THEN stall_id ELSE NULL END) VIRTUAL,
  ADD UNIQUE KEY uq_active_booking_per_stall (active_marker);
