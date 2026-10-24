# NexID Zod 3 bounded-collection backport

Private local component based on zod3.25.76 under its MIT license. This is not an official upstream patched release. The +nexid.1 version suffix identifies the local build while retaining the declared major3 peer API.

The security change rejects arrays exceeding .max() or upper .length(), and sets exceeding .max()/.size(), before parsing their members, in source, ESM and CommonJS. It follows the constrained-collection boundary of upstream commit a0ebf970f2d752e5f58527cd2942ff48be4f46bd. Oversized collections remain rejected but no longer run member/outer-refinement callbacks; some union error trees therefore change. Ordinary accepted inputs, lower bounds, transformations and error metadata retain the major3 API.

This component exports only the major3 root and /v3 API required by Hardhat/plugins. The old bundled v4 API is intentionally excluded; production API, SDK and Upstash use the separately patched official Zod4.6.7. No claim is made to bound unrestricted arrays/maps, preprocess work or custom refinements. The tuple allocation path is unchanged. Callers still need input-size budgets.

UPSTREAM.json records tarball integrity, all selected original file hashes and the complete local inventory. npm audit does not inspect linked local source. Mandatory behavioral/provenance tests before the registry audit and installed-consumer tests after installation verify this component; a registry count alone is not acceptance.
