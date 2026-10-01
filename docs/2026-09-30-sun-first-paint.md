# SUN mobile: first content and location readiness

The public web keeps its own production lineage. A Next loading boundary shows a neutral branded placeholder while the signed snapshot resolves; it does not claim authenticity or invent product data. The snapshot read is bounded through headers/body and never retries the dynamic scan when a signed handoff fails.

The summary no longer starts invisible during 560/700ms animations. Its small missing-photo fallback no longer loads 3D/globe components; an honest neutral product icon appears instead. Real product images retain eager/high-priority loading and now decode asynchronously. The existing map remains available with its existing viewport-triggered loading.

Localizing small UI updates now visits changed subtrees, not the complete passport on every geolocation/map mutation. Server evidence is excluded and the observer is disconnected for its own mutations. The original locale preference contract remains.

Location permission remains optional, explicit and bound to the same tap. No automatic request, stale fix, weaker measurement, changed coordinate rounding or added telemetry is introduced. Location is not a prerequisite to viewing the passport.

Dependencies were aligned to the set already validated in PR389, without transplanting API/dashboard code. The web branch predates those security fixes. The two tests referencing the previous hero or MapLibre version now assert the intended lightweight fallback and approved version while retaining the truth/map checks.

The changes were initially prepared and tested locally. On remote-device disconnection they were reconstructed in a dedicated GitHub feature-branch job, whose one-off preparation files are removed from its final tree. CI validates the final source before integration. No physical-phone latency or production performance percentage is claimed by these synthetic tests. No production DB, NFC secrets, customer records or feature flags are changed.
