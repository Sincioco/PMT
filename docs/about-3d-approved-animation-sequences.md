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
   - Precompute Sequence 4 and blend into its opening curve before the normal QA-chart approach ends.
   - Preserve continuous target position, heading, and FOV when handing off to Sequence 4.
   - Arrive naturally and continue into Sequence 4.

4. **Sequence 4 — QA chart to the initial view**
   - Follow a smooth return curve toward the front of the gallery.
   - Focus on the PMT logo during the return instead of looking into empty space.
   - Finish at the exact initial-view composition and direction, then repeat Sequence 1.

## Wide-chart traversal

- The behavior is dimension-based and reusable for Dev or QA charts.
- Any chart wider than the standard viewport threshold is approached at its upper-left area.
- Traverse from the upper-left starting area until the chart's far data edge is fully visible at a constant `5` world-units per second.
- The calibrated camera-center route begins at `-0.30` of panel width and ends at `+0.34`, for a total traversal span of `0.64` of the rendered panel width. This replaces the former `0.80` span because visual testing showed the data was already fully traversed at `80%` of that longer route.
- The displayed completion percentage measures this calibrated visible traversal; `100%` means the far data edge is fully visible without flying beyond it.
- Ease from the `48` degree wide-chart approach FOV to a `56` degree traversal FOV so low-positioned chart data stays visible during the fly-through.
- Do not accelerate, impose a fixed duration, add an exit runway, pause, or hold after traversal.
- Continue immediately to the next approved sequence.
- Derive the approach target, traversal span, percentage, and exit from the rendered chart width and wall orientation. Do not special-case chart names.
- A wide Dev traversal ends at a different physical position, so it may build its QA route from that actual traversal endpoint. This is the intentional exception to the normal precomputed Sequence 2 handoff.
- A wide QA traversal likewise builds Sequence 4 from its actual calibrated traversal endpoint instead of using the normal precomputed Sequence 3 handoff.

## Approved cinematic events

| Event | When it may run | Approved behavior | Camera influence |
| --- | --- | --- | --- |
| P-hole comet | When the camera exits the P-hole | Launch one comet in fixed world space | None |
| Background comet | Occasionally during the scene | Cross the distant fixed-world background | None |
| UFO encounter | During Sequence 4 | Orbit, inspect PMT with its beam, speak, and depart | None |
| PMT lightning | During Sequence 4 | Strike PMT, create sparks and heat glow, and flash the full scene | None |
| UFO lightning | During Sequence 4, on 50% of encounters | Strike the visible UFO, briefly drop and shake it, then let it recover | None |
| Intergalactic PMT battle | Periodically while the UFO is hovering over PMT | One to three defender ships intercept the original UFO, both sides exchange fire and dialogue, stunned ships recover, and every ship flies away | None; a separate picture-in-picture camera may track the battle |

The first successful UFO lightning strike after the About scene loads must say: `This PMT really has a lot of spark!` Later successful UFO strikes select a random line from the UFO lightning-reaction pool.

Once a UFO encounter has visibly started, it must finish its beam retract and departure/fly-away animation before the ship is hidden, even if Sequence 4 ends while the UFO is still speaking or scanning. If the UFO is struck by lightning, it must remain visible through its recovery long enough to continue and complete the normal exit sequence. Sequence 4 may stop new UFO encounters after its event window ends, but it must drain the active encounter instead of disabling it immediately.

The UFO and lightning schedules are coordinated by the scene, not by the camera controller. The current Sequence 4 event window triggers the PMT strike about `5.2` seconds after Sequence 4 begins and attempts the optional UFO strike about `16` seconds after it begins. The UFO strike is planned independently for each Sequence 4 encounter with probability `0.5`.

## Intergalactic battle event

