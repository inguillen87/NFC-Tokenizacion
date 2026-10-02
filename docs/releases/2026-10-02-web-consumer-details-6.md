# Consumer details 6 — candidate

The Industry Journey's mobile rail fixes each implicit column at 100% of the
available content width. This replaces the preceding candidate's
`minmax(0, 100%)` rule only inside the existing Industry Journey selector and
the breakpoint up to 760 px. The existing 2.2 rem gap stays unchanged.

The preceding source, `25f9c171bdc6ca67522bad81eea5b16e5e06e08f`, passed CI
but failed its first native focal run. At 320 px the selected card measured
52.140625 px wide and its photo 23.203125 px wide; the next-step wait timed out.
Bounds alone did not establish that the card filled its available width. The
failed report, screenshots, helper, and configuration remain unchanged.

A separate, explicitly styled prototype on that same source changed only
`grid-auto-columns` to `100%`. It observed a 226.8125 px card and a 197.875 px
photo, with next, previous, Home, and End selection functioning across fourteen
recorded states. That prototype supports this source change; it is not native
acceptance of this new candidate or a published result.

The candidate does not change the rail controller, arrows, counter, roving
keyboard focus, swipe, scroll snapping, reduced motion, captions, photo assets,
HERO, or large logos. Shared rules and layout above 760 px remain unchanged.
The twelve-field release manifest increments only version, release, and scope.
API, dashboard, NFC security, anti-replay, permissions, consent, and database
contracts remain unchanged.

Build, CI, Preview, isolated Stage, and all required published checks for this
candidate are pending. Native validation must measure the active card against
the rail's available content width, in addition to its visible bounds, photo
size, caption legibility, and navigation. Cover 320 and 390 px in both themes,
all three industries and steps, desktop, and the 760/761 px breakpoint boundary.
Required comparisons retain zero RGBA differences; previous failed comparisons
remain failed. No historical raster cause, speed improvement, or new physical
TAP certification is claimed. Production acceptance remains pending.
