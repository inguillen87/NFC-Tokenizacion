# Industrial NFC packaging specification

This contract closes a practical gap between a secure NFC chip profile and a
factory-ready packaging consumable. A carrier profile such as NTAG 424 DNA or
NTAG 424 DNA TagTamper does not determine adhesive, label construction, roll
geometry, antenna performance on the package, or packaging-line compatibility.

The executable validation contract lives in
`apps/api/src/lib/supplier-packaging-spec.ts`.

## Wet, dry, or finished label

- A **dry inlay** is a converter component. It is appropriate when a qualified
  label converter will laminate, add face stock and adhesive, die-cut, print,
  encode, inspect, and rewind the finished construction. It should not be sent
  to a customer's normal pressure-sensitive label applicator as if it were a
  finished label.
- A **wet inlay** adds pressure-sensitive adhesive and release liner. It can be
  useful for controlled manual pilots or as another converter input, but it is
  not automatically compatible with a production applicator, the package
  surface, chemicals, abrasion, or visual artwork.
- A **converted smart label** is the preferred enterprise deliverable when the
  customer already applies pressure-sensitive labels from rolls. The converter
  delivers the NFC inlay inside a finished label whose face stock, adhesive,
  liner, pitch, web width, roll core, outer diameter, winding and unwind
  direction match the line.

Therefore, `wet` versus `dry` is normally a supplier/converter manufacturing
decision. The customer-facing purchase specification should name the finished
smart-label construction and its qualified line parameters.

## Required production facts

Before a factory pack is approved, Supplier Ops must record and validate:

1. Construction: inlay form, chip/carrier profile, face stock, adhesive, liner
   and substrate material.
2. Geometry: finished label and antenna dimensions, pitch and web width.
3. Roll: core and maximum outer diameter, face-in/face-out winding, unwind
   direction and labels per roll.
4. Line: automatic/manual/converter-led application, nominal units per minute,
   and printer/encoder model where applicable.
5. Environment: temperature range, liquid or metal proximity, outdoor UV and
   named chemical exposure.
6. TagTamper: conductive tail length, placement across the real opening path,
   and physical closed/open behavior.
7. Approval evidence: RF sample on the real filled package, packaging-line
   trial, adhesive/chemical test, artwork/die-line approval, and encoding plus
   read-back trial.

Free-form `material_type` or notes do not satisfy this gate.

## Pilot assumptions for agrochemical containers and seed bags

These are engineering starting points, not confirmed Syngenta specifications:

- For an HDPE agrochemical container, test the actual filled package and cap.
  Liquid proximity can detune NFC. If TT is sold, the conductive tail must cross
  the closure that actually moves when the container is opened; a label placed
  only on the static cap or body cannot evidence opening.
- For flexible or woven seed bags, test adhesion, bending, abrasion, stacking
  pressure, placement relative to seams/folds, and read range on the real filled
  bag. A smooth laboratory coupon is insufficient.
- In both cases, prefer a finished encoded roll compatible with the existing
  applicator. Start with a small converter and line trial before authorizing the
  full quantity.

The platform must not claim that passing these software fields proves RF,
adhesive, seal, contents, or packaging performance. Those claims require the
recorded physical approvals.

## Safe rollout state

The domain validator currently supports draft and production-readiness
decisions. Persisting the specification, separating operator assertions from
independent approvals, and blocking supplier-pack export until approval are the
next integration steps. Existing physical samples must remain explicitly
`legacy_unverified`; they must not be silently relabelled production-approved.
