import {
  adjustAnnotationEntityRelationshipRoute,
  annotationEntityRelationshipRenderModel
} from "../../components/image-annotation.js?v=20260729-diagram2-d1-relationships-v1";

const defaultDiagram2RouteBoundsPadding = 9;

export function createDiagram2RelationshipRouteModel(stateInput = {}, options = {}) {
  const state = stateInput && typeof stateInput === "object" ? stateInput : {};
  const model = annotationEntityRelationshipRenderModel(
    Array.isArray(state.objects) ? state.objects : [],
    state.relationshipStyle || null,
    {
      allowOverlappingLines: options.allowOverlappingLines ?? state.allowOverlappingEntityLines === true,
      manualRoutes: options.manualRoutes ?? state.manualEntityRelationshipRoutes === true,
      compactRouting: options.compactRouting ?? state.compactEntityRelationshipRouting === true
    }
  );
  const geometryByKey = new Map();
  (model.renderedRelationships || []).forEach(item => {
    if (!item?.relationship || !item.geometry) return;
    geometryByKey.set(diagram2RelationshipRouteKey(item.relationship), item.geometry);
  });
  return {
    model,
    geometryByKey
  };
}

export function diagram2RelationshipRouteFromModel(relationship, routeModelInput = null) {
  const routeModel = routeModelInput && typeof routeModelInput === "object" ? routeModelInput : null;
  const geometry = routeModel?.geometryByKey?.get?.(diagram2RelationshipRouteKey(relationship));
  return geometry ? normalizeDiagram2RelationshipGeometry(geometry) : null;
}

export function diagram2RelationshipRouteKey(relationship) {
  return [
    relationship?.source?.id,
    relationship?.sourceField?.name,
    relationship?.target?.id,
    relationship?.targetField?.name,
    relationship?.foreignKey?.name,
    ...(Array.isArray(relationship?.foreignKey?.columns) ? relationship.foreignKey.columns : []),
    ...(Array.isArray(relationship?.foreignKey?.referencedColumns) ? relationship.foreignKey.referencedColumns : [])
  ].map(value => String(value || "").trim().toLowerCase()).join("\u001f");
}

export function normalizeDiagram2RelationshipGeometry(geometryInput = {}) {
  const points = compactDiagram2RelationshipPoints(geometryInput.points);
  if (points.length < 2) return null;
  const start = normalizeDiagram2Point(geometryInput.start) || points[0];
  const end = normalizeDiagram2Point(geometryInput.end) || points.at(-1);
  return {
    start,
    end,
    sourceUnit: normalizeDiagram2Point(geometryInput.sourceUnit) || diagram2EndpointUnit(points[0], points[1]),
    targetUnit: normalizeDiagram2Point(geometryInput.targetUnit) || diagram2EndpointUnit(points.at(-1), points.at(-2), true),
    points,
    path: String(geometryInput.path || diagram2RelationshipPath(points)),
    bounds: diagram2RelationshipBounds(points, defaultDiagram2RouteBoundsPadding),
    relationshipType: normalizeDiagram2RelationshipType(geometryInput.relationshipType)
  };
}

export function compactDiagram2RelationshipPoints(pointsInput = []) {
  const points = [];
  (Array.isArray(pointsInput) ? pointsInput : []).forEach(point => {
    const normalized = normalizeDiagram2Point(point);
    if (!normalized) return;
    const previous = points.at(-1);
    if (previous && previous.x === normalized.x && previous.y === normalized.y) return;
    points.push(normalized);
    while (points.length >= 3) {
      const first = points.at(-3);
      const middle = points.at(-2);
      const last = points.at(-1);
      if ((first.x === middle.x && middle.x === last.x)
        || (first.y === middle.y && middle.y === last.y)) {
        points.splice(points.length - 2, 1);
      } else {
        break;
      }
    }
  });
  return points;
}

export function diagram2RelationshipPath(pointsInput = []) {
  const points = compactDiagram2RelationshipPoints(pointsInput);
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    if (previous.y === point.y) return `${path} H ${formatDiagram2Number(point.x)}`;
    if (previous.x === point.x) return `${path} V ${formatDiagram2Number(point.y)}`;
    return `${path} L ${formatDiagram2Number(point.x)} ${formatDiagram2Number(point.y)}`;
  }, `M ${formatDiagram2Number(points[0].x)} ${formatDiagram2Number(points[0].y)}`);
}

export function diagram2RelationshipBounds(pointsInput = [], paddingInput = defaultDiagram2RouteBoundsPadding) {
  const points = compactDiagram2RelationshipPoints(pointsInput);
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const padding = Math.max(0, finiteDiagram2Number(paddingInput, defaultDiagram2RouteBoundsPadding));
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs) - padding;
  const top = Math.min(...ys) - padding;
  const right = Math.max(...xs) + padding;
  const bottom = Math.max(...ys) + padding;
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

export function normalizeDiagram2RelationshipType(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["one-to-one", "one-to-many", "many-to-one"].includes(text) ? text : "";
}

export function adjustDiagram2RelationshipRoutePoints(pointsInput, segmentIndex, axis, coordinate) {
  return compactDiagram2RelationshipPoints(
    adjustAnnotationEntityRelationshipRoute(pointsInput, segmentIndex, axis, coordinate)
  );
}

function normalizeDiagram2Point(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Number(formatDiagram2Number(x)),
    y: Number(formatDiagram2Number(y))
  };
}

function diagram2EndpointUnit(first, second, reverse = false) {
  const dx = finiteDiagram2Number(first?.x, 0) - finiteDiagram2Number(second?.x, 0);
  const dy = finiteDiagram2Number(first?.y, 0) - finiteDiagram2Number(second?.y, 0);
  if (Math.abs(dx) >= Math.abs(dy)) return { x: (dx >= 0 ? 1 : -1) * (reverse ? -1 : 1), y: 0 };
  return { x: 0, y: (dy >= 0 ? 1 : -1) * (reverse ? -1 : 1) };
}

function finiteDiagram2Number(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDiagram2Number(value) {
  return Number(finiteDiagram2Number(value, 0).toFixed(3)).toString();
}
