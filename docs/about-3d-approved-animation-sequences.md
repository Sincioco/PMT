# About 3D Approved Animation Sequences and Events

This is the maintained source of truth for the approved About-page camera animation, wide-chart traversal, and independent cinematic events. Update this file whenever the user approves, removes, or revises a sequence or event. Future changes must preserve every approved rule below unless a later requirement explicitly changes it.

## Current approval status

- Camera Sequences 1 through 7 are approved.
- Wide-chart traversal is approved.
- The fixed-world comet, UFO encounter, and lightning effects are approved.
- Events do not stop or slow the approved camera sequences. When `Track Alien Events` is on and an alien encounter or battle is active in automatic mode, the moving camera slowly pans toward the PMT logo, then smoothly returns to its normal flyby heading. Manual control is never overridden.

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
   - Precompute the selected Documentation destination and Sequence 4 opening curve before the normal QA-chart approach ends.
   - Preserve continuous target position, heading, and FOV when handing off to Sequence 4.
   - Arrive naturally and continue into Sequence 4 without a stop or camera reset.

4. **Sequence 4 — Random QA chart to a random Documentation card**
   - Select one of the rendered Documentation cards independently for each completed gallery cycle.
   - Leave the selected QA chart on a precomputed continuous curve toward that selected Documentation card.
   - Frame the selected card with a wider `60` degree FOV while remaining in forward motion; do not stop, pause, hold, reverse, bump, or snap to it.

5. **Sequence 5 — Random Documentation card to the Kanban Board**
   - Continue directly from the selected Documentation card to the dynamic Kanban Board.
   - Preserve the same continuous position, heading, FOV, and user-selected speed across the Sequence 4/5 boundary.

6. **Sequence 6 — Kanban Board through the PMT `M`/`T` gap**
   - Leave the Kanban Board, curve behind the PMT logo, and approach the open space between the `M` and `T` from the rear.
   - Fly forward through the `M`/`T` gap without detouring to or inspecting the Development Team wall.
   - Compensate the two crossing spline points for Catmull-Rom tangent drift and bias the camera center about `0.05` world units left of the opening midpoint. The complete sampled crossing must remain inside the actual `M`/`T` opening while giving the right side of the view more visual clearance from the `M`.

7. **Sequence 7 — `M`/`T` gap through the Documentation turnaround area**
   - Continue forward from the PMT logo toward the Documentation area only to create enough space for a wide, cinematic U-turn.
   - Do not select, inspect, frame, stop at, or hold on a Documentation card during this leg.
   - Complete the U-turn so the camera arrives at the exact Sequence 1 initial position, direction, and FOV, then repeat Sequence 1 without a cut or reset.

Sequences 4 through 7 are sampled as one continuous arc-length path. Their numbered boundaries are descriptive only and must never introduce a position jump, heading snap, FOV jump, speed change, pause, or hold.

## Inactivity screen saver

- When a logged-in user leaves PMT inactive for five minutes, start the same About intro and 3D scene only if the PMT tab is visible and its browser window is focused.
- Render the experience in a temporary modal overlay with the same bounds as the normal About content area. Do not navigate to About, alter the current URL, replace `#app`, close an open editor, or discard unsaved browser state.
- The first mouse movement dismisses the overlay, disposes its scene, and restores the previous focus when that element still exists.
- If PMT becomes hidden or loses foreground focus, cancel the idle countdown and dismiss any active screen saver. Returning to PMT starts a new five-minute countdown.

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
- A wide QA traversal likewise builds Sequence 4 from its actual calibrated traversal endpoint instead of using the normal precomputed Sequence 3 handoff. It must retain the already-selected random Documentation destination.

## Approved cinematic events

| Event | When it may run | Approved behavior | Camera influence |
| --- | --- | --- | --- |
| P-hole comet | When the camera exits the P-hole | Launch one comet in fixed world space | None |
| Background comet | Occasionally during the scene | Cross the distant fixed-world background | None |
| UFO encounter | From the start of Sequence 5 through Sequence 7, as the camera approaches and passes PMT | Orbit, inspect PMT with its beam, speak, and depart | When `Track Alien Events` is on and the camera is automatic, slowly aim the moving flyby at the PMT logo while the alien is arriving or visible, then return smoothly to the normal heading |
| PMT lightning | From the start of Sequence 5 through Sequence 7 | Strike PMT, create sparks and heat glow, and flash the full scene | None |
| UFO lightning | From the start of Sequence 5 through Sequence 7, on 50% of encounters | Strike the visible UFO, briefly drop and shake it, then let it recover | None |
| Intergalactic PMT battle | Periodically while the UFO is hovering over PMT | One to three defender ships intercept the original UFO, both sides exchange fire and dialogue, stunned ships recover, and every ship flies away | When `Track Alien Events` is on and the camera is automatic, keep the moving flyby aimed at the PMT logo until the battle finishes; a separate picture-in-picture camera may also show the battle |

