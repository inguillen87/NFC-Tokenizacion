export function normalizeSqlSourceForStaticAnalysis(source) {
  if (typeof source !== "string") {
    throw new TypeError("sql_source_must_be_a_string");
  }
  return source.replace(/\r\n?/g, "\n");
}
