-- Add idempotency keys for newly claimed scheduled deliveries.
-- Existing audit rows remain valid with a NULL claim_key.
ALTER TABLE delivery_log ADD COLUMN claim_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_log_claim_key
  ON delivery_log(claim_key)
  WHERE claim_key IS NOT NULL;
