ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS sequence_index integer;

WITH numbered_sub_batches AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY supplier_order_id ORDER BY created_at ASC, id ASC)::integer AS generated_sequence_index
  FROM supplier_sub_batches
  WHERE sequence_index IS NULL
)
UPDATE supplier_sub_batches ssb
SET sequence_index = numbered_sub_batches.generated_sequence_index
FROM numbered_sub_batches
WHERE ssb.id = numbered_sub_batches.id;

ALTER TABLE supplier_sub_batches ALTER COLUMN sequence_index SET DEFAULT 1;
ALTER TABLE supplier_sub_batches ALTER COLUMN sequence_index SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_order ON supplier_sub_batches(supplier_order_id, sequence_index);
