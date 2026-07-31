import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260731-checkbox-d2-view-options-v4";
import {
  createDiagram2RelationshipRouteModel,
  diagram2RelationshipRouteFromModel,
  diagram2RelationshipPath
} from "./diagram2-routing.js?v=20260731-rte-checkbox-layout-v2";

export const diagram2CompactPhases = Object.freeze([
  "Analyzing Entities",
  "Building Relationship Graph",
  "Assigning Compact Levels",
  "Placing Root-side Entities",
  "Separating Entities from Relationship Routes",
  "Finalizing Automatic Routes",
  "Applying D1 Compact Result"
]);

export function scoreDiagram2RoutePoints(pointsInput = [], obstaclesInput = [], options = {}) {
  const points = normalizeRoutePoints(pointsInput);
  const canonicalPathKey = diagram2RelationshipPath(points);
  if (points.length < 2) {
    return {
      resolved: false,
      clearanceContacts: 0,
      obstacleContacts: 0,
      routeFootprintScore: 0,
      endpointLaneScore: 0,
      bendCount: 0,
      shortJogCount: 0,
      corridorCongestionScore: 0,
      sharedLaneScore: 0,
      visualNoiseScore: 1000000,
      totalManhattanLength: 0,
      canonicalPathKey
    };
  }

  const obstacleIdsToSkip = new Set((options.skipObstacleIds || []).map(String));
  const obstacles = (Array.isArray(obstaclesInput) ? obstaclesInput : [])
    .filter(obstacle => obstacle && !obstacleIdsToSkip.has(String(obstacle.id || "")))
    .map(obstacle => ({
      id: String(obstacle.id || ""),
      x: finiteNumber(obstacle.x, 0),
      y: finiteNumber(obstacle.y, 0),
      width: Math.max(1, finiteNumber(obstacle.width, 1)),
      height: Math.max(1, finiteNumber(obstacle.height, 1))
    }));
  const segments = routeSegments(points);
  const totalManhattanLength = segments.reduce((total, segment) => total + segment.length, 0);
  const bendCount = Math.max(0, segments.slice(1).filter((segment, index) => segment.axis !== segments[index].axis).length);
  const shortJogCount = segments.filter(segment => segment.length > 0 && segment.length < 18).length;
  const bounds = routeBounds(points);
  const routeFootprintScore = Math.round((bounds.width * bounds.height) / 1000);
  const obstacleContacts = segments.reduce((count, segment) =>
    count + obstacles.filter(obstacle => segmentIntersectsRect(segment, obstacle)).length, 0);
  const endpointLaneScore = endpointBacktrackScore(points);
  const corridorCongestionScore = sameAxisOverlapScore(segments);
  const sharedLaneScore = Number(options.sharedLaneScore || 0);
  const visualNoiseScore = Math.round(
    (obstacleContacts * 1000)
    + (bendCount * 18)
    + (shortJogCount * 28)
    + (routeFootprintScore * 0.12)
    + endpointLaneScore
    + corridorCongestionScore
    + sharedLaneScore
  );

  return {
    resolved: obstacleContacts === 0,
    clearanceContacts: obstacleContacts,
    obstacleContacts,
    routeFootprintScore,
    endpointLaneScore,
    bendCount,
    shortJogCount,
    corridorCongestionScore,
    sharedLaneScore,
    visualNoiseScore,
    totalManhattanLength,
    canonicalPathKey
  };
}

