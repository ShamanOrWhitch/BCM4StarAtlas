# Warp Visual Tiers — Mini-Sim 0.9.109

Updated: 2026-10-21. Entry point: `mini-sim/assets/js/deep-space-warp.js`.

## Slot mapping (temporary visual policy)

The display tier is based on the **Warp Drive component slot size**, not the ship hull's own class. Galaxy API item records expose `slots.componentSlots`; the selected ship's Warp Drive component has to be resolved before this mapping can represent live equipment.

| Warp Drive slot | Visual class | Current preview |
| --- | ---: | --- |
| X-Small | I | Standard curved-shell tunnel. This is the default preview while Opal Jetjet's actual component record is not yet connected. |
| Small | I | Standard curved-shell tunnel for now. |
| XX-Small | II | Four helical cyan/amber ion rails — the stronger look moved here at the user's request. |
| Medium | III | Prototype with additional shifting energy arcs over Class II rails. |
| Large / Capital / Class 8 | IV | Prototype with heavier paired stargate hoops, junction pulses and the lower-tier rails. |

This table records the user's current visual preference; it is not a claim that effect strength must monotonically increase with slot size. Opal Jetjet (`OPALJJ`) has an X-Small hull, but the selected ship's live Warp Drive component-slot value is **not yet integrated**. Therefore, the standard look is the temporary default rather than an inferred live equipment result.

## Preview control

While the Tube view is active, the compact **ВИД I / II / III / IV** selector at the upper-right previews all four visuals live. Preview changes only decorative Canvas drawing; it does not change the selected destination, collision rules, obstacles, steering, tilt, speed ramp, duration, or audio. The next Tube run resets to the mapped component-slot class. Integrators can use `window.BCMDeepSpaceWarpPreviewClass(1..4)` for deterministic visual QA, `window.BCMDeepSpaceWarpSetDriveSlot(slotSize)` to set the actual input slot-size string, and `window.BCMDeepSpaceWarpGetVisualClass()` / `window.BCMDeepSpaceWarpGetPreviewClass()` to inspect the mapping and temporary override.

## Implemented visuals

- **Class I**: existing standard tunnel shell and seams; no helical rail overlay.
- **Class II**: four flowing helical ion rails and travelling pulses.
- **Class III**: Class II rails plus several drifting energy arcs.
- **Class IV**: Class III effects plus three paired stargate hoops and pulsing junction nodes.

All variants use the current 2D Canvas renderer. No new WebGL renderer, external textures or collision surfaces are added.

## Still pending

- Match the selected ship mint against Galaxy API data, resolve its actual Warp Drive entry in `slots.componentSlots`, and call the slot bridge with a verified value.
- Check all four previews in a browser at desktop and phone widths; verify that the selector does not obscure Tube steering or the center of the view.
- Do not call preview selection live equipment metadata, and do not describe Class III/IV as final ship art before user review.
