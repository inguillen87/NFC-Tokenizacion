// Identify the compiled deferred module by its export and its own two surfaces.
// No endpoint or hash is a module identity; absence and ambiguity must stop QA.
const CTA_ACTIONS_MARKERS = ['CtaActions', 'sun-public-cta', 'sun-advanced-actions'];

export function selectCtaActionsChunk(chunks) {
  const matches = chunks.filter(({ name, source }) => name.endsWith('.js')
    && CTA_ACTIONS_MARKERS.every(marker => source.includes(marker)));
  if (matches.length !== 1) {
    const names = matches.map(({ name }) => name).sort().join(', ');
    throw new Error(`Expected exactly one built CtaActions chunk; found ${matches.length}${names ? ': ' + names : ''}`);
  }
  return matches[0].name;
}
