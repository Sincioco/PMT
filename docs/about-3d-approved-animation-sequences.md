# About 3D Approved Animation Sequences

This document is the durable reference for the approved About-page camera animation. Future changes should preserve these sequences and their transition rules unless a new requirement explicitly revises them.

## Approved sequence loop

1. **Sequence 1 — Initial view to P-hole flyby**
   - Begin at the same front-facing composition used by the introductory 2D PMT SVG.
   - Fly forward through the opening in the PMT letter P.
   - Keep the motion cinematic, level, and continuous.

2. **Sequence 2 — P-hole exit to a random Dev chart**
   - Select a random Dev Task chart before leaving the P-hole.
   - Fly directly toward it with a gradual arrival slowdown.
   - Do not snap to a forced front-and-center camera pose, stop, bounce, reverse, pause, or hold.
   - Preserve forward momentum when handing off to Sequence 3.

3. **Sequence 3 — Dev chart to a random Bug Tracking / QA chart**
   - Select a random QA chart and turn toward it while continuing forward.
   - Do not use backing or retreat waypoints.
   - Arrive naturally and continue into Sequence 4.

4. **Sequence 4 — QA chart to the initial view**
   - Follow a smooth return curve toward the front of the gallery.
   - Focus on the PMT logo during the return instead of looking into empty space.
   - Finish at the exact initial-view composition and direction, then repeat Sequence 1.

## Wide-chart traversal

- The behavior is dimension-based and reusable for Dev or QA charts.
- A chart wider than the standard viewport threshold is approached at its upper-left area.
- Traverse from the upper-left starting area to the chart's actual far edge at a constant `5` world-units per second.
- The displayed completion percentage measures the real chart span; `100%` is the far edge.
- Do not accelerate, impose a fixed duration, add an exit runway, pause, or hold after traversal.
- Continue immediately to the next approved sequence.

## Camera and event invariants

- Default autopilot speed is `2x`; the normal `+` and `-` controls remain available.
- Automatic motion must stay cinematic and avoid forced one-frame position, heading, or FOV changes.
- Manual camera takeover and idle rejoin remain supported.
- The UFO runs only as a background event during Sequence 4. It must never change camera focus, heading, FOV, speed, or path.
- Lightning remains suspended while this approved flight loop is active.
- Stars and the galaxy are fixed in distant world space and never follow the camera.
- A fixed-world-space comet is triggered when the camera exits the P-hole; additional background comets may appear occasionally.

## Implementation map

- Camera state machine and route geometry: `wwwroot/js/features/about/about-flight-controller.js`
- Scene events, fixed background, and rendering loop: `wwwroot/js/features/about/about-scene.js`
- UFO animation: `wwwroot/js/features/about/about-ufo.js`
- Dev/QA chart geometry and dimensions: `wwwroot/js/features/about/about-workload-billboard.js`
- Browser regression metadata: `tests/browser/about-3d.spec.mjs`

The bottom debug panel reports the active action and selected destinations. The `data-about-*` attributes on the About scene expose the approved sequence, traversal, event, and camera-influence state used by the browser regression test.
