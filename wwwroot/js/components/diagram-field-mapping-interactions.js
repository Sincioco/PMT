import {
  annotationEntityFieldBounds,
  annotationEntityFieldLabelPoint,
  annotationEntityFieldSupportsMapping,
  annotationEntityVisibleFields,
  annotationFieldMappingAttentionGeometry,
  annotationFieldMappingAttentionHighlightSvg,
  buildAnnotationSvg,
  parseAnnotationSvg
} from "./image-annotation.js?v=20260731-rte-checkbox-layout-v2";

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
  let arrowTimer = 0;

  const clearRenderedHighlight = () => {
    svg.querySelectorAll("[data-annotation-field-mapping-attention-highlight]")
      .forEach(element => element.remove());
    svg.querySelectorAll("[data-annotation-field-mapping-row].is-pinned")
      .forEach(element => element.classList.remove("is-pinned"));
  };

  const clearRenderedArrows = () => {
    if (arrowTimer) {
      window.clearTimeout(arrowTimer);
      arrowTimer = 0;
    }
    svg.querySelectorAll("[data-annotation-field-mapping-attention-arrow]")
      .forEach(element => element.remove());
  };

  const renderHighlight = cell => {
    clearRenderedHighlight();
    if (!cell) return;
    const row = cell.closest("[data-annotation-field-mapping-row]");
    row?.classList.add("is-pinned");
    const targets = fieldMappingTargets(diagramState, cell);
    const highlight = annotationFieldMappingAttentionHighlightSvg(diagramState, targets.ids, 1);
    if (highlight) svg.insertAdjacentHTML("beforeend", highlight);
  };

  const renderArrows = cell => {
    clearRenderedArrows();
    if (!cell) return;
    const targets = fieldMappingTargets(diagramState, cell);
    const arrows = fieldMappingAttentionArrows(svg, cell, targets);
    if (arrows) svg.insertAdjacentHTML("beforeend", arrows);
    arrowTimer = window.setTimeout(() => {
      arrowTimer = 0;
      svg.querySelectorAll("[data-annotation-field-mapping-attention-arrow]")
        .forEach(element => element.remove());
    }, 3000);
  };

  const activateCell = (cell, options = {}) => {
    if (options.pin === true) pinnedCell = cell;
    renderHighlight(cell);
    renderArrows(cell);
  };

  svg.addEventListener("pointermove", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell === hoveredCell) return;
    hoveredCell = cell && svg.contains(cell) ? cell : null;
    renderHighlight(hoveredCell || pinnedCell);
    if (hoveredCell) renderArrows(hoveredCell);
    else if (!pinnedCell) clearRenderedArrows();
  });
  svg.addEventListener("pointerleave", () => {
    hoveredCell = null;
    renderHighlight(pinnedCell);
    if (!pinnedCell) clearRenderedArrows();
  });
  svg.addEventListener("click", event => {
    const cell = event.target.closest?.(cellSelector);
    if (!cell || !svg.contains(cell)) {
      pinnedCell = null;
      clearRenderedHighlight();
      clearRenderedArrows();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activateCell(cell, { pin: true });
    cell.focus?.({ preventScroll: true });
  });
  svg.addEventListener("keydown", event => {
    const cell = event.target.closest?.(cellSelector);
    if (cell && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      activateCell(cell, { pin: true });
      return;
    }
    if (event.key === "Escape" && pinnedCell) {
      event.preventDefault();
      pinnedCell = null;
      clearRenderedHighlight();
      clearRenderedArrows();
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
  const geometry = annotationFieldMappingAttentionGeometry({
    uiLabelBounds: fieldMappingLabelBounds(uiCell),
    databaseLabelBounds: fieldMappingLabelBounds(databaseCell),
    uiCellBounds: fieldMappingCellBounds(uiCell),
    databaseCellBounds: fieldMappingCellBounds(databaseCell),
    fieldRectangleBounds: objectBounds(targets.fieldRectangle),
    databaseFieldPoint: annotationEntityFieldLabelPoint(targets.databaseEntity, targets.databaseField),
    databaseFieldBounds: annotationEntityFieldBounds(targets.databaseEntity, targets.databaseField),
    databaseEntityBounds: objectBounds(targets.databaseEntity),
    zoom: 1
  });
  return [geometry.ui, geometry.database].map(attentionArrowSvg).filter(Boolean).join("");
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

function fieldMappingLabelBounds(cell) {
  try {
    const bounds = cell?.querySelector?.("text")?.getBBox?.();
    return bounds?.width > 0 ? bounds : null;
  } catch {
    return null;
  }
}

function objectBounds(object) {
  if (!object) return null;
  const strokeRadius = ["rectangle", "circle", "textbox", "rich-text", "entity", "field-mapping-table"].includes(object.type)
    && object.outlineVisible !== false
    ? Math.max(1, Number(object.strokeWidth) || 1) / 2
    : 0;
  return {
    x: (Number(object.x) || 0) - strokeRadius,
    y: (Number(object.y) || 0) - strokeRadius,
    width: Math.max(1, Number(object.width) || 1) + (strokeRadius * 2),
    height: Math.max(1, Number(object.height) || 1) + (strokeRadius * 2)
  };
}

function attentionArrowSvg(geometry) {
  if (!geometry) return "";
  const number = value => String(Math.round(Number(value || 0) * 1000) / 1000);
  return `
    <g class="image-annotation-field-mapping-attention-arrow" data-annotation-field-mapping-attention-arrow="true" pointer-events="none">
      <line class="image-annotation-field-mapping-attention-arrow-line" x1="${number(geometry.start.x)}" y1="${number(geometry.start.y)}" x2="${number(geometry.lineEnd.x)}" y2="${number(geometry.lineEnd.y)}" pointer-events="none"></line>
      <polygon class="image-annotation-field-mapping-attention-arrow-head" points="${geometry.head.map(point => `${number(point.x)},${number(point.y)}`).join(" ")}" pointer-events="none"></polygon>
    </g>
  `;
}
