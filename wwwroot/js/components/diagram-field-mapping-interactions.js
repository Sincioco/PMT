import {
  annotationEntityFieldLabelPoint,
  annotationEntityFieldSupportsMapping,
  annotationEntityVisibleFields,
  annotationFieldMappingAttentionHighlightSvg,
  buildAnnotationSvg,
  parseAnnotationSvg
} from "./image-annotation.js?v=20260728-phase3-closeout-v1";

export function buildInteractiveDiagramViewerSvg(svgMarkup) {
  const diagramState = parseAnnotationSvg(svgMarkup);
  if (!diagramState) return "";
  return buildAnnotationSvg(diagramState, {
    entityHeaderButtonsVisible: false,
    interactiveFieldMapping: true
  });
}

export function bindDiagramFieldMappingInteractions(svg, svgMarkup) {
  if (!svg || svg.dataset.diagramFieldMappingBound === "true") return;
  const diagramState = parseAnnotationSvg(svgMarkup);
  svg.dataset.diagramFieldMappingBound = diagramState?.objects?.length ? "true" : "missing-state";
  if (!diagramState?.objects?.length) return;

  const cellSelector = "[data-annotation-field-mapping-cell]";
  let hoveredCell = null;
  let pinnedCell = null;

  const clearRenderedAttention = () => {
    svg.querySelectorAll(
      "[data-annotation-field-mapping-attention-highlight], [data-annotation-field-mapping-attention-arrow]"
    ).forEach(element => element.remove());
    svg.querySelectorAll("[data-annotation-field-mapping-row].is-pinned")
      .forEach(element => element.classList.remove("is-pinned"));
  };

  const renderAttention = cell => {
    clearRenderedAttention();
    if (!cell) return;
    const row = cell.closest("[data-annotation-field-mapping-row]");
    row?.classList.add("is-pinned");
    const targets = fieldMappingTargets(diagramState, cell);
    const highlight = annotationFieldMappingAttentionHighlightSvg(diagramState, targets.ids, 1);
    if (highlight) svg.insertAdjacentHTML("beforeend", highlight);
    const arrows = fieldMappingAttentionArrows(svg, cell, targets);
    if (arrows) svg.insertAdjacentHTML("beforeend", arrows);
  };

  svg.addEventListener("pointermove", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell === hoveredCell) return;
    hoveredCell = cell && svg.contains(cell) ? cell : null;
    renderAttention(hoveredCell || pinnedCell);
  });
  svg.addEventListener("pointerleave", () => {
    hoveredCell = null;
    renderAttention(pinnedCell);
  });
  svg.addEventListener("click", event => {
    const cell = event.target.closest?.(cellSelector);
    if (!cell || !svg.contains(cell)) {
      pinnedCell = null;
      renderAttention(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pinnedCell = cell;
    renderAttention(cell);
    cell.focus?.({ preventScroll: true });
  });
  svg.addEventListener("keydown", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      pinnedCell = cell;
      renderAttention(cell);
      return;
    }
    if (event.key === "Escape" && pinnedCell) {
      event.preventDefault();
      pinnedCell = null;
      renderAttention(null);
    }
  });
}

function fieldMappingTargets(diagramState, cell) {
  const fieldRectangleId = String(cell?.dataset?.annotationFieldRectangleId || "");
  const fieldRectangle = diagramState.objects.find(object =>
    object?.id === fieldRectangleId
      && object?.type === "entity"
      && object?.entityKind === "field-rectangle"
  ) || null;
  const ids = new Set();
  let databaseEntity = null;
  let databaseField = null;
  if (!fieldRectangle) return { fieldRectangle, databaseEntity, databaseField, ids };

  ids.add(fieldRectangle.id);
  entityRelationships(diagramState)
    .filter(relationship =>
      relationship.source?.id === fieldRectangle.id
        || relationship.target?.id === fieldRectangle.id
    )
    .forEach(relationship => {
      ids.add(relationship.id);
      const entity = relationship.source?.id === fieldRectangle.id
        ? relationship.target
        : relationship.source;
      const field = relationship.source?.id === fieldRectangle.id
        ? relationship.targetField
        : relationship.sourceField;
      if (entity?.entityKind !== "field-rectangle") {
        ids.add(entity.id);
        if (!databaseEntity) {
          databaseEntity = entity;
          databaseField = field || null;
        }
      }
    });

  return { fieldRectangle, databaseEntity, databaseField, ids };
}

function entityRelationships(diagramState) {
  const entities = diagramState.objects.filter(object => object?.type === "entity" && object.visible !== false);
  return entities.flatMap(source => (source.foreignKeys || []).map(foreignKey => {
    const sourceField = source.fields?.find(field => (foreignKey.columns || [])
      .some(column => String(column || "").toLowerCase() === String(field?.name || "").toLowerCase()));
    if (!annotationEntityFieldSupportsMapping(sourceField)) return null;
    const target = entities.find(candidate =>
      String(candidate.entityName || "").toLowerCase() === String(foreignKey.referencedTable || "").toLowerCase()
        && (!foreignKey.referencedSchema
          || String(candidate.entitySchema || "").toLowerCase() === String(foreignKey.referencedSchema || "").toLowerCase())
    );
    if (!target || (target === source && source.showSelfRelationships !== true)) return null;
    const targetField = target.fields?.find(field => (foreignKey.referencedColumns || [])
      .some(column => String(column || "").toLowerCase() === String(field?.name || "").toLowerCase())) || null;
    const sourceVisible = annotationEntityVisibleFields(source)
      .some(field => String(field?.name || "").toLowerCase() === String(sourceField?.name || "").toLowerCase());
    const targetVisible = annotationEntityVisibleFields(target)
      .some(field => String(field?.name || "").toLowerCase() === String(targetField?.name || "").toLowerCase());
    if (!targetField || !sourceVisible || !targetVisible) return null;
    const relationship = { source, sourceField, target, targetField, foreignKey };
    return {
      ...relationship,
      id: relationshipId(relationship)
    };
  }).filter(Boolean));
}

