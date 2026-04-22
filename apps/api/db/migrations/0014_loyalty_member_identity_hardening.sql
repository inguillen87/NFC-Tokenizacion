ALTER TABLE loyalty_members
  ADD COLUMN IF NOT EXISTS consumer_id uuid REFERENCES consumers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_key text;

UPDATE loyalty_members lm
SET member_key = COALESCE(lm.member_key, 'event:' || lm.event_id::text, 'member:' || lm.id::text)
WHERE lm.member_key IS NULL;

ALTER TABLE loyalty_members
  ALTER COLUMN member_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_member_key
  ON loyalty_members(program_id, member_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_consumer
  ON loyalty_members(program_id, consumer_id)
  WHERE consumer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_consumer_program
  ON loyalty_members(consumer_id, program_id);
