import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../../wwwroot/js/vendor/three/three.module.min.js";
import { createSequence4Geometry } from "../../wwwroot/js/features/about/about-flight-controller.js";

test("Sequence 6 stays inside the physical M/T opening", () => {
  const geometry = createSequence4Geometry({
    startPosition: new THREE.Vector3(26, 4, -18),
    initialPosition: new THREE.Vector3(0, 1.5, 21),
    logoTarget: new THREE.Vector3(0, -1.6, 0),
    documentationTarget: new THREE.Vector3(0, 3.15, 40),
    documentationWidth: 5.8,
    documentationHeight: 3.25,
    kanbanTarget: new THREE.Vector3(-36, 2.75, 12),
    kanbanWidth: 24,
    kanbanHeight: 13.8,
    mtGapTarget: new THREE.Vector3(3.829295, -1.607555, 0),
    minimumCameraY: -3.05,
    startFov: 52
  });

  const mRightEdge = 3.714866;
  const tLeftEdge = 3.943724;
  const logoHalfDepth = 0.269439;
  const crossing = geometry.curve.getSpacedPoints(20000).filter(point => (
    Math.abs(point.z) <= logoHalfDepth
      && point.x > 3
      && point.x < 5
  ));

  assert.ok(crossing.length > 0, "Expected sampled camera points inside the logo depth.");
  assert.ok(crossing.every(point => point.x > mRightEdge && point.x < tLeftEdge));
});
