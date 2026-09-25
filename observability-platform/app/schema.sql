CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  item          VARCHAR(255) NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
