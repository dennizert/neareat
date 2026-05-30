CREATE TABLE IF NOT EXISTS place_requests (
  id            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id      TEXT        NOT NULL,
  place_name    TEXT        NOT NULL,
  place_address VARCHAR(300),
  note          VARCHAR(500),
  status        TEXT        NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS place_requests_user_id_place_id_key
  ON place_requests(user_id, place_id);

CREATE INDEX IF NOT EXISTS place_requests_status_created_at_idx
  ON place_requests(status, created_at);
