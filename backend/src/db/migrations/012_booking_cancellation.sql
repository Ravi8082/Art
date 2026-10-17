-- 012: cancellation and refund tracking for stall bookings.
ALTER TABLE stall_bookings
  ADD COLUMN cancellation_reason VARCHAR(255) NULL AFTER status,
  ADD COLUMN cancelled_at DATETIME NULL AFTER cancellation_reason;

ALTER TABLE payments
  MODIFY COLUMN status ENUM('PENDING','VERIFIED','FAILED','REJECTED','REFUNDED') NOT NULL DEFAULT 'PENDING';