export function scoreDiagram2RelationshipRoutes(stateInput = {}, options = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const relationships = diagram2CanonicalRelationships(state);
  const entities = state.objects.filter(object => object?.type === "entity" && object.entityKind !== "field-rectangle");
  const routeModel = createDiagram2RelationshipRouteModel(state, {
    manualRoutes: true,
    compactRouting: options.compactRouting ?? state.compactEntityRelationshipRouting === true,
    allowOverlappingLines: options.allowOverlappingLines ?? state.allowOverlappingEntityLines === true
  });
  const scores = relationships.map(relationship => {
    const route = diagram2RelationshipRouteFromModel(relationship, routeModel);
    return {
      relationshipId: relationship.id,
      manualRoute: Array.isArray(relationship.foreignKeySource?.routeOverride) && relationship.foreignKeySource.routeOverride.length > 1,
      ...scoreDiagram2RoutePoints(route?.points || [], entities, {
        skipObstacleIds: [relationship.source?.id, relationship.target?.id]
      })
    };
  });
  const aggregate = scores.reduce((total, score) => ({
    unresolvedRoutes: total.unresolvedRoutes + (score.resolved ? 0 : 1),
    clearanceContacts: total.clearanceContacts + score.clearanceContacts,
    obstacleContacts: total.obstacleContacts + score.obstacleContacts,
    routeFootprintScore: total.routeFootprintScore + score.routeFootprintScore,
    endpointLaneScore: total.endpointLaneScore + score.endpointLaneScore,
    bendCount: total.bendCount + score.bendCount,
    shortJogCount: total.shortJogCount + score.shortJogCount,
    corridorCongestionScore: total.corridorCongestionScore + score.corridorCongestionScore,
    sharedLaneScore: total.sharedLaneScore + score.sharedLaneScore,
    visualNoiseScore: total.visualNoiseScore + score.visualNoiseScore,
    totalManhattanRouteLength: total.totalManhattanRouteLength + score.totalManhattanLength
  }), emptyRouteAggregate());
  return {
    ...aggregate,
    entityCount: entities.length,
    relationshipCount: relationships.length,
    manualRouteCount: scores.filter(score => score.manualRoute).length,
    canonicalRouteKey: scores
      .map(score => `${score.relationshipId}:${score.canonicalPathKey}`)
      .sort()
      .join("|"),
    routeScores: scores
  };
}

export function compareDiagram2RouteScores(leftInput = {}, rightInput = {}) {
  const left = normalizeAggregateScore(leftInput);
  const right = normalizeAggregateScore(rightInput);
  const fields = [
    "unresolvedRoutes",
    "clearanceContacts",
    "obstacleContacts",
    "visualNoiseScore",
    "totalManhattanRouteLength",
    "canonicalRouteKey"
  ];
  for (const field of fields) {
    if (field === "canonicalRouteKey") {
      return String(left[field] || "").localeCompare(String(right[field] || ""));
    }
    const delta = Number(left[field] || 0) - Number(right[field] || 0);
    if (delta) return delta < 0 ? -1 : 1;
  }
  return 0;
}

export function diagram2CompactScoreImproved(beforeScore, afterScore) {
  return compareDiagram2RouteScores(afterScore, beforeScore) < 0;
}

