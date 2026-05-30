CREATE TABLE IF NOT EXISTS notification_preferences (
  id          TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_id_type_key
  ON notification_preferences(user_id, type);

CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx
  ON notification_preferences(user_id);