- Each new UFO encounter independently has a `0.68` probability of attracting a PMT-defense interception.
- Pressing `M` starts a fresh UFO encounter and guarantees the intergalactic battle for that encounter, while still randomly selecting between one and three defender ships.
- Select between one and three interceptor ships. They enter along distinct curves, surround the original UFO, exchange visible laser fire, and then leave along complete departure curves.
- Build every interceptor from the same saucer geometry and glass/metal material structure as the original UFO. Distinguish defenders with magenta, cyan, and gold color palettes rather than unrelated fighter silhouettes.
- The original UFO must return fire. Laser impacts use a short lightning-style electric stun: the original UFO reuses its recovery motion, while interceptor ships briefly drop, shake, and recover.
- Battle dialogue alternates between the original UFO and PMT defenders. Keep lines short, funny, and PMT-related. Render each line in a simple rounded card tinted to the speaking ship's color. Do not add a speech tail, speaker label, or other pointer; the color identifies the speaker.
- Battle dialogue is a screen-anchored conversation stack, independent of both the main camera and the picture-in-picture camera. Show the first line as soon as battle starts, append every later line without removing earlier lines, keep the full transcript visible until every ship completes the battle exit, then let it linger for five more seconds before dismissing it. The conversation remains readable even when no battle ship is in either camera view.
- The battle remains a background event and must never alter the approved flyby camera, speed, FOV, sequence phase, or destination.
- Isolate the battle update from the main animation loop. If a future battle-only runtime error occurs, abort and hide the battle event while allowing the approved flyby and the rest of the 3D scene to continue.
- If the original UFO is outside the comfortable center area of the main camera, show a lower-right `16:9` PMT Defense Feed. Its separate camera remains centered on the PMT logo and must never track an individual UFO or redirect the main camera. Randomize its starting azimuth, height, distance, and slow orbit direction for each battle so the PMT logo is shown from a more cinematic, changing perspective.
- The PMT Defense Feed camera renders a dedicated battle-only layer. Do not render the chart gallery, stars, floor, or other unrelated heavy scene content a second time inside the feed.
- Include the PMT logo in the battle-only feed as a fixed spatial reference so viewers can see where the battle is taking place.
- The feed image and its border must share the same rounded corners. Because the feed is rendered into a rectangular WebGL viewport on the main canvas, mask the four viewport corners in the HTML overlay instead of rounding only the border.
- Do not apply scanlines, CRT treatments, color washes, or other visual effects over the picture-in-picture render.
- The picture-in-picture feed disappears when the main camera frames the battle comfortably, when no UFO remains inside the fixed PMT-centered feed viewport, or when the battle ends. Do not newly open or reopen the feed during the final five seconds of a battle.
- Pressing `1` toggles the battle picture-in-picture feature on or off without changing the main camera or battle animation.
- Pressing `0` toggles all automatic and manual alien-related events on or off. When turned off, prevent new UFO encounters and battles while allowing an already-visible encounter or battle to complete its proper departure rather than disappearing abruptly. Lightning against PMT and comets remain available.
- While a battle is active, that battle owns the original UFO encounter. Sequence 4 and the `A`/`U` hotkeys must not restart or replace it; any overlapping request is deferred or ignored so all defender ships can complete their entry, combat, and departure.
- Once a battle starts, allow it to finish even if Sequence 4 ends. Interceptor ships may become hidden only after reaching their distant departure endpoints; never remove them abruptly near PMT.

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
- `W`, `A`, `S`, and `D` move horizontally; `E` moves up; `Q` moves down; and `Shift` boosts manual movement speed only while the camera is already in keyboard manual mode. `Shift` must not change automatic flyby speed.
- Pressing a movement key enters full manual mode and freezes the automatic flight-path phase. Five seconds after the final movement-key input, the camera smoothly rejoins the saved automatic path and resumes it.
- The lower-right `MANUAL` mode panel is interactive only in manual mode. Clicking it starts the same smooth automatic-path rejoin immediately.
- `+` and `-` change automatic flight speed without entering manual mode.
- The user-selected flyby speed is constant across Sequences 1 through 4. Routes, chart approaches, transitions, and background events must not apply hidden acceleration or slowdown multipliers; only `+` and `-` may change it.
- `Space` pauses or resumes the shared flight-and-event animation clock.
- `Enter` resets the active 3D flyby back to Sequence 1 inside the existing 3D scene. It must not exit the 3D scene, rebuild the About page, or replay the initial 2D-logo intro.
- Control hints appear for five seconds when full manual mode begins. Do not reveal them automatically after Sequence 4. Keep a small `?` panel in the lower-left of the 3D scene. Clicking it or pressing the `?`/slash key in manual or automatic mode toggles the hints without changing the current flight mode: open them for five seconds when hidden, or close them immediately when visible. Shift must not be required.
- Whenever visible, the control hints use a compact vertical list anchored to the upper-left of the 3D scene. Keep one control per line so the hints are readable, but keep the panel small enough that it is noticeable without becoming the main focus.
- The 3D scene canvas may receive browser focus so keyboard controls keep working, but it must not show a focus outline, border, or halo when clicked.
- `A` triggers the alien encounter and guarantees that this manually triggered encounter is struck by lightning during its inspection phase. `L` triggers lightning, `C` triggers a comet, `U` triggers the UFO encounter without the guaranteed strike, `M` triggers a guaranteed intergalactic battle encounter, and `R` randomly selects an alien, lightning, or comet event.
- `A` never enters manual mode or interrupts automatic flight. It triggers one alien encounter with its guaranteed lightning strike while the approved camera sequence continues unchanged. If the camera is already in manual mode, `A` may still strafe left while triggering the encounter. Key-repeat does not repeatedly trigger the event.
- Manual event hotkeys change event state only. They never alter camera focus, heading, FOV, speed, or flight-path phase.

## 3D chart-panel theme

- Dev Task charts, Bug Tracking charts, and gallery user cards always use PMT's dark chart palette and dark glass material because the gallery is set in space.
- The 3D gallery does not observe or redraw from the application's light/dark theme selection. Changing the application theme must not change these panels.
- Keep a large, luminous section label above each gallery wall: `Development Tasks` above the Dev charts, `Bug Tracking` above the Bug Tracking / QA charts, and `Development Team` above the user-card grid. Each label follows its wall orientation and remains readable from the flyby route.

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