export function createDiagram2CompactDiagnostics(beforeStateInput, afterStateInput, meta = {}) {
  const beforeState = normalizeDiagram2CanonicalState(beforeStateInput);
  const afterState = normalizeDiagram2CanonicalState(afterStateInput || beforeStateInput);
  const scoreRoutes = meta.scoreRoutes !== false;
  const beforeScore = meta.beforeScore && typeof meta.beforeScore === "object"
    ? meta.beforeScore
    : scoreRoutes
      ? scoreDiagram2RelationshipRoutes(beforeState)
      : diagram2RouteCountSummary(beforeState);
  const afterScore = meta.afterScore && typeof meta.afterScore === "object"
    ? meta.afterScore
    : scoreRoutes
      ? scoreDiagram2RelationshipRoutes(afterState, { compactRouting: true })
      : diagram2RouteCountSummary(afterState);
  const beforeEntities = beforeState.objects.filter(object => object?.type === "entity");
  const afterById = new Map(afterState.objects.map(object => [object.id, object]));
  const entitiesMoved = beforeEntities.filter(entity => {
    const after = afterById.get(entity.id);
    return after && (after.x !== entity.x || after.y !== entity.y);
  }).length;
  const lockedEntityCount = beforeEntities.filter(entity => entity.locked === true).length;
  return {
    entityCount: beforeScore.entityCount,
    relationshipCount: beforeScore.relationshipCount,
    lockedEntityCount,
    manualRouteCount: beforeScore.manualRouteCount,
    entitiesMoved,
    automaticRelationshipsRerouted: Math.max(0, beforeScore.relationshipCount - beforeScore.manualRouteCount),
    layoutsGenerated: Number(meta.layoutsGenerated || 0),
    layoutsEvaluated: Number(meta.layoutsEvaluated || 0),
    routeCandidatesGenerated: Number(meta.routeCandidatesGenerated ?? (scoreRoutes
      ? beforeScore.relationshipCount + afterScore.relationshipCount
      : 0)),
    routeCandidatesEvaluated: Number(meta.routeCandidatesEvaluated ?? (scoreRoutes
      ? beforeScore.relationshipCount + afterScore.relationshipCount
      : 0)),
    before: beforeScore,
    after: afterScore,
    levelCount: Number(meta.levelCount || 0),
    cycleBreakCount: Number(meta.cycleBreakCount || 0),
    anchorCount: Number(meta.anchorCount || 0),
    anchoredRelationshipCount: Number(meta.anchoredRelationshipCount || 0),
    routeAdjustedCount: Number(meta.routeAdjustedCount || 0),
    unresolvedRouteContactCount: Number(meta.unresolvedRouteContactCount || 0),
    fixedConstraintShortcutCount: Number(meta.fixedConstraintShortcutCount || 0),
    entityPositionMismatchCount: Number(meta.entityPositionMismatchCount || 0),
    automaticRoutePointMismatchCount: Number(meta.automaticRoutePointMismatchCount || 0),
    manualRouteMutationCount: Number(meta.manualRouteMutationCount || 0),
    unresolvedRoutes: Number(meta.unresolvedRoutes ?? afterScore.unresolvedRoutes),
    clearanceContacts: afterScore.clearanceContacts,
    obstacleContacts: afterScore.obstacleContacts,
    routeCrossings: Number(meta.routeCrossings || 0),
    routeFootprintScore: afterScore.routeFootprintScore,
    endpointLaneScore: afterScore.endpointLaneScore,
    bendCount: afterScore.bendCount,
    shortJogCount: afterScore.shortJogCount,
    corridorCongestionScore: afterScore.corridorCongestionScore,
    sharedLaneScore: afterScore.sharedLaneScore,
    totalVisualNoiseScore: afterScore.visualNoiseScore,
    totalManhattanRouteLength: afterScore.totalManhattanRouteLength,
    totalElapsedMs: Number(meta.totalElapsedMs || 0),
    workerTimeMs: Number(meta.workerTimeMs || 0),
    finalApplyMs: Number(meta.finalApplyMs || 0),
    dirtyFlushCount: Number(meta.dirtyFlushCount || 0),
    fullRenderCount: Number(meta.fullRenderCount || 0),
    scoringMode: String(meta.scoringMode || "exact"),
    finalStatus: String(meta.finalStatus || "Completed")
  };
}

function diagram2RouteCountSummary(stateInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const relationships = diagram2CanonicalRelationships(state);
  const entities = state.objects.filter(object => object?.type === "entity");
  return {
    ...emptyRouteAggregate(),
    entityCount: entities.length,
    relationshipCount: relationships.length,
    manualRouteCount: relationships.filter(relationship =>
      Array.isArray(relationship.foreignKeySource?.routeOverride)
      && relationship.foreignKeySource.routeOverride.length > 1).length,
    canonicalRouteKey: "",
    routeScores: []
  };
}

function emptyRouteAggregate() {
  return {
    unresolvedRoutes: 0,
    clearanceContacts: 0,
    obstacleContacts: 0,
    routeFootprintScore: 0,
    endpointLaneScore: 0,
    bendCount: 0,
    shortJogCount: 0,
    corridorCongestionScore: 0,
    sharedLaneScore: 0,
    visualNoiseScore: 0,
    totalManhattanRouteLength: 0
  };
}