The first successful UFO lightning strike after the About scene loads must say: `This PMT really has a lot of spark!` Later successful UFO strikes select a random line from the UFO lightning-reaction pool.

Once a UFO encounter has visibly started, it must finish its beam retract and departure/fly-away animation before the ship is hidden, even if the Sequences 5–7 logo-approach window ends while the UFO is still speaking or scanning. If the UFO is struck by lightning, it must remain visible through its recovery long enough to continue and complete the normal exit sequence. The scene may stop new UFO encounters after that event window ends, but it must drain the active encounter instead of disabling it immediately.

The UFO and lightning schedules are coordinated by the scene, not by the camera controller. The automatic event window begins with Sequence 5 so the UFO battle develops during Sequence 6 near PMT. It triggers the PMT strike about `5.2` seconds after Sequence 5 begins and attempts the optional UFO strike about `16` seconds after Sequence 5 begins, immediately before the `M`/`T` passage at the default `2x` speed. The UFO strike is planned independently for each encounter with probability `0.5`.

## Intergalactic battle event

- Automatic multi-UFO interceptions are enabled by default. Each new scheduled UFO encounter independently uses a `0.68` interception probability.
- Pressing `1` remains the explicit original-UFO-only action and suppresses automatic interception for that manually started encounter.
- Pressing `M` starts a fresh UFO encounter and guarantees the intergalactic battle for that encounter, while still randomly selecting between one and three defender ships.
- Pressing `1` starts only the original UFO encounter. Pressing `2`, `3`, or `4` starts the original UFO plus exactly one, two, or three attacking UFOs respectively. These deterministic battle keys use the same complete entry, combat, recovery, dialogue, and departure sequence as a normal battle.
- Select between one and three interceptor ships. They enter along distinct curves, surround the original UFO, exchange visible laser fire, and then leave along complete departure curves.
- Build every interceptor from the same saucer geometry and glass/metal material structure as the original UFO. Distinguish defenders with magenta, cyan, and gold color palettes rather than unrelated fighter silhouettes.
- The original UFO must return fire. Laser impacts keep the existing ship wobble, brief drop, and recovery motions but do not draw electric line or lightning-line overlays around a hit ship.
- Battle dialogue alternates between the original UFO and PMT defenders. Keep lines short, funny, and PMT-related. Render each line with the same translucent dark pill treatment as the bottom flight-destination panel; only the outline color changes to identify the speaker. Do not add a speech tail, speaker label, or other pointer.
- Battle dialogue is a screen-anchored conversation stack, independent of both the main camera and the picture-in-picture camera. Show the first line as soon as battle starts, append every later line without removing earlier lines, keep the full transcript visible until every ship completes the battle exit, then let it linger for seven more seconds before dismissing it. The conversation remains readable even when no battle ship is in either camera view.
- The battle never changes flyby speed, FOV, sequence phase, position, or destination. When `Track Alien Events` is on in automatic mode, it temporarily overrides only the camera heading so the moving flyby slowly pans toward the PMT logo; normal flyby heading resumes smoothly after the battle.
- Isolate the battle update from the main animation loop. If a future battle-only runtime error occurs, abort and hide the battle event while allowing the approved flyby and the rest of the 3D scene to continue.
- If the original UFO is outside the comfortable center area of the main camera, show a lower-right `16:9` PMT Defense Feed. Its separate camera remains centered on the PMT logo and must never track an individual UFO or redirect the main camera. Randomize its starting azimuth, height, distance, and slow orbit direction for each battle so the PMT logo is shown from a more cinematic, changing perspective.
- The PMT Defense Feed camera renders a dedicated battle-only layer. Do not render the chart gallery, stars, floor, or other unrelated heavy scene content a second time inside the feed.
- Include the PMT logo in the battle-only feed as a fixed spatial reference so viewers can see where the battle is taking place.
- The WebGL feed is a rectangular scissor viewport on the main scene canvas, so its green frame must also remain rectangular. Do not combine a rounded frame with the square black render area.
- Do not apply scanlines, CRT treatments, color washes, or other visual effects over the picture-in-picture render.
- The picture-in-picture feed disappears when the main camera frames the battle comfortably, when no UFO remains inside the fixed PMT-centered feed viewport, or when the battle ends. Do not newly open or reopen the feed during the final five seconds of a battle.
- Pressing `P` toggles the battle picture-in-picture feature on or off without changing the main camera or battle animation.
- The battle PIP is OFF by default. Persist the user's PIP choice under `pmt-about-battle-pip-enabled` and restore it the next time the About scene loads.
- Pressing `T` toggles `Track Alien Events`. It is ON by default and changes only the automatic camera heading while an alien event is active; it never changes the approved camera path.
- Persist the user's `Track Alien Events` choice under `pmt-about-track-alien-events-enabled` and restore it the next time the About scene loads.
- Pressing `0` toggles all automatic and manual alien-related events on or off. When turned off, prevent new UFO encounters and battles while allowing an already-visible encounter or battle to complete its proper departure rather than disappearing abruptly. Lightning against PMT and comets remain available.
- Persist the user's alien-events choice under `pmt-about-alien-events-enabled` and restore it the next time the About scene loads. Do not persist transient encounter, battle, dialogue, sequence, pause, or control-hint state.
- While a battle is active, that battle owns the original UFO encounter. The Sequences 5–7 automatic event window and the `A`/`U` hotkeys must not restart or replace it; any overlapping request is deferred or ignored so all defender ships can complete their entry, combat, and departure.
- Once a battle starts, allow it to finish even if the Sequences 5–7 logo-approach window ends. Interceptor ships may become hidden only after reaching their distant departure endpoints; never remove them abruptly near PMT.

