# About 3D Approved Animation Sequences and Events

This is the maintained source of truth for the approved About-page camera animation, wide-chart traversal, and independent cinematic events. Update this file whenever the user approves, removes, or revises a sequence or event. Future changes must preserve every approved rule below unless a later requirement explicitly changes it.

## Current approval status

- Camera Sequences 1 through 4 are approved.
- Wide-chart traversal is approved.
- The fixed-world comet, UFO encounter, and lightning effects are approved.
- Events are overlays only. They must not interrupt or alter the approved camera sequences.

## Approved sequence loop

1. **Sequence 1 — Initial view to P-hole flyby**
   - Begin at the same front-facing composition used by the introductory 2D PMT SVG.
   - Fly forward through the opening in the PMT letter P.
   - Keep the motion cinematic, level, and continuous.

2. **Sequence 2 — P-hole exit to a random Dev chart**
   - Select a random Dev Task chart before leaving the P-hole.
   - Fly directly toward it with a gradual arrival slowdown.
   - Do not snap to a forced front-and-center camera pose, stop, bounce, reverse, pause, or hold.
   - Precompute the selected QA route and blend into its opening curve before the Dev approach ends.
   - Preserve forward momentum and a continuous target position, heading, and FOV when handing off to Sequence 3.

3. **Sequence 3 — Dev chart to a random Bug Tracking / QA chart**
   - Select a random QA chart and turn toward it while continuing forward.
   - Continue from the precomputed and pre-blended QA curve used at the end of Sequence 2.
   - Do not reconstruct the normal QA route at the sequence boundary or use backing or retreat waypoints.
   - Arrive naturally and continue into Sequence 4.

4. **Sequence 4 — QA chart to the initial view**
   - Follow a smooth return curve toward the front of the gallery.
   - Focus on the PMT logo during the return instead of looking into empty space.
   - Finish at the exact initial-view composition and direction, then repeat Sequence 1.

## Wide-chart traversal

- The behavior is dimension-based and reusable for Dev or QA charts.
- Any chart wider than the standard viewport threshold is approached at its upper-left area.
- Traverse from the upper-left starting area to the chart's actual far edge at a constant `5` world-units per second.
- The displayed completion percentage measures the real chart span; `100%` is the far edge.
- Do not accelerate, impose a fixed duration, add an exit runway, pause, or hold after traversal.
- Continue immediately to the next approved sequence.
- Derive the approach target, traversal span, percentage, and exit from the rendered chart width and wall orientation. Do not special-case chart names.
- A wide Dev traversal ends at a different physical position, so it may build its QA route from that actual traversal endpoint. This is the intentional exception to the normal precomputed Sequence 2 handoff.

## Approved cinematic events

| Event | When it may run | Approved behavior | Camera influence |
| --- | --- | --- | --- |
| P-hole comet | When the camera exits the P-hole | Launch one comet in fixed world space | None |
| Background comet | Occasionally during the scene | Cross the distant fixed-world background | None |
| UFO encounter | During Sequence 4 | Orbit, inspect PMT with its beam, speak, and depart | None |
| PMT lightning | During Sequence 4 | Strike PMT, create sparks and heat glow, and flash the full scene | None |
| UFO lightning | During Sequence 4, on 50% of encounters | Strike the visible UFO, briefly drop and shake it, then let it recover | None |

The first successful UFO lightning strike after the About scene loads must say: `This PMT really has a lot of spark!` Later successful UFO strikes select a random line from the UFO lightning-reaction pool.

The UFO and lightning schedules are coordinated by the scene, not by the camera controller. The current Sequence 4 event window triggers the PMT strike about `5.2` seconds after Sequence 4 begins and attempts the optional UFO strike about `16` seconds after it begins. The UFO strike is planned independently for each Sequence 4 encounter with probability `0.5`.

## Camera and event invariants

- Default autopilot speed is `2x`; the normal `+` and `-` controls remain available.
- Automatic motion must stay cinematic and avoid forced one-frame position, heading, or FOV changes.
- Manual camera takeover and idle rejoin remain supported.
- UFO and lightning events must never change camera focus, heading, FOV, speed, or path.
- The UFO strike reaction may change only the ship animation and speech.
- Stars and the galaxy are fixed in distant world space and never follow the camera.
- Comets are fixed in world space and never influence the camera.

## Manual control contract

- Holding the left mouse button temporarily controls the camera heading while the automatic flight path continues moving. Releasing the button immediately releases the mouse to the browser. Pointer lock is not used.
- The mouse wheel changes zoom without entering full manual mode or stopping the automatic flight path.
- `W`, `A`, `S`, and `D` move horizontally; `E` moves up; `Q` moves down; and `Shift` boosts manual movement speed.
- Pressing a movement key enters full manual mode and freezes the automatic flight-path phase. Five seconds after the final movement-key input, the camera smoothly rejoins the saved automatic path and resumes it.
- The lower-right `MANUAL` mode panel is interactive only in manual mode. Clicking it starts the same smooth automatic-path rejoin immediately.
- `+` and `-` change automatic flight speed without entering manual mode.
- `Space` pauses or resumes the shared flight-and-event animation clock.
- `Enter` rebuilds the About experience from its initial 2D-logo transition.
- Control hints appear for five seconds when full manual mode begins. Pressing `?` during manual mode displays them for another five seconds.
- `A` triggers the alien encounter, `L` triggers lightning, `C` triggers a comet, `U` triggers the UFO encounter, and `R` randomly selects an alien, lightning, or comet event.
- Because `A` is also the standard WASD strafe-left key, pressing it both strafes left in manual movement and triggers one alien encounter. Key-repeat does not repeatedly trigger the event.
- Manual event hotkeys change event state only. They never alter camera focus, heading, FOV, speed, or flight-path phase.

## Implementation map

- Camera state machine and route geometry: `wwwroot/js/features/about/about-flight-controller.js`
- Scene events, event scheduling, fixed background, and rendering loop: `wwwroot/js/features/about/about-scene.js`
- UFO animation and speech order: `wwwroot/js/features/about/about-ufo.js`
- Lightning visuals and strikes: `wwwroot/js/features/about/about-lightning.js`
- Dev/QA chart geometry and dimensions: `wwwroot/js/features/about/about-workload-billboard.js`
- Browser regression metadata: `tests/browser/about-3d.spec.mjs`
- UFO timing and speech regression tests: `tests/js/about-ufo.test.mjs`

## Safe change procedure

1. Identify whether the request changes a camera sequence, wide-chart behavior, or an independent event.
2. Keep event code out of `about-flight-controller.js`; events must not set camera focus, heading, FOV, speed, or path.
3. For a camera change, alter only the named sequence and preserve continuous target position, quaternion, and FOV across its boundaries.
4. For a wide-chart change, keep the logic based on actual chart dimensions and wall orientation rather than a specific chart name.
5. Update this document and the related `data-about-*` browser regression metadata in the same change.
6. Cache-bust the About module chain so a browser refresh loads the new behavior.
7. Ask the user to visually approve camera-path changes before making another camera-path alteration.

The bottom debug panel reports the active action and selected destinations. The `data-about-*` attributes on the About scene expose the approved sequence, traversal, event, and camera-influence state used by the browser regression test.