function normalizeAggregateScore(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    ...emptyRouteAggregate(),
    ...source,
    unresolvedRoutes: Object.hasOwn(source, "resolved")
      ? (source.resolved ? 0 : 1)
      : Number(source.unresolvedRoutes || 0),
    totalManhattanRouteLength: Object.hasOwn(source, "totalManhattanLength")
      ? Number(source.totalManhattanLength || 0)
      : Number(source.totalManhattanRouteLength || 0)
  };
}

function normalizeRoutePoints(pointsInput = []) {
  return (Array.isArray(pointsInput) ? pointsInput : [])
    .map(point => ({
      x: Number(finiteNumber(point?.x, 0).toFixed(3)),
      y: Number(finiteNumber(point?.y, 0).toFixed(3))
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function routeSegments(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const axis = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "x" : "y";
    segments.push({
      start,
      end,
      axis,
      length: Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
    });
  }
  return segments;
}

function routeBounds(points) {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function segmentIntersectsRect(segment, rect) {
  const minX = Math.min(segment.start.x, segment.end.x);
  const maxX = Math.max(segment.start.x, segment.end.x);
  const minY = Math.min(segment.start.y, segment.end.y);
  const maxY = Math.max(segment.start.y, segment.end.y);
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;
  if (maxX < rect.x || minX > rectRight || maxY < rect.y || minY > rectBottom) return false;
  if (segment.axis === "x") return segment.start.y > rect.y && segment.start.y < rectBottom;
  if (segment.axis === "y") return segment.start.x > rect.x && segment.start.x < rectRight;
  return true;
}

function endpointBacktrackScore(points) {
  if (points.length < 3) return 0;
  const first = points[0];
  const second = points[1];
  const third = points[2];
  const beforeLast = points.at(-2);
  const last = points.at(-1);
  const beforeBeforeLast = points.at(-3);
  let score = 0;
  if (third && directionSign(first, second, "x") !== 0 && directionSign(second, third, "x") === -directionSign(first, second, "x")) score += 24;
  if (third && directionSign(first, second, "y") !== 0 && directionSign(second, third, "y") === -directionSign(first, second, "y")) score += 24;
  if (beforeBeforeLast && directionSign(beforeBeforeLast, beforeLast, "x") !== 0 && directionSign(beforeLast, last, "x") === -directionSign(beforeBeforeLast, beforeLast, "x")) score += 24;
  if (beforeBeforeLast && directionSign(beforeBeforeLast, beforeLast, "y") !== 0 && directionSign(beforeLast, last, "y") === -directionSign(beforeBeforeLast, beforeLast, "y")) score += 24;
  return score;
}

function sameAxisOverlapScore(segments) {
  let score = 0;
  for (let index = 0; index < segments.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < segments.length; nextIndex += 1) {
      const first = segments[index];
      const second = segments[nextIndex];
      if (first.axis !== second.axis) continue;
      if (first.axis === "x" && first.start.y === second.start.y && rangesOverlap(first.start.x, first.end.x, second.start.x, second.end.x)) score += 12;
      if (first.axis === "y" && first.start.x === second.start.x && rangesOverlap(first.start.y, first.end.y, second.start.y, second.end.y)) score += 12;
    }
  }
  return score;
}

function directionSign(start, end, axis) {
  const delta = finiteNumber(end?.[axis], 0) - finiteNumber(start?.[axis], 0);
  return delta === 0 ? 0 : delta > 0 ? 1 : -1;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const firstMin = Math.min(firstStart, firstEnd);
  const firstMax = Math.max(firstStart, firstEnd);
  const secondMin = Math.min(secondStart, secondEnd);
  const secondMax = Math.max(secondStart, secondEnd);
  return Math.max(firstMin, secondMin) < Math.min(firstMax, secondMax);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
