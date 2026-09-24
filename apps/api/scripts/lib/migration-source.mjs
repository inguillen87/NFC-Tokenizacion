/** Run the canonical LF source regardless of checkout line endings.
 * Git's CRLF checkout must not change dollar-quoted exact-fragment migrations.
 * Escaped SQL sequences and lone carriage-return characters remain untouched.
 */
export function canonicalMigrationSql(source) {
  if (typeof source !== 'string') throw new TypeError('migration_source_must_be_text');
  return source.replaceAll('\r\n', '\n');
}
