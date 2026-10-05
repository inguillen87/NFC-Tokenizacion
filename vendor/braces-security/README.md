# NexID braces security backport

This private local component copies the published MIT-licensed `braces@3.0.3`
runtime. It is not an official upstream fixed release. The GitHub advisory
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
still lists every published braces version as affected and no patched release.
`UPSTREAM.json` records the original npm tarball integrity and original file hashes;
`LICENSE` preserves the upstream copyright notice.

The local patch rejects nesting deeper than 64 containers before the parser adds
another brace or parenthesis. Callers may set `maxDepth` to an integer from 1 to
128; false, infinite, fractional and larger limits are rejected. Public compile,
expand and stringify walkers validate supplied ASTs iteratively, checking depth
and node cycles before recursion. Expansion's append recursion is bounded, array
flattening is iterative, and an upstream debug print is removed. Existing length
and expansion range checks remain in place. Ordinary patterns retain the original
braces API and output.

The root development dependency anchors this directory; the `$braces` npm
override resolves every transitive `braces` consumer to that same component.
Its separate package name and local version disclose that NexID owns
this backport; they do not assert that upstream published a fix. A registry audit
cannot assess private source, so the Dashboard security tests additionally pin
the upstream provenance, require this exact installed component and exercise
deep strings, supplied ASTs, cycles, all public walkers and real Tailwind globs.
No audit policy or allowlist is modified.

Remove this backport only after a compatible upstream fixed release is published,
or after a separately reviewed Tailwind migration removes the dependency chain.
