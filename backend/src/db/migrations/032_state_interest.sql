CREATE TABLE IF NOT EXISTS state_interest (
  email VARCHAR(255) NOT NULL,
  state VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, state),
  INDEX idx_state_interest_state (state)
);
