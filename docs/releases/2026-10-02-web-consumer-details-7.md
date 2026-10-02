# Consumer details 7 — candidate

Keep full-width mobile journey cards and preserve the most recent explicit
navigation command while a native horizontal gesture is finishing. A newer
gesture cancels that command; changing industry or unmounting clears pending
work. Scroll targets account for the rail's actual padding and available range.
Keyboard focus, reduced motion, captions, HERO and large logos remain supported.

The preceding source c5e5bc815a71c377c3ab1ecc2126b48fd08fe7a7 passed all
eight CI checks, but its native focal stopped after six of 54 views. A rapid
swipe followed by Previous briefly selected the first card and then returned
to the second. A separate diagnostic observed that return through 1000 ms;
another diagnostic with listeners bound to the mounted rail kept the first
card. This establishes a timing-sensitive regression, not a universal failure
or proof of a historical raster mismatch's cause. Both observations and the
rejected focal remain unchanged.

This candidate requires new source-bound build, CI, native rapid-gesture
regression checks, Preview, isolated Stage, and publication comparisons.
No candidate publication or performance improvement is yet claimed.
Keep the API and dashboard separate. NFC security, anti-replay, consent,
permissions, contracts, dependencies and database migrations are unchanged.
Any benchmark uses synthetic inaccessible queries; it cannot certify a new
physical NFC TAP or GPS performance.