function relationshipId(relationship) {
  const parts = [
    relationship.source?.id,
    ...(relationship.foreignKey?.columns || []),
    relationship.target?.id,
    ...(relationship.foreignKey?.referencedColumns || []),
    relationship.foreignKey?.name || ""
  ].map(value => encodeURIComponent(String(value || "").toLocaleLowerCase()));
  return `entity-relationship:${parts.join(":")}`;
}

function fieldMappingAttentionArrows(svg, cell, targets) {
  const uiCell = fieldMappingCellForKind(svg, cell, "ui") || cell;
  const databaseCell = fieldMappingCellForKind(svg, cell, "database") || cell;
  const fieldBounds = objectBounds(targets.fieldRectangle);
  const databasePoint = annotationEntityFieldLabelPoint(targets.databaseEntity, targets.databaseField);
  const databaseBounds = objectBounds(targets.databaseEntity);
  return [
    attentionArrowToBounds(fieldMappingCellBounds(uiCell), fieldBounds),
    databasePoint
      ? attentionArrowToPoint(fieldMappingCellBounds(databaseCell), databasePoint)
      : attentionArrowToBounds(fieldMappingCellBounds(databaseCell), databaseBounds)
  ].filter(Boolean).join("");
}

function fieldMappingCellForKind(svg, cell, kind) {
  if (String(cell?.dataset?.annotationFieldMappingCellKind || "ui") === kind) return cell;
  const key = String(cell?.dataset?.annotationFieldMappingRowKey || "").replace(/:(ui|database)$/, `:${kind}`);
  return key
    ? svg.querySelector(`[data-annotation-field-mapping-row-key="${CSS.escape(key)}"]`)
    : null;
}

function fieldMappingCellBounds(cell) {
  return {
    x: Number(cell?.dataset?.annotationFieldMappingCellX) || 0,
    y: Number(cell?.dataset?.annotationFieldMappingCellY) || 0,
    width: Math.max(1, Number(cell?.dataset?.annotationFieldMappingCellWidth) || 1),
    height: Math.max(1, Number(cell?.dataset?.annotationFieldMappingCellHeight) || 1)
  };
}

function objectBounds(object) {
  if (!object) return null;
  return {
    x: Number(object.x) || 0,
    y: Number(object.y) || 0,
    width: Math.max(1, Number(object.width) || 1),
    height: Math.max(1, Number(object.height) || 1)
  };
}

function boundsCenter(bounds) {
  return {
    x: bounds.x + (bounds.width / 2),
    y: bounds.y + (bounds.height / 2)
  };
}

function boundsEdgePointToward(bounds, target) {
  const center = boundsCenter(bounds);
  const halfWidth = Math.max(0.5, bounds.width / 2);
  const halfHeight = Math.max(0.5, bounds.height / 2);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return center;
  if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) {
    const scale = halfWidth / Math.max(0.001, Math.abs(dx));
    return {
      x: center.x + (Math.sign(dx) * halfWidth),
      y: center.y + (dy * scale)
    };
  }
  const scale = halfHeight / Math.max(0.001, Math.abs(dy));
  return {
    x: center.x + (dx * scale),
    y: center.y + (Math.sign(dy) * halfHeight)
  };
}

function attentionArrowToBounds(sourceBounds, targetBounds) {
  if (!sourceBounds || !targetBounds) return "";
  const targetCenter = boundsCenter(targetBounds);
  const start = boundsEdgePointToward(sourceBounds, targetCenter);
  const end = boundsEdgePointToward(targetBounds, start);
  return attentionArrowSvg(start, end);
}

function attentionArrowToPoint(sourceBounds, targetPoint) {
  if (!sourceBounds || !targetPoint) return "";
  const start = boundsEdgePointToward(sourceBounds, targetPoint);
  return attentionArrowSvg(start, targetPoint);
}

function attentionArrowSvg(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return "";
  const unitX = dx / length;
  const unitY = dy / length;
  const size = 12;
  const base = {
    x: end.x - (unitX * size),
    y: end.y - (unitY * size)
  };
  const wing = size * 0.46;
  const left = {
    x: base.x + (-unitY * wing),
    y: base.y + (unitX * wing)
  };
  const right = {
    x: base.x - (-unitY * wing),
    y: base.y - (unitX * wing)
  };
  const number = value => String(Math.round(Number(value || 0) * 1000) / 1000);
  return `
    <g class="image-annotation-field-mapping-attention-arrow" data-annotation-field-mapping-attention-arrow="true" pointer-events="none">
      <line class="image-annotation-field-mapping-attention-arrow-line" x1="${number(start.x)}" y1="${number(start.y)}" x2="${number(base.x)}" y2="${number(base.y)}" pointer-events="none"></line>
      <polygon class="image-annotation-field-mapping-attention-arrow-head" points="${number(end.x)},${number(end.y)} ${number(left.x)},${number(left.y)} ${number(right.x)},${number(right.y)}" pointer-events="none"></polygon>
    </g>
  `;
}
