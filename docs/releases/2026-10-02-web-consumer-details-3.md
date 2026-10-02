# Consumer details 3 — candidate

The Industry Journey uses the scene images without an additional CSS color
filter in either theme. The existing scrim, caption panels, tags, and motion
remain. This keeps details in the illustrations more readable in dark mode and
uses the same image treatment in light mode. Other photo consumers retain their
existing filters. The large brand logos and HERO animations remain intact.

This candidate also includes the SUN progressive tools, focus handling, map
interaction, entry loading changes, and responsive image sizing committed in
the preceding candidate. These changes have not been accepted in Production.

The preceding candidate was restored to the prior production version after a
strict visual comparison failed: 182 pixels, maximum RGB difference 1, in the
partially visible second wine scene at 390 px in light mode. Observed assets,
styles, layout, and browser environment matched. The raster cause has not been
proved. The original failed records remain unchanged in their own worktree.

The new candidate requires its own CI, Preview, staged deployment, responsive
light/dark checks, published checks, and exact source/deployment reconciliation.
Removing the filter does not by itself prove that the visual failure is fixed
or that loading is faster. Publication is pending those checks.

Scope is NexID web only. No API or dashboard redeployment, database migration,
NFC validation, anti-replay, consent, or permissions change is included. A new
physical TAP is not certified by this release.