## Camera and event invariants

- Default autopilot speed is `2x`; the normal `+` and `-` controls remain available.
- Automatic motion must remain calm, controlled, and cinematic. Do not introduce sudden camera movement, sudden turns, sudden speed changes, forced one-frame position/heading/FOV changes, or hidden per-sequence speed multipliers.
- The camera follows continuous arc-length-sampled curves at the user's selected speed. It may redirect only through gradual spline curvature and smoothly blended attention/FOV.
- Manual camera takeover and idle rejoin remain supported.
- When `Track Alien Events` is on, UFO and battle events may temporarily change only automatic camera heading to aim at the PMT logo. They never change camera position, FOV, speed, path, sequence phase, or destination, and they never override manual control.
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
- The user-selected flyby speed is constant across Sequences 1 through 7. Routes, chart approaches, transitions, and background events must not apply hidden acceleration or slowdown multipliers; only `+` and `-` may change it.
- `Space` pauses or resumes the shared flight-and-event animation clock.
- `Enter` resets the active 3D flyby back to Sequence 1 inside the existing 3D scene. It must not exit the 3D scene, rebuild the About page, or replay the initial 2D-logo intro.
- `Enter` also clears the visible UFO speech, battle transcript, battle PIP, pending manual alien strike, and active battle presentation. Cleared alien conversations must not repopulate on the next frame. This reset does not change the user's saved alien-events or PIP preferences.
- Control hints appear for five seconds when full manual mode begins. Do not reveal them automatically after the Sequences 4–7 gallery-return window. Keep a small `?` panel in the lower-left of the 3D scene. Clicking it or pressing the `?`/slash key in manual or automatic mode toggles the hints without changing the current flight mode: open them for five seconds when hidden, or close them immediately when visible. Shift must not be required.
- Whenever visible, the control hints use a compact vertical list anchored to the upper-left of the 3D scene. Keep one control per line so the hints are readable, but keep the panel small enough that it is noticeable without becoming the main focus.
- The control-hints title is exactly `Controls` and is horizontally centered within the panel.
- Size the control-hints panel from its content. Do not apply a fixed/max panel height or internal vertical scrolling; the complete compact list must render without a scrollbar.
- The 3D scene canvas may receive browser focus so keyboard controls keep working, but it must not show a focus outline, border, or halo when clicked.
- `A` triggers the alien encounter and guarantees that this manually triggered encounter is struck by lightning during its inspection phase. `L` triggers lightning, `C` triggers a comet, `U` triggers the UFO encounter without the guaranteed strike, `M` triggers a guaranteed battle with a random attacker count, `1` triggers only the original UFO, `2`/`3`/`4` trigger exactly one/two/three attackers, and `R` randomly selects an alien, lightning, or comet event.
- `T` toggles `Track Alien Events` on or off without entering manual mode.
- `A` never enters manual mode or interrupts automatic flight. It triggers one alien encounter with its guaranteed lightning strike while the approved camera path keeps moving and, when tracking is on, the automatic heading follows the shared PMT-logo focus rule. If the camera is already in manual mode, `A` may still strafe left while triggering the encounter. Key-repeat does not repeatedly trigger the event.
- Manual event hotkeys change event state only. If an alien is triggered while the flyby remains automatic and tracking is on, the shared alien camera rule temporarily aims the moving camera at the PMT logo; no hotkey changes speed, FOV, flight-path position, sequence phase, or manual camera heading.

