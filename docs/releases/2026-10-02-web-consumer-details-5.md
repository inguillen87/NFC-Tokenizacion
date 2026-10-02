# Consumer details 5 — candidate

The Industry Journey shows one complete step at a time on screens up to 760 px.
The card uses the rail's available inner width instead of a 276 px minimum.
The gap matches the two existing 1.1 rem inline gutters, keeping the next card
outside the viewport when a step is snapped into place. The arrows and step
counter above the card continue to show how to navigate; swipe, scroll snapping,
keyboard selection, and reduced-motion behavior use the existing controls.

The preceding source's recorded layout at 320 px had a 276 px active card in a
262 px rail: 31.594 px of its right side and 17.125 px of its image were clipped.
At 390 px only an 8.406 px strip of the next scene was visible. The new layout
addresses the active-card clipping and gives each step space to be read.
It does not change the images, captions, photo treatment, HERO, or large logos.
Tablet and desktop layout above 760 px retains the existing rules.

This is a source candidate, not an accepted publication. The preceding release
was restored to the accepted production baseline after its published comparison
failed: 195 pixels, maximum RGB difference 1, in the partially visible second
wine scene at 390 px in light mode. Observed image and layout inputs matched;
the cause of that raster difference remains unproved. Its records stay failed.
Changing card geometry does not establish that cause or certify visual parity.

Validation must observe the actual new page at 320, 390, and 1440 px in both
themes, across all three industries and steps. It must check that the selected
card, photo, and readable captions fit, and that arrows, counter, keyboard,
swipe, snapping, and reduced motion still work. CI, Preview, isolated Stage,
and all required published comparisons must pass before acceptance. No browser
or publication result is claimed in this candidate document.

The release manifest keeps the same twelve-field contract and increments only
its version, release, and scope. Scope remains NexID web; API, dashboard, NFC,
anti-replay, permissions, consent, and database contracts are unchanged.
No new physical TAP or performance improvement is certified.
