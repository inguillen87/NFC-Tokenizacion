import { sql } from './db';

/** Touch the canonical tag row before writing the declaration. Its xmin is a
 * revision fence for concurrent commercial readers, including a first override.
 * No chip result, lifecycle field or cryptographic evidence is changed. */
export async function markTagManuallyOpened(input: { batchId: string; tenantId: string; uidHex: string; reason: string; evidenceNote: string; source: string }) {
  const rows = await sql`
    WITH locked_tag AS MATERIALIZED (
      SELECT tag.id FROM tags tag JOIN batches batch ON batch.id=tag.batch_id AND batch.tenant_id=${input.tenantId}::uuid
      WHERE tag.batch_id=${input.batchId}::uuid AND UPPER(tag.uid_hex)=UPPER(${input.uidHex}) ORDER BY tag.id FOR UPDATE OF tag
    ), touched_tag AS (
      UPDATE tags tag SET status=tag.status FROM locked_tag WHERE tag.id=locked_tag.id AND (SELECT count(*) FROM locked_tag)=1 RETURNING tag.id
    )
    INSERT INTO tag_manual_tamper_overrides(batch_id,uid_hex,tamper_status,reason,evidence_note,source,updated_at)
    SELECT ${input.batchId}::uuid,${input.uidHex},'MANUAL_OPENED',${input.reason},${input.evidenceNote},${input.source},clock_timestamp() FROM touched_tag
    ON CONFLICT(batch_id,uid_hex) DO UPDATE SET tamper_status='MANUAL_OPENED',reason=EXCLUDED.reason,evidence_note=EXCLUDED.evidence_note,source=EXCLUDED.source,updated_at=clock_timestamp()
    RETURNING batch_id,uid_hex`;
  return rows.length === 1;
}
