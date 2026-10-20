# Warp Visual Tiers — Mini-Sim 0.9.106

Updated: 2026-10-20. Entry point: `mini-sim/assets/js/deep-space-warp.js`.

## Slot-size scale

Choose the visual class by the **Warp Drive component slot size**, not by the ship hull's own class. Galaxy API item records include `slots.componentSlots`; the selected ship's entry must be inspected to identify the Warp Drive slot. Manufacturers can vary component size relative to hull size, so do not infer it from `attributes.class` alone.

| Warp Drive slot | Visual class | State |
| --- | ---: | --- |
| XX-Small or X-Small | 1 | Current baseline tunnel; additional Class 1 styling is not yet implemented |
| Small | 2 | First visual upgrade implemented as a test profile |
| Medium | 3 | Class mapping is ready; dedicated ring effects are not implemented yet |
| Large / Capital / Class 8 | 4 | Reserved for later flagship effects |

Opal Jetjet (`OPALJJ`) is the reference for this first **Class 2** iteration based on the user's observation of its Warp Drive slot. This is a staged preview, not a claim that the NFT's live slot metadata is already wired to Mini-Sim.

## Class 2 visual addition

The current 2D Canvas Tube renderer adds four animated helical ion rails over the existing curved shell, with cyan and warm amber pulses. They are decorative only: collision math, obstacle sequence, steering, speed ramp, phone tilt, sound, and the Warp travel duration are unchanged. No new WebGL renderer, external textures, or geometry batches are added.

## Selected-ship integration still pending

Mini-Sim currently has no active selected-ship Warp Drive slot-size field available to this renderer. The bridge `window.BCMDeepSpaceWarpSetDriveSlot(slotSize)` accepts the resolved slot-size string and switches the visual class. The next integration step is to match the selected ship mint against Galaxy API data, inspect its actual Warp Drive entry in `slots.componentSlots`, then call this bridge. Until that is done, the test preview defaults to `Small` / Class 2.

Do not build all four looks in one pass. Validate Class 2 in the existing browser/gamepad/mobile path first, then implement the Medium / Class 3 ring effect separately.
