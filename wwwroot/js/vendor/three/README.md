# Three.js

Pinned browser modules from `three@0.185.1` are vendored here so PMT does not
need npm or another installation step on the server.

Included runtime files:

- `three.core.min.js`
- `three.module.min.js`
- `addons/controls/PointerLockControls.js`
- `addons/environments/RoomEnvironment.js`
- `addons/loaders/SVGLoader.js`

Three.js is distributed under the MIT license in `LICENSE.txt`. The addon
imports point at the local module so the About experience makes no CDN or
other third-party network requests at runtime.

PMT's local `PointerLockControls.js` also replaces the upstream console error
on pointer-lock denial with an `error` event. Pointer dragging remains the
quiet fallback when a browser refuses pointer lock.