## 3D chart-panel theme

- Dev Task charts, Bug Tracking charts, and gallery user cards always use PMT's dark chart palette and dark glass material because the gallery is set in space.
- The 3D gallery does not observe or redraw from the application's light/dark theme selection. Changing the application theme must not change these panels.
- Keep a large, luminous section label above each gallery wall: `Development Tasks` above the Dev charts, `Bug Tracking` above the Bug Tracking / QA charts, `Development Team` above the user-card grid, `Documentation` above the Documentation card wall, and `Kanban Board` above the Kanban columns. Each label follows its wall orientation and remains readable from the flyby route.

## Documentation gallery wall

- Use the privacy-filtered Documentation records already present in `state.blogs`. Sort by `updatedAt`, fall back to `createdAt`, and render only the newest 20 records.
- Render the Documentation cards as a dynamic grid on the front side of the gallery, opposite the Dev charts. The wall faces inward toward the PMT logo at a `180` degree Y rotation.
- Match the real Documentation card information hierarchy: title, project or General badge, Private/Public state, pinned state, created/edited author and date, body preview, first body image when available, and attachment count.
- Keep Documentation card textures lower-resolution than the large chart panels so a full 20-card wall does not overload the WebGL scene.
- Sequence 4 randomly selects and approaches one rendered Documentation card per gallery cycle. Sequence 7 may pass through the Documentation area only as turnaround space and must not behave like a second Documentation inspection.

## Kanban gallery wall

- Derive Kanban cards from the real board's saved Project, Sprint, status, and user filters, then derive columns from the filtered live task statuses rather than a fixed Todo/Backlog/In Progress list. Preserve configured status order and include any live custom status not present in that list.
- **Permanent 3D Kanban rule:** when the user has selected `Show All Columns` on the normal web Kanban Board, the About-page 3D version must still render only non-empty columns. Empty columns must never consume 3D gallery space in this mode, including when every configured column is empty; use the single `No active columns` gallery placeholder instead. This compact 3D policy intentionally overrides the web board's all-column presentation without changing the saved web preference.
- Render the Kanban Board on the left-side wall after the Development Team grid's dynamic front extent. Its start position must be calculated from the current user-card grid width plus a safety gap so additional users and additional Kanban columns cannot overlap.
- Match the real dark-theme Kanban screen rather than inventing a simplified card: muted dark column, neutral bordered surface cards, live overlapping assignee avatar images, task code, Dev/Bug marker, title, priority and Bug severity pills, centered completion percentage, and PMT's danger/warning/success progress colors.
- Grow Kanban columns toward the front of the gallery. Keep four full-size, visually substantial task cards readable per column; when a stack exceeds that texture capacity, show an explicit remaining-task count instead of compressing the cards into thin rows.
- Sequence 5 leaves the selected Documentation card for Kanban. Sequence 6 leaves Kanban, curves behind the PMT logo, and flies through the `M`/`T` gap. The automatic route no longer detours to inspect the Development Team wall.

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
2. Keep event scheduling out of `about-flight-controller.js`; the scene may use the controller's shared cinematic-focus hook for the approved automatic PMT-logo heading override, but events must not change camera position, FOV, speed, path, sequence phase, or manual control.
3. For a camera change, alter only the named sequence and preserve continuous target position, quaternion, and FOV across its boundaries.
4. For a wide-chart change, keep the logic based on actual chart dimensions and wall orientation rather than a specific chart name.
5. Update this document and the related `data-about-*` browser regression metadata in the same change.
6. Cache-bust the About module chain so a browser refresh loads the new behavior.
7. Ask the user to visually approve camera-path changes before making another camera-path alteration.

The bottom debug panel reports the active action and selected destinations. The `data-about-*` attributes on the About scene expose the approved sequence, traversal, event, and camera-influence state used by the browser regression test.
