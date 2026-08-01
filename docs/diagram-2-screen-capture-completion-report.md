# Diagram 2 Screen Capture Completion Report

## Repository

- Starting branch: `main`
- Starting SHA: `a64fe951c382ad1a697024958652ce6d988316a8`
- Final branch: `main`
- Final SHA: See the completion response. A commit cannot embed its own SHA without changing that SHA.
- Commit: `Sin and Codex: add Diagram 2 screen capture image insertion`
- Unrelated starting changes: None. The working tree was clean.

## Files Changed

- `wwwroot/js/features/diagram2/diagram2-screen-capture.js`
- `wwwroot/js/features/diagram2/diagram2-editor-phase6-host.js`
- `wwwroot/js/features/diagram2/diagram2-editor-shell.js`
- `wwwroot/js/features/diagram2/diagram2.js`
- `wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js`
- `wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js`
- `wwwroot/js/app.js`
- `wwwroot/index.html`
- `tests/js/diagram2-screen-capture.test.mjs`
- `tests/browser/diagram2-phase6.spec.mjs`
- `tests/browser/diagram2-rte-annotation.spec.mjs`
- `docs/diagram-2-screen-capture-completion-report.md`

No CSS, database, migration, Release Notes, What's New, Diagram format, or Diagram 1 production files changed.

## Toolbar And Hosts

The shared Diagram 2 editor shell now renders a standard PMT action button labeled `Capture` with a camera icon immediately above Crop. Its title and accessible name are `Capture screen, window, or tab`.

The action is `capture-diagram2-screen` and travels through the existing Phase 6 action host. Both the main Diagram 2 editor and RTE Annotate 2.0 already use that host, so there is one implementation. The button is disabled while capture is active, when the browser API is unavailable, and when mutation is not allowed. Read-only Diagram 2 does not render the editing tool pane.

Button state is patched directly. The editor shell is not rebuilt when capture starts or finishes. Playwright verified usable placement at `1366x768` and `1920x1080`.

## Capture Service

`diagram2-screen-capture.js` owns only the temporary browser capture lifecycle. It calls the standard [`getDisplayMedia()` API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) directly from the toolbar action with:

```javascript
{
  video: { resizeMode: "none" },
  audio: false
}
```

After source selection it reads track capabilities/settings and progressively applies supported full-detail constraints:

- `resizeMode: { exact: "none" }`
- capability maximum width as an ideal width
- capability maximum height as an ideal height

Unsupported post-selection constraints are non-fatal. The selected stream still proceeds with the browser-provided dimensions.

The service waits for metadata and non-zero video dimensions, then prefers `requestVideoFrameCallback()`. Its fallback uses two animation frames. Metadata, video-frame, and animation-frame waits are bounded and react to track end or editor destruction.

It draws exactly one delivered frame to a canvas whose backing width and height equal `video.videoWidth` and `video.videoHeight`. It then stops every stream track before PNG encoding or PMT upload work. The canvas is encoded once with [`canvas.toBlob(..., "image/png")`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), and the Blob becomes a timestamped PNG `File`.

