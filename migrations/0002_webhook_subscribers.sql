CREATE TABLE IF NOT EXISTS discord_event_webhook_subscribers (
  discord_id TEXT PRIMARY KEY NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  destination_name TEXT NOT NULL DEFAULT '',
  webhook_secret_json TEXT NOT NULL,
  webhook_fingerprint TEXT NOT NULL UNIQUE,
  webhook_id_hint TEXT NOT NULL DEFAULT '',
  destination_revision INTEGER NOT NULL DEFAULT 1 CHECK (destination_revision >= 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  pause_reason TEXT NOT NULL DEFAULT '',
  starting_soon_enabled INTEGER NOT NULL DEFAULT 0 CHECK (starting_soon_enabled IN (0, 1)),
  consent_version TEXT NOT NULL,
  consented_at INTEGER NOT NULL,
  verified_at INTEGER NOT NULL,
  paused_at INTEGER NOT NULL DEFAULT 0,
  last_test_at INTEGER NOT NULL DEFAULT 0,
  last_delivery_at INTEGER NOT NULL DEFAULT 0,
  last_delivery_status TEXT NOT NULL DEFAULT '',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_success_at INTEGER NOT NULL DEFAULT 0,
  last_failure_at INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS discord_event_webhook_subscribers_active_idx
  ON discord_event_webhook_subscribers (enabled, paused, discord_id);

CREATE INDEX IF NOT EXISTS discord_event_webhook_subscribers_starting_soon_idx
  ON discord_event_webhook_subscribers (starting_soon_enabled, enabled, paused, discord_id);

-- Rate-limit rows intentionally outlive a subscriber deletion so deleting and
-- recreating a destination cannot bypass test/action throttles.
CREATE TABLE IF NOT EXISTS discord_event_webhook_action_limits (
  discord_id TEXT NOT NULL,
  action TEXT NOT NULL,
  last_claim_at INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  window_expires_at INTEGER NOT NULL,
  action_count INTEGER NOT NULL DEFAULT 0 CHECK (action_count >= 0),
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (discord_id, action)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS discord_event_webhook_action_limits_expiry_idx
  ON discord_event_webhook_action_limits (expires_at, discord_id, action);

CREATE TABLE IF NOT EXISTS discord_event_webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  discord_id TEXT NOT NULL,
  destination_revision INTEGER NOT NULL DEFAULT 1 CHECK (destination_revision >= 1),
  delivery_key TEXT NOT NULL,
  variant_hash TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  scheduled_for INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'dead')),
  queue_token TEXT NOT NULL DEFAULT '',
  claim_token TEXT NOT NULL DEFAULT '',
  claim_expires_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  message_ids_json TEXT NOT NULL DEFAULT '[]',
  completed_batches_json TEXT NOT NULL DEFAULT '[]',
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  permanent_failure INTEGER NOT NULL DEFAULT 0 CHECK (permanent_failure IN (0, 1)),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  queued_at INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER NOT NULL DEFAULT 0,
  failed_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (discord_id, destination_revision, delivery_key, variant_hash),
  FOREIGN KEY (discord_id) REFERENCES discord_event_webhook_subscribers(discord_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS discord_event_webhook_deliveries_status_time_idx
  ON discord_event_webhook_deliveries (status, next_attempt_at, claim_expires_at, scheduled_for);

CREATE INDEX IF NOT EXISTS discord_event_webhook_deliveries_subscriber_time_idx
  ON discord_event_webhook_deliveries (discord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS discord_event_webhook_deliveries_queued_time_idx
  ON discord_event_webhook_deliveries (status, queued_at, id);

CREATE INDEX IF NOT EXISTS discord_event_webhook_deliveries_retention_idx
  ON discord_event_webhook_deliveries (status, updated_at, id);
