ALTER TABLE visitor_registration_challenges ADD COLUMN state VARCHAR(120) NULL;
ALTER TABLE event_registrations
  ADD COLUMN visitor_state VARCHAR(120) NULL,
  ADD COLUMN visitor_city VARCHAR(120) NULL;
