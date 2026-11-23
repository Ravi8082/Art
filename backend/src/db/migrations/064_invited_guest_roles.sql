ALTER TABLE invited_guests
  ADD COLUMN role_badge VARCHAR(80) NOT NULL DEFAULT 'Special Invitee' AFTER name,
  ADD COLUMN role_summary VARCHAR(500) NOT NULL DEFAULT '' AFTER designation;

UPDATE invited_guests
SET role_badge = CASE name
  WHEN 'Guest of Honour (Placeholder)' THEN 'Guest of Honour'
  WHEN 'Art Patron (Placeholder)' THEN 'Celebrity Patron'
  WHEN 'Cultural Dignitary (Placeholder)' THEN 'Cultural Dignitary'
  ELSE 'Special Invitee'
END;
