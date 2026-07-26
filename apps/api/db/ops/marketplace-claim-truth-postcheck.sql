-- Read-only release postcheck for migration 0059.
-- Must return one row with both booleans true and zero invalid rows.
SELECT
  NOT a.attnotnull AS trust_score_is_nullable,
  d.adbin IS NULL AS trust_score_has_no_default
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = current_schema()
  AND c.relname = 'consumer_product_experiences'
  AND a.attname = 'trust_score'
  AND NOT a.attisdropped;

SELECT COUNT(*)::int AS not_computed_rows_with_numeric_score
FROM consumer_product_experiences
WHERE COALESCE(metadata_json->>'trust_score_status', '') = 'not_computed'
  AND trust_score IS NOT NULL;
