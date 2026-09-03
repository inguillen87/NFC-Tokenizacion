# SUN post-tap location — physical certification matrix

Status: **PENDING EXTERNAL EVIDENCE**. Source tests do not certify browser permission behavior, NFC hardware, deployed map tiles, physical seal integration, or production state.

## Purpose

This matrix validates the public SUN location experience without turning browser geolocation into a physical-product claim. It complements the existing physical NFC evidence pack; it does not replace it and never upgrades `physical_tag_certification`, `tagtamper_physical_certification`, exact GPS, route, custody, contents, or ownership claims.

The executable validator accepts only hashed evidence references. Do not place raw coordinates, UID values, SUN dynamic parameters, fresh capabilities, credentials, or unredacted URLs in the matrix.

## Required coverage

| Gate | iOS Safari | Android Chrome | Acceptance |
|---|---:|---:|---|
| Fresh physical tap reporting `VALID_CLOSED` | Pending | Pending | HTTPS passport opens; origin remains declared; map base is visible; permission is not requested automatically; explicit consent saves a fresh approximate receipt with `accuracyM`; map updates without reload; no line is drawn. |
| Fresh physical tap reporting `VALID_OPENED` or `VALID_OPENED_PREVIOUSLY` | Pending | Pending | Same location gates; the reported TT state is visible but does not claim that the package integration was physically certified. |
| Retry after a pre-consumption failure (`timeout`, `stale`, `unavailable`, or recoverable denial) | Pending | Pending | Retry is offered; no false “saved” state appears; a new measurement can complete while the signed tap capability is still valid. |
| Red/IP observation | One shared run pending | One shared run pending | Label says approximate network/IP area, not phone location; map base remains visible; no line is drawn. |
| Demo Lab | One shared run pending | One shared run pending | Source is `demo`; map base and dotted demo connection are visible; the physical-route disclaimer is visible. |

Each physical row needs a unique hashed event reference, hashed response receipt, hashed screenshot, full deployment commit SHA, deployment ID, a clean HTTPS target without query or fragment, and timestamps showing the browser measurement occurred within the fresh handoff window. Screenshot review must cover both portrait mobile layout and the expanded location details. Stable DOM evidence is available through `data-location-state`, `data-location-receipt`, `data-basemap-state`, `data-location-source`, and `data-route-mode`; it complements, but does not replace, the visual and device observations.

## Matrix shape

Create an untracked JSON file under `artifacts/` with:

- `schemaVersion`: `nexid-sun-location-physical-matrix/v1`.
- `target`: `environment`, `webUrl`, full 40-character `deploymentSha`, `deploymentId`, and ISO `testedAt`.
- `claims`: `exactGpsCertified`, `physicalRouteCertified`, and `physicalAuthenticityCertified`, all `false`.
- `runs`: exactly four physical observations: `ios_safari` and `android_chrome`, each with `closed` and `opened`.
- `retryRuns`: exactly one recoverable retry observation per platform.
- `networkRun`: an `edge_ip_approx` or `ip_geo` presentation check.
- `demoRun`: a `simulated_demo` presentation check.

Every evidence reference uses `sha256:<64 lowercase hex characters>`. The validator intentionally rejects raw fields such as `lat`, `lng`, `uid`, `freshToken`, `picc_data`, `enc`, and `cmac` anywhere in the JSON.

Run:

```text
npm.cmd run evidence:sun-location:validate -- artifacts/<reviewed-matrix>.json
```

A successful validator result is `complete_for_human_review`, not an automated physical certification. Human review must still reconcile the tested deployment ID and commit SHA with the intended release and inspect the captured evidence. Production promotion remains a separate approval and deployment gate.

Because the basemap is now visible independently of demo-route mode, deployment review must also approve the configured map provider and its network/privacy terms. `no-referrer` prevents disclosure of the passport URL and identifier, but the provider still observes the requester IP and requested tile area.