No `MediaRecorder`, video codec, video file, `RTCPeerConnection`, network stream, or Blob URL is used. This follows the browser [Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API) and [W3C Screen Capture specification](https://www.w3.org/TR/screen-capture/).

## Fidelity And Diagnostics

The service records non-pixel diagnostics in memory only: delivered width/height, track width/height, capability maximums, `resizeMode`, `displaySurface`, `screenPixelRatio`, applied-constraint status, and reduced-resolution status. They are available through `screenCaptureDiagnostics()` on the existing development Phase 6 host reference. Screenshot pixels and data URLs are never logged.

Injected browser verification observed:

- Delivered frame: `640x360`
- Capability maximum: `640x360`
- `resizeMode`: `none`
- `displaySurface`: `browser`
- `screenPixelRatio`: `1`
- Applied constraints: exact `none`, ideal `640x360`

Focused unit verification also covered `1920x1080`, `displaySurface: monitor`, and `screenPixelRatio: 1.5`.

If the browser reports `crop-and-scale`, or delivered dimensions are materially below track settings/capability maximums, PMT inserts the image but displays this non-fatal notice:

> The browser supplied this capture at a reduced resolution. Small text may be less sharp than a Windows clipboard screenshot.

Actual monitor/window/tab settings require the manual chooser test below. Automated dependencies do not prove Windows picker behavior or native monitor resolution.

## Image Insertion And State

The capture host passes the generated PNG `File` into the existing `addImageFiles()` path. That path retains existing PMT upload validation, persistent source creation, image dimension loading, visible-viewport insertion center, unique naming, canonical `createDiagram2EmbeddedImage()` schema, and `controller.addEmbeddedImage()` command.

No special capture object exists. The saved result is the normal `embedded-image` object with the existing fields, including its normal ID, name, persistent source, geometry, and image clip/crop data.

The canonical object is created only after upload/source creation and image decoding succeed. Before that point, selection, dirty state, and history are unchanged. Upload failure leaves no canonical object or history entry.

After insertion, the command-selected image remains selected and the shared host activates the existing Crop tool. Crop target rendering, hidden selection chrome, Crop tab selection, crop resizing, and later image behavior are unchanged.

## History, Persistence, And Compatibility

- Capture insertion adds exactly one logical history entry.
- Undo removes the image.
- Redo restores the same object and persistent source without another permission prompt.
- Save/reopen and PMT Diagram export/import retain the image through the existing shared contract.
- The shared Diagram 1 parser reopened the resulting `pmt-diagram` image object in automated coverage.
- Diagram 1 production code and behavior were not changed.

## Permissions And Errors

The feature detects missing `mediaDevices`, missing `getDisplayMedia`, and insecure contexts. Unsupported environments keep Capture disabled. Programmatic invocation reports that screen capture requires HTTPS or localhost.

Handled failures include chooser cancellation/denial, invalid activation state, unreadable or missing sources, unsupported API use, stream end before the first frame, zero dimensions, missing canvas context, null PNG Blob, upload/source failure, duplicate active requests, and editor destruction.

Chooser cancellation is neutral: no object, history entry, dirty change, or retained busy state.

## Cleanup

Every exit path stops all returned stream tracks. Successful capture stops sharing immediately after `drawImage()` and before `toBlob()` or upload. Cleanup also removes the track listener, cancels pending frame callbacks where possible, cancels animation frames, pauses and clears the video, removes a temporary video node if present, clears references, and resets button busy state.

The implementation creates no object URLs, hidden persistent video nodes, renderer-only objects, or image-cache entries. Destruction while the chooser is unresolved prevents later insertion and stops tracks immediately if the browser subsequently returns a stream.

After validation, repo-local `obj` and `test-results` plus the temporary `%TEMP%` build output were removed. Five unrelated tracked screenshots refreshed by existing Playwright tests were restored to their starting versions. A pre-existing PMT development process and its `bin` directory were preserved.

## Incremental Rendering

The injected live-browser test measured the production controller and renderer around capture insertion:

- New canonical objects: `1`
- Logical history entries: `1`
- Full-render count delta: `0`
- Relationships routed in the insertion flush: `0`
- Existing unrelated SVG node retained: `true`
- Image decode-count delta: `1` for the newly inserted image
- Unrelated image decode delta: `0`
- Zoom/pan matrix changed: `false`

Only the new image resource is decoded. No unrelated relationship route or keyed object node is rebuilt.

## Automated Validation

Final results:

- `npm.cmd run check:js`: PASS, 195 JavaScript modules syntax-checked.
- `node --test tests/js/diagram2-screen-capture.test.mjs`: PASS, 16 tests, 0 failures.
- `npm.cmd run test:js`: PASS, 476 tests, 0 failures.
- `node --test tests/js/diagram2-compact-parity.test.mjs`: PASS, 29 tests, 0 failures.
- Focused Playwright D2, injected capture, and RTE host run: PASS, 5 passed, 1 intentionally skipped duplicate viewport capture-pipeline case, 0 failures.
- D2 toolbar/layout: PASS at `1366x768` and `1920x1080`.
- RTE Annotate 2.0 toolbar/layout: PASS at `1366x768` and `1920x1080`.
- Injected live capture pipeline: PASS at `1366x768`.
- `dotnet build --no-restore -p:OutputPath=<TEMP>`: could not run initially because the cleaned repository had no `obj/project.assets.json` (`NETSDK1004`).
- Restore-backed `dotnet build -p:OutputPath=<TEMP>`: PASS, 0 errors and 2 existing .NET 6 end-of-support warnings.
- `git diff --check`: PASS.

An extra baseline check, `npm.cmd run check:release-notes`, reports that committed release-note data is out of date and requests `npm run generate:release-notes`. The task began from a clean tree and explicitly prohibits Release Notes/What's New changes, so no unrelated release files were generated or changed.

## Manual Windows 11 Acceptance

Use Ctrl+F5 first, then test in the supported Chrome or Edge build.

### A. Entire monitor

1. Open an editable Diagram 2 and note zoom/pan.
2. Click Capture and choose an entire monitor.
3. Confirm that sharing stops immediately after one frame.
4. Confirm one selected Image appears and Crop is active.
5. Move, resize, crop, Undo, Redo, Save, reload, and reopen.
6. Confirm the image remains and insertion did not reset zoom/pan.

### A2. Small-text quality

1. Open small high-contrast application text.
2. Take a Windows `Alt+Print Screen` clipboard capture for comparison only.
3. Capture the same window through PMT.
4. Compare PNG dimensions and both images at 100 percent zoom.
5. Confirm there are no codec artifacts.
6. Inspect `window.__pmtDiagram2Phase6Host.screenCaptureDiagnostics()` for width, height, `resizeMode`, capability maximums, surface, and pixel ratio.
7. If the browser reports reduced dimensions or `crop-and-scale`, confirm the PMT quality notice appears.
8. Repeat at supported Windows display scaling values. Do not commit either screenshot.

### B. Application window

1. Click Capture and choose a visible application window.
2. Confirm only that window appears in the selected image.
3. Confirm Crop is active, then Save and reopen.

### C. Browser tab

1. Click Capture and choose a browser tab.
2. Confirm the tab becomes a selected Image and Crop is active.
3. Save and reopen.

### D. Cancel

1. Record object count, Undo availability, and dirty state.
2. Click Capture and cancel the chooser.
3. Confirm all three values are unchanged and Capture is enabled again.

### E. Read-only

1. Open the same Diagram in read-only mode.
2. Confirm Capture is unavailable with the rest of the editing tools.
3. Confirm no chooser can be opened.

### F. Repeated cleanup

1. Perform ten captures, alternating screen, window, and tab.
2. Undo or delete several captures.
3. Confirm no sharing indicator or capture request remains.
4. Confirm diagnostics/resource counts stabilize and canvas interaction remains responsive.

## Refresh And Limitations

No .NET source, CSS, image asset, or database change is included. Import query versions were bumped through `app.js`, so **Ctrl+F5 is sufficient**; no .NET rebuild is required to test this feature. The cache-busted module graph prevents stale JavaScript from being reused.

Known platform limitations:

- The browser always controls source selection and requests permission for each new capture.
- Actual delivered resolution is browser and source dependent.
- A large lossless PNG can exceed PMT's existing image upload limit; failure remains atomic.
- Native Windows chooser, real monitor/window/tab dimensions, high-DPI quality, and ten-cycle sharing-indicator cleanup require the manual steps above.
