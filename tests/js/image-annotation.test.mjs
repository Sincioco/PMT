import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adjustAnnotationEntityRelationshipRoute,
  adjustAnnotationArrowEndpoint,
  annotationEntityAnchorShortcutWarningAllowed,
  annotationEntityFieldSupportsMapping,
  annotationEntityMappingTargets,
  annotationEntityGlobalUnanchorControlState,
  annotationOrgTreeShortcutWarningRequired,
  autoFormatAnnotationEntitiesOrgTree,
  applyAnnotationEntityDefinition,
  applyAnnotationEntityRelationshipGroupStyle,
  applyAnnotationTemplateFormatting,
  annotationArrowGeometry,
  annotationEntityRelationshipsSvg,
  annotationEntityRelationshipRoutingObstacles,
  annotationEntityVisibleFields,
  annotationImageHasReversibleCrop,
  annotationObjectsIntersectingRect,
  annotationOutputBounds,
  annotationObjectTreeHtml,
  annotationSelectionIdsForObject,
  annotationSelectionBounds,
  annotationSvgPlaneMetrics,
  annotationSvgDataUrl,
  annotationTemplateDownloadFile,
  annotationWorkspaceBounds,
  alphabetizeAnnotationEntityFields,
  buildAnnotationObjectTree,
  buildPortableAnnotationSelectionSvg,
  buildAnnotationSelectionSvg,
  buildAnnotationSvg,
  captureAnnotationTemplate,
  clearAnnotationEntityRelationshipRouteOverrides,
  compactAnnotationGroupLayers,
  filterAnnotationObjectTree,
  fitAnnotationArrowToHead,
  formatAnnotationEntityIdentifier,
  instantiateAnnotationTemplate,
  moveAnnotationObjects,
  moveAnnotationLayers,
  normalizeAnnotationState,
  normalizeAnnotationTemplateLibrary,
  orderAnnotationEntityForeignKeysAtTop,
  parseAnnotationEntityDefinition,
  parseAnnotationTemplateUpload,
  parseAnnotationSvg,
  permanentlyCropAnnotationImage,
  reorderAnnotationEntityFields,
  reorderAnnotationObjectTree,
  restoreAnnotationDefaultTemplates,
  resizeAnnotationObjects,
  resizedAnnotationBounds,
  resolveAnnotationEntityOverlaps,
  resolveAnnotationEntitySizeChangeLayout,
  scaleGroupedAnnotationArrowStyle,
  setAnnotationEntityCollapsedState,
  setAnnotationEntityAnnotation,
  setAnnotationEntityDataTypeVisibility,
  setAnnotationEntitiesUnanchored,
  setAnnotationEntityFieldForeignKeyMapping,
  setAnnotationImageCropVisibility,
  syncAnnotationEntityAnnotationArrows,
  snapAnnotationCropPoint,
  snapAnnotationValue,
  wrapAnnotationText,
  zoomAnnotationAtPoint
} from "../../wwwroot/js/components/image-annotation.js";

const sampleImageDataUrl = "data:image/png;base64,AAECAwQ=";
const compactEntityMargin = 48;
const compactEntityGap = compactEntityMargin * 2;

const workTasksCreateTableSql = String.raw`
CREATE TABLE [pmt].[WorkTasks]
(
    [TaskId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_WorkTasks] PRIMARY KEY,
    [ProjectId] INT NOT NULL,
    [SprintId] INT NULL,
    [ParentTaskId] INT NULL,
    [Code] NVARCHAR(40) NOT NULL,
    [Title] NVARCHAR(220) NOT NULL,
    [DescriptionHtml] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_Status] DEFAULT (N'Todo'),
    [Priority] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_Priority] DEFAULT (N'Low'),
    [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_SortOrder] DEFAULT (0),
    [PercentCompleted] INT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_PercentCompleted] DEFAULT (0),
    [Url] NVARCHAR(500) NULL,
    [StartDate] DATETIME2(0) NULL,
    [EndDate] DATETIME2(0) NULL,
    [StartedAt] DATETIME2(0) NULL,
    [CreatedByUserId] INT NOT NULL,
    [UpdatedByUserId] INT NULL,
    [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_WorkTasks_IsDeleted] DEFAULT (0),
    [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    [RowVersion] ROWVERSION NOT NULL,
    [TaskType] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmt_WorkTasks_TaskType] DEFAULT (N'Dev'),
    [StepsToReproduceHtml] NVARCHAR(MAX) NULL,
    [ActualResultHtml] NVARCHAR(MAX) NULL,
    [ExpectedResultHtml] NVARCHAR(MAX) NULL,
    [RootCauseAnalysisHtml] NVARCHAR(MAX) NULL,
    [Environment] NVARCHAR(40) NULL,
    [Severity] NVARCHAR(40) NULL,
    [LinkedBugTaskId] INT NULL,
    [LinkedBlogId] INT NULL,
    CONSTRAINT [FK_pmt_WorkTasks_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
    CONSTRAINT [FK_pmt_WorkTasks_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]),
    CONSTRAINT [FK_pmt_WorkTasks_ParentTask] FOREIGN KEY ([ParentTaskId]) REFERENCES [pmt].[WorkTasks]([TaskId]),
    CONSTRAINT [FK_pmt_WorkTasks_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
    CONSTRAINT [FK_pmt_WorkTasks_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
    CONSTRAINT [FK_pmt_WorkTasks_LinkedBlog] FOREIGN KEY ([LinkedBlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
    CONSTRAINT [CK_pmt_WorkTasks_Percent] CHECK ([PercentCompleted] BETWEEN 0 AND 100),
    CONSTRAINT [UQ_pmt_WorkTasks_Code] UNIQUE ([Code])
);`;

const blogsCreateTableSql = String.raw`
CREATE TABLE [pmt].[Blogs]
(
    [BlogId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Blogs] PRIMARY KEY,
    [ProjectId] INT NULL,
    [SprintId] INT NULL,
    [ParentBlogId] INT NULL,
    [Title] NVARCHAR(220) NOT NULL,
    [BodyHtml] NVARCHAR(MAX) NOT NULL,
    [IsPrivate] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPrivate] DEFAULT (1),
    [IsPinned] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsPinned] DEFAULT (0),
    [CreatedByUserId] INT NOT NULL,
    [UpdatedByUserId] INT NULL,
    [IsDeleted] BIT NOT NULL CONSTRAINT [DF_pmt_Blogs_IsDeleted] DEFAULT (0),
    [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Blogs_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    [RowVersion] ROWVERSION NOT NULL,
    CONSTRAINT [FK_pmt_Blogs_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]),
    CONSTRAINT [FK_pmt_Blogs_Sprint] FOREIGN KEY ([SprintId]) REFERENCES [pmt].[Sprints]([SprintId]),
    CONSTRAINT [FK_pmt_Blogs_ParentBlog] FOREIGN KEY ([ParentBlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
    CONSTRAINT [FK_pmt_Blogs_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
    CONSTRAINT [FK_pmt_Blogs_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId])
);`;

function entityObject(definition, id, x, y, overrides = {}) {
  return {
    id,
    type: "entity",
    x,
    y,
    width: 520,
    height: 900,
    fill: "#ffffff",
    stroke: "#42526b",
    outlineVisible: true,
    strokeWidth: 2,
    opacity: 1,
    textColor: "#172b4d",
    fontFamily: "Arial",
    fontSize: 18,
    entitySchema: definition.schema,
    entityName: definition.name,
    fields: structuredClone(definition.fields),
    foreignKeys: structuredClone(definition.foreignKeys),
    foreignKeysAtTop: false,
    showSelfRelationships: false,
    collapsed: false,
    sourceText: definition.sourceText,
    showKeyColumn: true,
    showDataTypes: false,
    ...overrides
  };
}

function entityRelationshipState(style = {}) {
  const workTasks = entityObject(
    parseAnnotationEntityDefinition(workTasksCreateTableSql),
    "work-tasks",
    40,
    80
  );
  const blogs = entityObject(
    parseAnnotationEntityDefinition(blogsCreateTableSql),
    "blogs",
    800,
    80
  );
  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    workTasks.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-many"
    }
  );
  return normalizeAnnotationState({
    width: 1500,
    height: 1000,
    relationshipStyle: {
      stroke: "#d946ef",
      strokeWidth: 7,
      arrowSize: 30,
      ...style
    },
    objects: [workTasks, blogs]
  });
}

function simpleRelationshipEntity(id, name, x, y, parentName = "") {
  return {
    id,
    type: "entity",
    x,
    y,
    width: 260,
    height: 180,
    entitySchema: "pmt",
    entityName: name,
    fields: [
      { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false },
      ...(parentName
        ? [{ name: `${parentName}Id`, dataType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true }]
        : [])
    ],
    foreignKeys: parentName
      ? [{
          name: `FK_${name}_${parentName}`,
          columns: [`${parentName}Id`],
          referencedSchema: "pmt",
          referencedTable: parentName,
          referencedColumns: [`${parentName}Id`],
          relationshipType: "one-to-many"
        }]
      : [],
    showSelfRelationships: false
  };
}

function orgTreeRouteCollisionEntities(anchorCollision = false) {
  const sizedEntity = (id, name, parentName, width, height, fieldCount) => {
    const entity = simpleRelationshipEntity(id, name, 0, 0, parentName);
    entity.width = width;
    entity.height = height;
    while (entity.fields.length < fieldCount) {
      entity.fields.splice(entity.fields.length - (parentName ? 1 : 0), 0, {
        name: `Field${entity.fields.length}`,
        dataType: "INT",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false
      });
    }
    return entity;
  };
  const entities = [
    sizedEntity("route-root", "Root", "", 220, 120, 1),
    sizedEntity("route-parent-a", "ParentA", "Root", 260, 465, 4),
    sizedEntity("route-parent-b", "ParentB", "Root", 220, 100, 2),
    sizedEntity("route-child-a", "ChildA", "ParentA", 260, 100, 8),
    sizedEntity("route-child-b", "ChildB", "ParentA", 300, 100, 7),
    sizedEntity("route-child-c", "ChildC", "ParentA", 380, 465, 7)
  ];
  if (anchorCollision) {
    const collisionEntity = entities.find(entity => entity.id === "route-child-a");
    collisionEntity.anchorTable = true;
    collisionEntity.y = 1065;
  }
  return entities;
}

function expectedEntityFieldAnchorY(entity, fieldName) {
  const fontSize = entity.fontSize || 18;
  const headerHeight = Math.max(28, fontSize * 1.85);
  const rowHeight = Math.max(23, fontSize * 1.45);
  const fieldIndex = entity.fields.findIndex(field => field.name === fieldName);
  return Math.round((entity.y + headerHeight + ((fieldIndex + 0.5) * rowHeight)) * 1000) / 1000;
}

function relationshipArrowTip(svg) {
  const point = svg.match(/<polygon[^>]+points="([^ ]+) /)?.[1];
  return point ? point.split(",").map(Number) : null;
}

function orthogonalPathPoints(path) {
  const tokens = String(path || "").match(/[MHV]|-?\d+(?:\.\d+)?/g) || [];
  const points = [];
  let x = 0;
  let y = 0;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === "M") {
      x = Number(tokens[index++]);
      y = Number(tokens[index++]);
    } else if (command === "H") x = Number(tokens[index++]);
    else if (command === "V") y = Number(tokens[index++]);
    points.push({ x, y });
  }
  return points;
}

function orthogonalPathSubpaths(path) {
  return String(path || "")
    .split(/(?=\bM\s)/)
    .map(orthogonalPathPoints)
    .filter(points => points.length > 0);
}

function orthogonalPathSegmentKeys(path) {
  return orthogonalPathSubpaths(path).flatMap(points => points.slice(1).map((point, index) => {
    const previous = points[index];
    const first = `${previous.x},${previous.y}`;
    const second = `${point.x},${point.y}`;
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  }));
}

function relationshipHitPathForSource(svg, sourceName) {
  const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return svg.match(new RegExp(`data-pmt-relationship-source="${escaped}"[\\s\\S]*?class="image-annotation-entity-relationship-hit" d="([^"]+)"`))?.[1] || "";
}

function assertNoOverlappingOrthogonalSegments(paths) {
  const lines = new Map();
  paths.flatMap(orthogonalPathSubpaths).forEach(points => {
    points.slice(1).forEach((point, index) => {
      const previous = points[index];
      const vertical = previous.x === point.x;
      const key = vertical ? `v:${previous.x}` : `h:${previous.y}`;
      const start = vertical ? Math.min(previous.y, point.y) : Math.min(previous.x, point.x);
      const end = vertical ? Math.max(previous.y, point.y) : Math.max(previous.x, point.x);
      const intervals = lines.get(key) || [];
      intervals.push([start, end]);
      lines.set(key, intervals);
    });
  });
  lines.forEach(intervals => {
    intervals.sort((first, second) => first[0] - second[0] || first[1] - second[1]);
    intervals.slice(1).forEach((interval, index) => {
      assert.ok(
        interval[0] >= intervals[index][1],
        `collinear relationship segments must not overlap: ${JSON.stringify(intervals)}`
      );
    });
  });
}

function orthogonalSegmentIntersectsEntityInterior(first, second, entity) {
  const epsilon = 0.000001;
  const left = entity.x + epsilon;
  const right = entity.x + entity.width - epsilon;
  const top = entity.y + epsilon;
  const bottom = entity.y + entity.height - epsilon;
  if (Math.abs(first.x - second.x) < epsilon) {
    return first.x > left
      && first.x < right
      && Math.max(Math.min(first.y, second.y), top) < Math.min(Math.max(first.y, second.y), bottom);
  }
  assert.ok(Math.abs(first.y - second.y) < epsilon, "relationship route must remain orthogonal");
  return first.y > top
    && first.y < bottom
    && Math.max(Math.min(first.x, second.x), left) < Math.min(Math.max(first.x, second.x), right);
}

function orthogonalSegmentTouchesEntity(first, second, entity) {
  const epsilon = 0.000001;
  const left = entity.x - epsilon;
  const right = entity.x + entity.width + epsilon;
  const top = entity.y - epsilon;
  const bottom = entity.y + entity.height + epsilon;
  if (Math.abs(first.x - second.x) < epsilon) {
    return first.x >= left
      && first.x <= right
      && Math.max(Math.min(first.y, second.y), top) <= Math.min(Math.max(first.y, second.y), bottom);
  }
  assert.ok(Math.abs(first.y - second.y) < epsilon, "relationship route must remain orthogonal");
  return first.y >= top
    && first.y <= bottom
    && Math.max(Math.min(first.x, second.x), left) <= Math.min(Math.max(first.x, second.x), right);
}

function orthogonalSegmentDistanceFromEntity(first, second, entity) {
  const segment = {
    left: Math.min(first.x, second.x),
    right: Math.max(first.x, second.x),
    top: Math.min(first.y, second.y),
    bottom: Math.max(first.y, second.y)
  };
  const entityRight = entity.x + entity.width;
  const entityBottom = entity.y + entity.height;
  const deltaX = Math.max(entity.x - segment.right, segment.left - entityRight, 0);
  const deltaY = Math.max(entity.y - segment.bottom, segment.top - entityBottom, 0);
  return Math.hypot(deltaX, deltaY);
}

function minimumOrthogonalPathDistanceFromEntity(points, entity) {
  return Math.min(...points.slice(1).map((point, index) =>
    orthogonalSegmentDistanceFromEntity(points[index], point, entity)));
}

function minimumEntityGap(first, second) {
  const deltaX = Math.max(first.x - (second.x + second.width), second.x - (first.x + first.width), 0);
  const deltaY = Math.max(first.y - (second.y + second.height), second.y - (first.y + first.height), 0);
  return Math.hypot(deltaX, deltaY);
}

function annotationEntityRelationshipRouteLengthForTest(points) {
  return points.slice(1).reduce((total, point, index) =>
    total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
}

function interiorHorizontalLaneYs(points, minimumLength = 120) {
  return points.slice(1).flatMap((point, index) => {
    const previous = points[index];
    if (Math.abs(previous.y - point.y) > 0.001) return [];
    if (index === 0 || index === points.length - 2) return [];
    return Math.abs(point.x - previous.x) >= minimumLength ? [point.y] : [];
  });
}

function orthogonalJogLengths(points) {
  const lengths = [];
  for (let index = 1; index < points.length - 2; index += 1) {
    const before = points[index - 1];
    const first = points[index];
    const second = points[index + 1];
    const after = points[index + 2];
    const previousDirection = Math.abs(first.x - before.x) <= 0.001 ? "v" : "h";
    const direction = Math.abs(second.x - first.x) <= 0.001 ? "v" : "h";
    const nextDirection = Math.abs(after.x - second.x) <= 0.001 ? "v" : "h";
    if (previousDirection === nextDirection && previousDirection !== direction) {
      lengths.push(Math.abs(second.x - first.x) + Math.abs(second.y - first.y));
    }
  }
  return lengths;
}

function unrelatedEntityRouteContacts(svg, entities) {
  const contacts = [];
  const relationships = String(svg || "").matchAll(
    /<g class="image-annotation-entity-relationship[^"]*"[^>]*data-pmt-relationship-source="([^"]+)" data-pmt-relationship-target="([^"]+)"[\s\S]*?<path class="image-annotation-entity-relationship-hit" d="([^"]+)"[\s\S]*?<\/g>/g
  );
  for (const relationship of relationships) {
    const sourceEntity = relationship[1].split(".").slice(0, -1).join(".");
    const targetEntity = relationship[2].split(".").slice(0, -1).join(".");
    const points = orthogonalPathPoints(relationship[3]);
    entities.forEach(entity => {
      const entityName = `${entity.entitySchema}.${entity.entityName}`;
      if (entityName === sourceEntity || entityName === targetEntity) return;
      if (points.slice(1).some((point, index) => orthogonalSegmentTouchesEntity(
        points[index],
        point,
        entity
      ))) {
        contacts.push({ relationship: `${relationship[1]} -> ${relationship[2]}`, entity });
      }
    });
  }
  return contacts;
}

function entityRouteContactsAwayFromConnectedFields(svg, entities) {
  const contacts = [];
  const relationships = String(svg || "").matchAll(
    /<g class="image-annotation-entity-relationship[^"]*"[^>]*data-pmt-relationship-source="([^"]+)" data-pmt-relationship-target="([^"]+)"[\s\S]*?<path class="image-annotation-entity-relationship-hit" d="([^"]+)"[\s\S]*?<\/g>/g
  );
  for (const relationship of relationships) {
    const sourceParts = relationship[1].split(".");
    const targetParts = relationship[2].split(".");
    const sourceField = sourceParts.pop();
    const targetField = targetParts.pop();
    const sourceEntity = sourceParts.join(".");
    const targetEntity = targetParts.join(".");
    const points = orthogonalPathPoints(relationship[3]);
    entities.forEach(entity => {
      const entityName = `${entity.entitySchema}.${entity.entityName}`;
      points.slice(1).forEach((point, index) => {
        const previous = points[index];
        if (!orthogonalSegmentTouchesEntity(previous, point, entity)) return;
        const sourceConnector = entityName === sourceEntity
          && index === 0
          && previous.y === expectedEntityFieldAnchorY(entity, sourceField)
          && [entity.x, entity.x + entity.width].includes(previous.x)
          && (point.x - previous.x) * (previous.x === entity.x ? -1 : 1) > 0;
        const targetConnector = entityName === targetEntity
          && index === points.length - 2
          && point.y === expectedEntityFieldAnchorY(entity, targetField)
          && [entity.x, entity.x + entity.width].includes(point.x)
          && (point.x - previous.x) * (point.x === entity.x ? 1 : -1) > 0;
        if (!sourceConnector && !targetConnector) {
          contacts.push({ relationship: `${relationship[1]} -> ${relationship[2]}`, entity, index });
        }
      });
    });
  }
  return contacts;
}

function annotationSvgViewBox(svg) {
  const values = String(svg || "").match(/<svg\b[^>]*\bviewBox="([^"]+)"/)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  assert.equal(values?.length, 4, "annotation SVG should have a four-number viewBox");
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function relationshipPaintPoints(svg) {
  const markup = String(svg || "");
  const points = [];
  const relationshipPaths = [...markup.matchAll(/class="image-annotation-entity-relationship-path" d="([^"]+)"/g)];
  const pathMatches = relationshipPaths.length
    ? relationshipPaths
    : [...markup.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)];
  for (const path of pathMatches) {
    orthogonalPathSubpaths(path[1]).forEach(subpath => points.push(...subpath));
  }
  const relationshipPolygons = [...markup.matchAll(/<polygon\b[^>]*\bclass="image-annotation-entity-relationship-marker"[^>]*\bpoints="([^"]+)"/g)];
  const polygonMatches = relationshipPolygons.length
    ? relationshipPolygons
    : [...markup.matchAll(/<polygon\b[^>]*\bpoints="([^"]+)"/g)];
  for (const polygon of polygonMatches) {
    polygon[1].trim().split(/\s+/).forEach(value => {
      const [x, y] = value.split(",").map(Number);
      points.push({ x, y });
    });
  }
  for (const marker of markup.matchAll(/<path\b[^>]*\bclass="image-annotation-entity-relationship-marker"[^>]*\bd="([^"]+)"/g)) {
    points.push(...orthogonalPathPoints(marker[1]));
  }
  for (const line of markup.matchAll(/<line\b[^>]*\bclass="image-annotation-entity-relationship-marker"[^>]*\bx1="([^"]+)"[^>]*\by1="([^"]+)"[^>]*\bx2="([^"]+)"[^>]*\by2="([^"]+)"/g)) {
    points.push(
      { x: Number(line[1]), y: Number(line[2]) },
      { x: Number(line[3]), y: Number(line[4]) }
    );
  }
  return points;
}

function assertRelationshipPaintFitsViewBox(svg, strokeWidth) {
  const viewBox = annotationSvgViewBox(svg);
  const points = relationshipPaintPoints(svg);
  assert.ok(points.length > 0, "relationship paint should render");
  const strokeRadius = strokeWidth / 2;
  const left = Math.min(...points.map(point => point.x)) - strokeRadius;
  const top = Math.min(...points.map(point => point.y)) - strokeRadius;
  const right = Math.max(...points.map(point => point.x)) + strokeRadius;
  const bottom = Math.max(...points.map(point => point.y)) + strokeRadius;
  const epsilon = 0.001;
  assert.ok(viewBox.x <= left + epsilon, `${viewBox.x} should include relationship left ${left}`);
  assert.ok(viewBox.y <= top + epsilon, `${viewBox.y} should include relationship top ${top}`);
  assert.ok(viewBox.x + viewBox.width >= right - epsilon, "viewBox should include relationship right");
  assert.ok(viewBox.y + viewBox.height >= bottom - epsilon, "viewBox should include relationship bottom");
}

test("entity parser reads the real PMT WorkTasks CREATE TABLE definition", () => {
  const entity = parseAnnotationEntityDefinition(workTasksCreateTableSql, "ManualNameIsOverridden");

  assert.equal(entity.schema, "pmt");
  assert.equal(entity.name, "WorkTasks");
  assert.equal(entity.fields.length, 30);

  const taskId = entity.fields.find(field => field.name === "TaskId");
  assert.deepEqual(
    {
      dataType: taskId?.dataType,
      nullable: taskId?.nullable,
      isPrimaryKey: taskId?.isPrimaryKey,
      isForeignKey: taskId?.isForeignKey,
      isIdentity: taskId?.isIdentity,
      identity: taskId?.identity
    },
    {
      dataType: "INT",
      nullable: false,
      isPrimaryKey: true,
      isForeignKey: false,
      isIdentity: true,
      identity: "IDENTITY(1,1)"
    }
  );

  const projectId = entity.fields.find(field => field.name === "ProjectId");
  assert.equal(projectId?.dataType, "INT");
  assert.equal(projectId?.nullable, false);
  assert.equal(projectId?.isForeignKey, true);

  const sprintId = entity.fields.find(field => field.name === "SprintId");
  assert.equal(sprintId?.nullable, true);
  assert.equal(sprintId?.isForeignKey, true);

  const linkedBlogId = entity.fields.find(field => field.name === "LinkedBlogId");
  assert.equal(linkedBlogId?.dataType, "INT");
  assert.equal(linkedBlogId?.nullable, true);
  assert.equal(linkedBlogId?.isForeignKey, true);
  assert.equal(linkedBlogId?.isImportant, false);

  assert.deepEqual(
    entity.foreignKeys.map(foreignKey => ({
      name: foreignKey.name,
      columns: foreignKey.columns,
      referencedSchema: foreignKey.referencedSchema,
      referencedTable: foreignKey.referencedTable,
      referencedColumns: foreignKey.referencedColumns
    })),
    [
      {
        name: "FK_pmt_WorkTasks_Project",
        columns: ["ProjectId"],
        referencedSchema: "pmt",
        referencedTable: "Projects",
        referencedColumns: ["ProjectId"]
      },
      {
        name: "FK_pmt_WorkTasks_Sprint",
        columns: ["SprintId"],
        referencedSchema: "pmt",
        referencedTable: "Sprints",
        referencedColumns: ["SprintId"]
      },
      {
        name: "FK_pmt_WorkTasks_ParentTask",
        columns: ["ParentTaskId"],
        referencedSchema: "pmt",
        referencedTable: "WorkTasks",
        referencedColumns: ["TaskId"]
      },
      {
        name: "FK_pmt_WorkTasks_CreatedBy",
        columns: ["CreatedByUserId"],
        referencedSchema: "pmt",
        referencedTable: "Users",
        referencedColumns: ["UserId"]
      },
      {
        name: "FK_pmt_WorkTasks_UpdatedBy",
        columns: ["UpdatedByUserId"],
        referencedSchema: "pmt",
        referencedTable: "Users",
        referencedColumns: ["UserId"]
      },
      {
        name: "FK_pmt_WorkTasks_LinkedBlog",
        columns: ["LinkedBlogId"],
        referencedSchema: "pmt",
        referencedTable: "Blogs",
        referencedColumns: ["BlogId"]
      }
    ]
  );
  assert.deepEqual(
    entity.foreignKeys.map(foreignKey => foreignKey.relationshipType),
    Array(6).fill("one-to-many")
  );
});

test("entity parser reads the current PMT Blogs definition used by the prototype ERD", () => {
  const entity = parseAnnotationEntityDefinition(blogsCreateTableSql);

  assert.equal(entity.schema, "pmt");
  assert.equal(entity.name, "Blogs");
  assert.equal(entity.fields.length, 14);
  assert.equal(entity.fields.find(field => field.name === "BlogId")?.isPrimaryKey, true);
  assert.equal(entity.fields.find(field => field.name === "BlogId")?.identity, "IDENTITY(1,1)");
  assert.deepEqual(
    entity.fields.filter(field => field.isForeignKey).map(field => field.name),
    ["ProjectId", "SprintId", "ParentBlogId", "CreatedByUserId", "UpdatedByUserId"]
  );
  assert.deepEqual(
    entity.foreignKeys.map(foreignKey => `${foreignKey.referencedSchema}.${foreignKey.referencedTable}`),
    ["pmt.Projects", "pmt.Sprints", "pmt.Blogs", "pmt.Users", "pmt.Users"]
  );
  assert.ok(entity.foreignKeys.every(foreignKey => foreignKey.relationshipType === "one-to-many"));
});

test("entity parser accepts newline and comma field lists without inventing data types", () => {
  const entity = parseAnnotationEntityDefinition(
    "CustomerId\nDisplay Name,EmailAddress\r\nCreatedAt",
    "Customer"
  );

  assert.equal(entity.schema, "");
  assert.equal(entity.name, "Customer");
  assert.deepEqual(
    entity.fields.map(field => ({ name: field.name, dataType: field.dataType, nullable: field.nullable })),
    [
      { name: "CustomerId", dataType: "", nullable: null },
      { name: "Display Name", dataType: "", nullable: null },
      { name: "EmailAddress", dataType: "", nullable: null },
      { name: "CreatedAt", dataType: "", nullable: null }
    ]
  );
  assert.deepEqual(entity.foreignKeys, []);
});

test("entity parser recognizes ordered columns in an SSMS table-level primary key", () => {
  const entity = parseAnnotationEntityDefinition(String.raw`
    CREATE TABLE [dbo].[Order Details] (
      [Order ID] INT NOT NULL,
      [Line Number] INT NOT NULL,
      [Description] NVARCHAR(200) NULL,
      CONSTRAINT [PK_Order Details] PRIMARY KEY CLUSTERED
      (
        [Order ID] ASC,
        [Line Number] DESC
      )
    );
  `);

  assert.equal(entity.name, "Order Details");
  assert.deepEqual(
    entity.fields.filter(field => field.isPrimaryKey).map(field => field.name),
    ["Order ID", "Line Number"]
  );
});

test("entity parser retains SSMS ALTER TABLE foreign keys and removes optional type brackets", () => {
  const entity = parseAnnotationEntityDefinition(String.raw`
    CREATE TABLE [pmt].[Children] (
      [ChildId] [int] IDENTITY(1,1) NOT NULL,
      [ParentId] [int] NOT NULL,
      [DisplayName] [nvarchar](50) NULL,
      CONSTRAINT [PK_Children] PRIMARY KEY CLUSTERED ([ChildId] ASC)
    );
    GO
    ALTER TABLE [pmt].[Children] WITH CHECK ADD CONSTRAINT [FK_Children_Parents]
      FOREIGN KEY ([ParentId]) REFERENCES [pmt].[Parents] ([ParentId]);
    GO
    ALTER TABLE [pmt].[Children] CHECK CONSTRAINT [FK_Children_Parents];
  `);

  assert.deepEqual(entity.fields.map(field => field.dataType), ["int", "int", "nvarchar(50)"]);
  assert.equal(entity.fields.find(field => field.name === "ParentId")?.isForeignKey, true);
  assert.deepEqual(entity.foreignKeys, [{
    name: "FK_Children_Parents",
    columns: ["ParentId"],
    referencedSchema: "pmt",
    referencedTable: "Parents",
    referencedColumns: ["ParentId"],
    relationshipType: "one-to-many"
  }]);
});

test("entity parser marks inline SQL foreign keys as one-to-many", () => {
  const entity = parseAnnotationEntityDefinition(String.raw`
    CREATE TABLE pmt.Children (
      ChildId INT NOT NULL PRIMARY KEY,
      ParentId INT NOT NULL REFERENCES pmt.Parents (ParentId)
    );
  `);

  assert.equal(entity.foreignKeys[0]?.relationshipType, "one-to-many");
});

test("entity identifier formatting removes optional brackets but keeps brackets required by spaces", () => {
  assert.equal(formatAnnotationEntityIdentifier("[pmt].[WorkTasks]"), "pmt.WorkTasks");
  assert.equal(formatAnnotationEntityIdentifier("[TaskId]"), "TaskId");
  assert.equal(formatAnnotationEntityIdentifier("[Order Details]"), "[Order Details]");
  assert.equal(formatAnnotationEntityIdentifier("[pmt].[Order Details]"), "pmt.[Order Details]");
  assert.equal(formatAnnotationEntityIdentifier("dbo.Customer"), "dbo.Customer");
});

test("entity fields reorder without losing their parsed metadata", () => {
  const taskId = { name: "TaskId", dataType: "INT", isPrimaryKey: true, isIdentity: true };
  const projectId = { name: "ProjectId", dataType: "INT", isForeignKey: true, nullable: false };
  const title = { name: "Title", dataType: "NVARCHAR(220)", nullable: false };
  const fields = [taskId, projectId, title];

  const movedUp = reorderAnnotationEntityFields(fields, 2, 0, "before");
  assert.deepEqual(movedUp.map(field => field.name), ["Title", "TaskId", "ProjectId"]);
  assert.equal(movedUp[0], title);
  assert.equal(movedUp[1], taskId);
  assert.equal(movedUp[2], projectId);

  const movedDown = reorderAnnotationEntityFields(fields, 0, 2, "after");
  assert.deepEqual(movedDown.map(field => field.name), ["ProjectId", "Title", "TaskId"]);
  assert.deepEqual(movedDown.at(-1), {
    name: "TaskId",
    dataType: "INT",
    isPrimaryKey: true,
    isIdentity: true
  });

  assert.deepEqual(reorderAnnotationEntityFields(fields, 1, 1, "after"), fields);
  assert.deepEqual(fields.map(field => field.name), ["TaskId", "ProjectId", "Title"]);
});

test("entity FK-at-top ordering keeps PKs first and preserves each section's order", () => {
  const fields = [
    { name: "Title", isPrimaryKey: false, isForeignKey: false },
    { name: "ProjectId", isPrimaryKey: false, isForeignKey: true },
    { name: "Id", isPrimaryKey: true, isForeignKey: false },
    { name: "SprintId", isPrimaryKey: false, isForeignKey: true },
    { name: "Code", isPrimaryKey: true, isForeignKey: true },
    { name: "Body", isPrimaryKey: false, isForeignKey: false }
  ];

  assert.deepEqual(
    orderAnnotationEntityForeignKeysAtTop(fields).map(field => field.name),
    ["Id", "Code", "ProjectId", "SprintId", "Title", "Body"]
  );
  assert.deepEqual(fields.map(field => field.name), ["Title", "ProjectId", "Id", "SprintId", "Code", "Body"]);
});

test("collapsed Entity view keeps PK, FK, and important fields without changing the stored order", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const entity = entityObject(definition, "work-tasks", 40, 40, {
    height: 1000,
    foreignKeysAtTop: true
  });
  entity.fields.find(field => field.name === "Title").isImportant = true;
  entity.fields.find(field => field.name === "Severity").isPrimaryKey = true;
  entity.fields.find(field => field.name === "Environment").isForeignKey = true;
  const originalOrder = entity.fields.map(field => field.name);

  assert.equal(annotationEntityVisibleFields(entity).length, 30);
  setAnnotationEntityCollapsedState(entity, true);

  assert.equal(entity.collapsed, true);
  assert.ok(entity.height < 1000);
  assert.deepEqual(
    annotationEntityVisibleFields(entity).map(field => field.name),
    [
      "TaskId",
      "Severity",
      "ProjectId",
      "SprintId",
      "ParentTaskId",
      "CreatedByUserId",
      "UpdatedByUserId",
      "Environment",
      "LinkedBlogId",
      "Title"
    ]
  );
  assert.deepEqual(entity.fields.map(field => field.name), originalOrder);
  assert.equal(entity.fields.length, 30);

  const collapsedSvg = buildAnnotationSvg({ width: 1200, height: 900, objects: [entity] }, "");
  assert.match(collapsedSvg, /<title>Expand Entity<\/title>/);
  assert.match(collapsedSvg, />Severity<\/text>/);
  assert.match(collapsedSvg, />Environment<\/text>/);
  assert.match(collapsedSvg, />Title<\/text>/);
  assert.doesNotMatch(collapsedSvg, />Code<\/text>/);

  setAnnotationEntityCollapsedState(entity, false);
  assert.equal(entity.collapsed, false);
  assert.equal(entity.height, 1000);
  assert.equal(annotationEntityVisibleFields(entity).length, 30);
});

test("manual Entity field flags survive reorder and continue driving the collapsed view", () => {
  const fields = [
    { name: "Name", dataType: "NVARCHAR(100)", isPrimaryKey: false, isForeignKey: false, isImportant: true },
    { name: "ParentId", dataType: "INT", isPrimaryKey: false, isForeignKey: true, isImportant: false },
    { name: "Id", dataType: "INT", isPrimaryKey: true, isForeignKey: false, isImportant: false },
    { name: "Notes", dataType: "NVARCHAR(MAX)", isPrimaryKey: false, isForeignKey: false, isImportant: false }
  ];

  const reordered = reorderAnnotationEntityFields(fields, 0, 3, "after");
  assert.deepEqual(reordered.map(field => field.name), ["ParentId", "Id", "Notes", "Name"]);
  assert.equal(reordered.at(-1), fields[0]);
  assert.equal(reordered.at(-1).isImportant, true);
  assert.equal(reordered[0].isForeignKey, true);
  assert.equal(reordered[1].isPrimaryKey, true);
  assert.deepEqual(fields.map(field => field.name), ["Name", "ParentId", "Id", "Notes"]);

  assert.deepEqual(
    annotationEntityVisibleFields({ fields: reordered, collapsed: true, foreignKeysAtTop: true })
      .map(field => field.name),
    ["Id", "ParentId", "Name"]
  );
});

test("compact entity display options and relationship metadata survive SVG round trip", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const state = normalizeAnnotationState({
    width: 1200,
    height: 900,
    objects: [{
      id: "work-tasks-entity",
      type: "entity",
      x: 80,
      y: 60,
      width: 520,
      height: 650,
      fill: "#ffffff",
      stroke: "#42526b",
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1,
      textColor: "#172b4d",
      fontFamily: "Arial",
      fontSize: 18,
      entitySchema: definition.schema,
      entityName: definition.name,
      fields: definition.fields,
      foreignKeys: definition.foreignKeys,
      foreignKeysAtTop: true,
      showSelfRelationships: true,
      sourceText: definition.sourceText,
      showKeyColumn: false,
      showDataTypes: true
    }]
  });

  const svg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  assert.match(svg, />pmt\.WorkTasks<\/text>/);
  assert.match(svg, /text-anchor="middle"/);
  assert.doesNotMatch(svg, />PK<\/text>/);
  assert.match(svg, />INT IDENTITY\(1,1\)<\/text>/);
  assert.match(svg, />NOT<\/text>/);
  assert.match(svg, />NULL<\/text>/);
  assert.doesNotMatch(svg, /,<\/text>/);
  assert.match(svg, /text-decoration="underline"/);
  assert.ok(svg.indexOf(">UpdatedByUserId<\/text>") < svg.indexOf(">Code<\/text>"));
  const stateEntity = state.objects.find(object => object.type === "entity");
  assert.equal(stateEntity.fields[4].name, "Code");

  stateEntity.foreignKeysAtTop = false;
  const originalOrderSvg = buildAnnotationSvg(state, "data:image/png;base64,AAECAwQ=");
  assert.ok(originalOrderSvg.indexOf(">Code<\/text>") < originalOrderSvg.indexOf(">CreatedByUserId<\/text>"));
  stateEntity.foreignKeysAtTop = true;

  const restored = parseAnnotationSvg(svg).objects.find(object => object.type === "entity");
  assert.equal(restored?.showKeyColumn, false);
  assert.equal(restored?.showDataTypes, true);
  assert.equal(restored?.foreignKeysAtTop, true);
  assert.equal(restored?.showSelfRelationships, true);
  assert.equal(restored?.fields.length, 30);
  assert.equal(restored?.foreignKeys.length, 6);
  assert.equal(restored?.foreignKeys[0].referencedTable, "Projects");
});

test("data type visibility compacts from the left while keeping the upper-right toggle fixed", () => {
  const blogs = entityObject(parseAnnotationEntityDefinition(blogsCreateTableSql), "blogs", 40, 80);
  const right = blogs.x + blogs.width;

  setAnnotationEntityDataTypeVisibility(blogs, true);
  assert.deepEqual({ x: blogs.x, width: blogs.width, right: blogs.x + blogs.width }, { x: 40, width: 520, right });

  setAnnotationEntityDataTypeVisibility(blogs, false);
  const compact = { x: blogs.x, width: blogs.width };
  assert.ok(compact.width < 520);
  assert.ok(compact.x > 40);
  assert.equal(blogs.x + blogs.width, right);

  const restored = parseAnnotationSvg(buildAnnotationSvg({
    width: 1200,
    height: 900,
    objects: [blogs]
  }, "")).objects[0];
  assert.equal(restored.x + restored.width, right);
  assert.equal(restored.showDataTypes, false);

  setAnnotationEntityDataTypeVisibility(blogs, true);
  assert.deepEqual({ x: blogs.x, width: blogs.width, right: blogs.x + blogs.width }, { x: 40, width: 520, right });
  const expandedSvg = buildAnnotationSvg({ width: 1200, height: 900, objects: [blogs] }, "");
  assert.doesNotMatch(
    expandedSvg,
    /<g clip-path="url\(#pmt-annotation-entity-clip-blogs\)"/,
    "Entity contents must not use a stale outer clip while resizing or dragging in Chromium"
  );
  assert.match(expandedSvg, />pmt\.Blogs<\/text>/);
  assert.match(expandedSvg, />NVARCHAR\(220\)<\/text>/);
  setAnnotationEntityDataTypeVisibility(blogs, false);
  assert.deepEqual({ x: blogs.x, width: blogs.width }, compact);
});

test("Entity alphabetizing sorts all fields unless the FK-at-top display is enabled", () => {
  const fields = [
    { name: "Title" },
    { name: "ProjectId", isForeignKey: true },
    { name: "Id", isPrimaryKey: true },
    { name: "Body" },
    { name: "SprintId", isForeignKey: true }
  ];

  assert.deepEqual(
    alphabetizeAnnotationEntityFields(fields).map(field => field.name),
    ["Body", "Id", "ProjectId", "SprintId", "Title"]
  );
  assert.deepEqual(
    alphabetizeAnnotationEntityFields(fields, { foreignKeysAtTop: true }).map(field => field.name),
    ["Id", "ProjectId", "SprintId", "Body", "Title"]
  );
});

test("FK mapping replaces only the selected field mapping and normalizes cardinality", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const original = structuredClone(definition.foreignKeys);

  const oneToOne = setAnnotationEntityFieldForeignKeyMapping(
    definition.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "[pmt].[Blogs]",
      referencedField: "[BlogId]",
      relationshipType: "one-to-one"
    }
  );
  assert.deepEqual(definition.foreignKeys, original);
  assert.equal(oneToOne.length, 6);
  assert.deepEqual(
    oneToOne.find(foreignKey => foreignKey.columns.includes("LinkedBlogId")),
    {
      name: "",
      columns: ["LinkedBlogId"],
      referencedSchema: "pmt",
      referencedTable: "Blogs",
      referencedColumns: ["BlogId"],
      relationshipType: "one-to-one"
    }
  );

  const oneToMany = setAnnotationEntityFieldForeignKeyMapping(oneToOne, "LinkedBlogId", {
    referencedEntity: "pmt.Blogs",
    referencedField: "BlogId",
    relationshipType: "one-to-many"
  });
  assert.equal(oneToMany.length, 6);
  assert.equal(
    oneToMany.filter(foreignKey => foreignKey.columns.includes("LinkedBlogId")).length,
    1
  );
  assert.equal(
    oneToMany.find(foreignKey => foreignKey.columns.includes("LinkedBlogId"))?.relationshipType,
    "one-to-many"
  );

  const invalidCardinality = setAnnotationEntityFieldForeignKeyMapping(oneToMany, "LinkedBlogId", {
    referencedEntity: "pmt.Blogs",
    referencedField: "BlogId",
    relationshipType: "many-to-many"
  });
  assert.equal(
    invalidCardinality.find(foreignKey => foreignKey.columns.includes("LinkedBlogId"))?.relationshipType,
    ""
  );

  const cleared = setAnnotationEntityFieldForeignKeyMapping(oneToMany, "LinkedBlogId");
  assert.equal(cleared.length, 5);
  assert.equal(cleared.some(foreignKey => foreignKey.columns.includes("LinkedBlogId")), false);
  assert.deepEqual(
    cleared.map(foreignKey => foreignKey.columns[0]),
    ["ProjectId", "SprintId", "ParentTaskId", "CreatedByUserId", "UpdatedByUserId"]
  );
});

test("changed Entity source preserves manual field designations and mappings for existing fields", () => {
  const originalDefinition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const entity = entityObject(originalDefinition, "work-tasks", 40, 80);
  entity.fields.find(field => field.name === "Severity").isPrimaryKey = true;
  entity.fields.find(field => field.name === "Environment").isForeignKey = true;
  entity.fields.find(field => field.name === "Title").isImportant = true;
  entity.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    entity.foreignKeys,
    "Environment",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-many"
    }
  );

  const revisedDefinition = parseAnnotationEntityDefinition(workTasksCreateTableSql.replace(
    "    [LinkedBlogId] INT NULL,",
    "    [LinkedBlogId] INT NULL,\n    [ReviewNotes] NVARCHAR(500) NULL,"
  ));
  applyAnnotationEntityDefinition(entity, revisedDefinition);

  assert.equal(entity.fields.find(field => field.name === "Severity")?.isPrimaryKey, true);
  assert.equal(entity.fields.find(field => field.name === "Environment")?.isForeignKey, true);
  assert.equal(entity.fields.find(field => field.name === "Title")?.isImportant, true);
  assert.equal(entity.fields.find(field => field.name === "ReviewNotes")?.dataType, "NVARCHAR(500)");
  assert.deepEqual(
    entity.foreignKeys.find(foreignKey => foreignKey.columns.includes("Environment")),
    {
      name: "",
      columns: ["Environment"],
      referencedSchema: "pmt",
      referencedTable: "Blogs",
      referencedColumns: ["BlogId"],
      relationshipType: "one-to-many"
    }
  );
});

test("self-referencing Entity relationships use a visible loop and remain in selection exports", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const workTasks = entityObject(definition, "work-tasks", 40, 80);
  assert.doesNotMatch(annotationEntityRelationshipsSvg([workTasks]), /pmt\.WorkTasks\.ParentTaskId/);
  const hiddenBounds = annotationOutputBounds({
    width: 1200,
    height: 1000,
    objects: [workTasks]
  });
  assert.equal(hiddenBounds.x, 0);
  assert.equal(hiddenBounds.y, 0);

  workTasks.showSelfRelationships = true;
  const relationships = annotationEntityRelationshipsSvg([workTasks]);

  assert.match(relationships, /data-pmt-relationship-source="pmt\.WorkTasks\.ParentTaskId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.WorkTasks\.TaskId"/);
  assert.match(relationships, /M [^<]+ H [^<]+ V [^<]+ H [^<]+ V [^<]+ H /);

  const state = {
    width: 1200,
    height: 1000,
    objects: [workTasks]
  };
  const bounds = annotationOutputBounds(state);
  assert.ok(bounds.x < hiddenBounds.x);
  assert.ok(bounds.y < workTasks.y);
  assert.ok(bounds.width > workTasks.width);

  const selectionSvg = buildAnnotationSelectionSvg(state, new Set([workTasks.id]), "");
  assert.match(selectionSvg, /<svg[^>]*><g><path d="M /);
  assert.match(selectionSvg, />pmt\.WorkTasks<\/text>/);
  assert.doesNotMatch(selectionSvg, /data-pmt-|\bclass=|<title>/);
  assert.ok(selectionSvg.indexOf("<path") < selectionSvg.indexOf(">pmt.WorkTasks<\/text>"));
});

test("Entity relationship SVG defaults to simple field lines and can show both supported cardinalities", () => {
  const workTasksDefinition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const blogsDefinition = parseAnnotationEntityDefinition(blogsCreateTableSql);
  const workTasks = entityObject(workTasksDefinition, "work-tasks", 40, 80);
  const blogs = entityObject(blogsDefinition, "blogs", 800, 80);
  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    workTasks.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-many"
    }
  );

  const simpleLine = annotationEntityRelationshipsSvg([workTasks, blogs]);
  assert.match(simpleLine, /data-pmt-relationship-type="one-to-many"/);
  assert.match(simpleLine, /data-pmt-relationship-source="pmt\.WorkTasks\.LinkedBlogId"/);
  assert.match(simpleLine, /data-pmt-relationship-target="pmt\.Blogs\.BlogId"/);
  assert.match(simpleLine, /<path\b/);
  assert.doesNotMatch(simpleLine, /image-annotation-entity-relationship-marker|<polygon\b/);

  const oneToMany = annotationEntityRelationshipsSvg(
    [workTasks, blogs],
    { showSymbols: true }
  );
  assert.match(oneToMany, /data-pmt-relationship-type="one-to-many"/);
  assert.match(oneToMany, /data-pmt-relationship-source="pmt\.WorkTasks\.LinkedBlogId"/);
  assert.match(oneToMany, /data-pmt-relationship-target="pmt\.Blogs\.BlogId"/);
  assert.match(oneToMany, /<path\b/);
  assert.match(oneToMany, /<polygon\b/);
  const cardinalityPath = oneToMany.match(/class="image-annotation-entity-relationship-marker" d="([^"]+)"/)?.[1] || "";
  assert.equal((cardinalityPath.match(/\bM /g) || []).length, 4);
  const relationshipPath = oneToMany.match(/class="image-annotation-entity-relationship-path" d="([^"]+)"/)?.[1];
  const route = relationshipPath?.match(/^M ([\d.-]+) ([\d.-]+) H ([\d.-]+) V ([\d.-]+) H ([\d.-]+)$/);
  assert.ok(route);
  assert.equal(Number(route[1]), workTasks.x + workTasks.width);
  assert.equal(Number(route[2]), expectedEntityFieldAnchorY(workTasks, "LinkedBlogId"));
  assert.equal(Number(route[4]), expectedEntityFieldAnchorY(blogs, "BlogId"));
  assert.equal(Number(route[5]), blogs.x);
  assert.deepEqual(relationshipArrowTip(oneToMany), [blogs.x, expectedEntityFieldAnchorY(blogs, "BlogId")]);

  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    workTasks.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-one"
    }
  );
  const oneToOne = annotationEntityRelationshipsSvg([workTasks, blogs], { showSymbols: true });
  assert.match(oneToOne, /data-pmt-relationship-type="one-to-one"/);
  const oneToOneMarkerPath = oneToOne.match(/class="image-annotation-entity-relationship-marker" d="([^"]+)"/)?.[1] || "";
  assert.equal((oneToOneMarkerPath.match(/\bM /g) || []).length, 2);

  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    workTasks.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: ""
    }
  );
  const plainArrow = annotationEntityRelationshipsSvg([workTasks, blogs]);
  assert.match(plainArrow, /data-pmt-relationship-type="arrow"/);
  assert.equal((plainArrow.match(/<line\b/g) || []).length, 0);
  assert.doesNotMatch(plainArrow, /image-annotation-entity-relationship-marker|<polygon\b/);

  const linkedBlogIndex = workTasks.fields.findIndex(field => field.name === "LinkedBlogId");
  workTasks.fields = reorderAnnotationEntityFields(workTasks.fields, linkedBlogIndex, 0, "before");
  assert.match(annotationEntityRelationshipsSvg([workTasks, blogs]), /pmt\.WorkTasks\.LinkedBlogId/);

  setAnnotationEntityCollapsedState(workTasks, true);
  assert.match(annotationEntityRelationshipsSvg([workTasks, blogs]), /pmt\.Blogs\.BlogId/);

  workTasks.fields.find(field => field.name === "LinkedBlogId").isForeignKey = false;
  const withoutLinkedBlog = annotationEntityRelationshipsSvg([workTasks, blogs]);
  assert.doesNotMatch(withoutLinkedBlog, /pmt\.WorkTasks\.LinkedBlogId/);
  assert.doesNotMatch(withoutLinkedBlog, /pmt\.WorkTasks\.ParentTaskId/);
  workTasks.showSelfRelationships = true;
  assert.match(annotationEntityRelationshipsSvg([workTasks, blogs]), /pmt\.WorkTasks\.ParentTaskId/);
});

test("Entity relationship lines never fall back to generic table endpoints", () => {
  const workTasks = entityObject(parseAnnotationEntityDefinition(workTasksCreateTableSql), "work-tasks", 40, 80);
  const blogs = entityObject(parseAnnotationEntityDefinition(blogsCreateTableSql), "blogs", 800, 80);
  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(workTasks.foreignKeys, "LinkedBlogId", {
    referencedEntity: "pmt.Blogs",
    referencedField: "BlogId",
    relationshipType: "one-to-many"
  });
  blogs.fields = blogs.fields.filter(field => field.name !== "BlogId");

  assert.equal(annotationEntityRelationshipsSvg([workTasks, blogs]), "");
});

test("Entity relationship routes never pass behind an unrelated Entity", () => {
  const projects = simpleRelationshipEntity("projects", "Projects", 15, 10);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 353, 173);
  workTasks.width = 286;
  workTasks.height = 190;
  const blogs = simpleRelationshipEntity("blogs", "Blogs", 743, 500, "Projects");
  const entities = [projects, workTasks, blogs];
  const naiveMiddleX = (blogs.x + (projects.x + projects.width)) / 2;
  assert.equal(orthogonalSegmentIntersectsEntityInterior(
    { x: naiveMiddleX, y: expectedEntityFieldAnchorY(blogs, "ProjectsId") },
    { x: naiveMiddleX, y: expectedEntityFieldAnchorY(projects, "ProjectsId") },
    workTasks
  ), true);

  for (const allowOverlappingLines of [false, true]) {
    const svg = annotationEntityRelationshipsSvg(entities, { showSymbols: true }, { allowOverlappingLines });
    const path = svg.match(/class="image-annotation-entity-relationship-path" d="([^"]+)"/)?.[1];
    const points = orthogonalPathPoints(path);
    assert.ok(points.length >= 4);
    points.slice(1).forEach((point, index) => {
      entities.forEach(entity => {
        assert.equal(
          orthogonalSegmentIntersectsEntityInterior(points[index], point, entity),
          false,
          `${path} crosses ${entity.entityName}`
        );
      });
    });
    assert.deepEqual(points[0], {
      x: blogs.x,
      y: expectedEntityFieldAnchorY(blogs, "ProjectsId")
    });
    assert.deepEqual(points.at(-1), {
      x: projects.x + projects.width,
      y: expectedEntityFieldAnchorY(projects, "ProjectsId")
    });
    assert.deepEqual(relationshipArrowTip(svg), [
      projects.x + projects.width,
      expectedEntityFieldAnchorY(projects, "ProjectsId")
    ]);
    assert.equal(entityRouteContactsAwayFromConnectedFields(svg, entities).length, 0);
  }
});

test("read-only Diagram SVG can expose clickable relationship hit paths", () => {
  const state = entityRelationshipState();
  const svg = buildAnnotationSvg(state, { interactiveRelationships: true });

  assert.match(svg, /data-annotation-object-type="entity-relationship"/);
  assert.match(svg, /class="image-annotation-entity-relationship-hit"/);
  assert.match(svg, /role="button"/);
  assert.match(svg, /tabindex="0"/);
});

test("Linked Diagram viewer SVG can omit Entity header buttons", () => {
  const state = entityRelationshipState();
  const editableSvg = buildAnnotationSvg(state);
  const linkedViewerSvg = buildAnnotationSvg(state, { entityHeaderButtonsVisible: false });

  assert.match(editableSvg, /class="image-annotation-entity-header-button"/);
  assert.match(editableSvg, /Expand Entity|Collapse Entity/);
  assert.match(editableSvg, /Show data types|Hide data types/);
  assert.doesNotMatch(linkedViewerSvg, /class="image-annotation-entity-header-button"/);
  assert.doesNotMatch(linkedViewerSvg, /data-annotation-entity-header-action/);
  assert.match(linkedViewerSvg, /pmt\.WorkTasks|WorkTasks/);
});

test("read-only Diagram relationship focus suppresses the native SVG focus box", async () => {
  const css = await readFile(new URL("../../wwwroot/css/features/diagram.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.diagram-readonly-svg \[data-annotation-object-type="entity-relationship"\]:focus\s*{[^}]*outline:\s*none;/s
  );
  assert.match(
    css,
    /\.diagram-readonly-svg \.image-annotation-entity-relationship\.is-selected \.image-annotation-entity-relationship-hit\s*{[^}]*stroke:\s*var\(--color-focus-ring\)/s
  );
});

test("PK fields support manual mappings without being designated as foreign keys", () => {
  const parent = simpleRelationshipEntity("parent", "Parent", 40, 80);
  const other = simpleRelationshipEntity("other", "Other", 600, 80);
  const primaryKey = parent.fields.find(field => field.name === "ParentId");

  assert.equal(primaryKey.isForeignKey, false);
  assert.equal(annotationEntityFieldSupportsMapping(primaryKey), true);
  assert.equal(annotationEntityFieldSupportsMapping({ name: "Title" }), false);

  parent.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(parent.foreignKeys, "ParentId", {
    referencedEntity: "pmt.Other",
    referencedField: "OtherId",
    relationshipType: "one-to-one"
  });

  const relationships = annotationEntityRelationshipsSvg([parent, other]);
  assert.match(relationships, /data-pmt-relationship-source="pmt\.Parent\.ParentId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.Other\.OtherId"/);
  assert.equal(primaryKey.isForeignKey, false);
});

test("manual field mapping choices are derived from the Diagram Entities and their fields", () => {
  const targets = annotationEntityMappingTargets([
    simpleRelationshipEntity("parent", "Parent", 40, 80),
    { type: "textbox", text: "Not an Entity" },
    simpleRelationshipEntity("other", "Other", 600, 80)
  ]);

  assert.deepEqual(targets.map(target => target.label), ["pmt.Parent", "pmt.Other"]);
  assert.deepEqual(targets[1].fields.map(field => field.value), ["OtherId"]);
});

test("large Entity relationship routing preserves local geometry while ignoring distant sectors", () => {
  const projects = simpleRelationshipEntity("spatial-projects", "SpatialProjects", 15, 10);
  const blocker = simpleRelationshipEntity("spatial-blocker", "SpatialBlocker", 353, 173);
  blocker.width = 286;
  blocker.height = 190;
  const workTasks = simpleRelationshipEntity(
    "spatial-work-tasks",
    "SpatialWorkTasks",
    743,
    500,
    "SpatialProjects"
  );
  const localEntities = [projects, blocker, workTasks];
  const localSvg = annotationEntityRelationshipsSvg(localEntities, null, { interactive: true });
  const localPath = localSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  assert.ok(localPath);

  const distantEntities = Array.from({ length: 40 }, (_, index) => simpleRelationshipEntity(
    `spatial-distant-${index}`,
    `SpatialDistant${index}`,
    12000 + ((index % 8) * 400),
    12000 + (Math.floor(index / 8) * 260)
  ));
  const largeSvg = annotationEntityRelationshipsSvg(
    [...localEntities, ...distantEntities],
    null,
    { interactive: true }
  );
  const largePath = largeSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const largePoints = orthogonalPathPoints(largePath);

  assert.ok(largePath);
  assert.ok(
    annotationEntityRelationshipRouteLengthForTest(largePoints)
      <= annotationEntityRelationshipRouteLengthForTest(orthogonalPathPoints(localPath)) + 32,
    "distant sectors should not materially alter local routing"
  );
  assert.equal(unrelatedEntityRouteContacts(largeSvg, localEntities).length, 0);
});

test("Entity relationship routes treat an unrelated Entity border as an obstacle", () => {
  const users = simpleRelationshipEntity("border-users", "Users", 2081, 1338);
  const holidays = simpleRelationshipEntity("border-holidays", "Holidays", 1410, 2043, "Users");
  const lookups = simpleRelationshipEntity("border-lookups", "Lookups", 1800, 2043);
  const templates = simpleRelationshipEntity("border-templates", "Templates", 2190, 2043, "Users");
  Object.assign(users, { width: 240, height: 465 });
  Object.assign(holidays, { width: 240, height: 304 });
  Object.assign(lookups, { width: 240, height: 304 });
  Object.assign(templates, { width: 380, height: 120 });
  const entities = [users, holidays, lookups, templates];

  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true
  });
  assert.equal((relationships.match(/class="image-annotation-entity-relationship-hit"/g) || []).length, 2);
  assert.equal(unrelatedEntityRouteContacts(relationships, entities).length, 0);
});

test("Entity relationship routes preserve a readable corridor around a 1px Entity near-miss", () => {
  const parent = simpleRelationshipEntity("clearance-parent", "ClearanceParent", 0, 0);
  const child = simpleRelationshipEntity(
    "clearance-child",
    "ClearanceChild",
    800,
    0,
    "ClearanceParent"
  );
  const directY = expectedEntityFieldAnchorY(child, "ClearanceParentId");
  const blocker = simpleRelationshipEntity("clearance-blocker", "ClearanceBlocker", 600, directY + 1);
  blocker.width = 100;
  blocker.height = 100;

  const svg = annotationEntityRelationshipsSvg([parent, blocker, child], null, { interactive: true });
  const path = svg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const points = orthogonalPathPoints(path);

  assert.ok(path, "relationship should render");
  assert.ok(
    minimumOrthogonalPathDistanceFromEntity(points, blocker) >= 48 - 0.001,
    `${path} should preserve the default Entity clearance`
  );
});

test("Entity relationship routes reserve two margins above Entity headers", () => {
  const parent = simpleRelationshipEntity("header-margin-parent", "HeaderMarginParent", 0, 0);
  const blocker = simpleRelationshipEntity("header-margin-blocker", "HeaderMarginBlocker", 350, 150);
  const child = simpleRelationshipEntity(
    "header-margin-child",
    "HeaderMarginChild",
    800,
    0,
    "HeaderMarginParent"
  );
  blocker.width = 160;
  blocker.height = 100;

  const svg = annotationEntityRelationshipsSvg([parent, blocker, child], null, { interactive: true });
  const path = svg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const points = orthogonalPathPoints(path);
  const topHeaderZone = {
    x: blocker.x - 48,
    y: blocker.y - 96,
    width: blocker.width + 96,
    height: 96
  };

  assert.ok(path, "relationship should render");
  points.slice(1).forEach((point, index) => {
    assert.equal(
      orthogonalSegmentIntersectsEntityInterior(points[index], point, topHeaderZone),
      false,
      `${path} should not route through the double-margin header zone`
    );
  });
});

test("indexed Entity routing preserves the clearance corridor with more than 32 obstacles", () => {
  const parent = simpleRelationshipEntity("indexed-clearance-parent", "IndexedClearanceParent", 0, 0);
  const child = simpleRelationshipEntity(
    "indexed-clearance-child",
    "IndexedClearanceChild",
    800,
    0,
    "IndexedClearanceParent"
  );
  const directY = expectedEntityFieldAnchorY(child, "IndexedClearanceParentId");
  const blocker = simpleRelationshipEntity(
    "indexed-clearance-blocker",
    "IndexedClearanceBlocker",
    600,
    directY + 1
  );
  blocker.width = 100;
  blocker.height = 100;
  const distantEntities = Array.from({ length: 40 }, (_, index) => simpleRelationshipEntity(
    `indexed-clearance-distant-${index}`,
    `IndexedClearanceDistant${index}`,
    12000 + ((index % 8) * 400),
    12000 + (Math.floor(index / 8) * 260)
  ));
  const relationshipStyle = { strokeWidth: 3, arrowSize: 20 };

  const localSvg = annotationEntityRelationshipsSvg(
    [parent, blocker, child],
    relationshipStyle,
    { interactive: true }
  );
  const indexedSvg = annotationEntityRelationshipsSvg(
    [parent, blocker, child, ...distantEntities],
    relationshipStyle,
    { interactive: true }
  );
  const localPath = localSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const indexedPath = indexedSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const points = orthogonalPathPoints(indexedPath);

  assert.ok(localPath);
  assert.ok(indexedPath);
  assert.ok(
    annotationEntityRelationshipRouteLengthForTest(points)
      <= annotationEntityRelationshipRouteLengthForTest(orthogonalPathPoints(localPath)) + 32,
    "distant sectors should not materially alter local clearance routing"
  );
  assert.ok(
    minimumOrthogonalPathDistanceFromEntity(points, blocker) >= 48 - 0.001,
    `${indexedPath} should preserve the indexed style-aware Entity clearance`
  );
});

test("Entity relationship routes remain visible at fractional drag coordinates", () => {
  const parent = simpleRelationshipEntity("fractional-parent", "FractionalParent", 0, 0);
  const child = simpleRelationshipEntity("fractional-child", "FractionalChild", 800, 0, "FractionalParent");

  [800, 800.0004, 800.0006, 800.0014, 800.0016].forEach(x => {
    child.x = x;
    const svg = annotationEntityRelationshipsSvg([parent, child]);
    assert.match(
      svg,
      /class="image-annotation-entity-relationship-path"/,
      `relationship should remain visible when the dragged Entity x-coordinate is ${x}`
    );
    assert.match(svg, /data-pmt-relationship-source="pmt\.FractionalChild\.FractionalParentId"/);
    assert.match(svg, /data-pmt-relationship-target="pmt\.FractionalParent\.FractionalParentId"/);
  });
});

test("Entity relationship routes remain visible while moving beside a non-overlapping Entity", () => {
  const parent = simpleRelationshipEntity("nearby-parent", "NearbyParent", 0, 0);
  const blocker = simpleRelationshipEntity("nearby-blocker", "NearbyBlocker", 680, 0);
  blocker.width = 100;
  const child = simpleRelationshipEntity("nearby-child", "NearbyChild", 804, 0, "NearbyParent");
  const entities = [parent, blocker, child];

  [804, 803, 802, 801, 800, 801, 802, 803, 804].forEach(x => {
    child.x = x;
    const svg = annotationEntityRelationshipsSvg(entities, null, {
      interactive: true,
      selectedIds: new Set([child.id])
    });
    const paths = [...svg.matchAll(/class="image-annotation-entity-relationship-path" d="([^"]+)"/g)];
    assert.equal(paths.length, 1, `relationship should remain visible when the nearby Entity gap is ${x - 780}px`);
    const points = orthogonalPathPoints(paths[0][1]);
    assert.equal(points[0].y, expectedEntityFieldAnchorY(child, "NearbyParentId"));
    assert.ok([child.x, child.x + child.width].includes(points[0].x));
    assert.equal(points.at(-1).y, expectedEntityFieldAnchorY(parent, "NearbyParentId"));
    assert.ok([parent.x, parent.x + parent.width].includes(points.at(-1).x));
    points.slice(1).forEach((point, index) => {
      entities.forEach(entity => {
        assert.equal(
          orthogonalSegmentIntersectsEntityInterior(points[index], point, entity),
          false,
          `${paths[0][1]} crosses ${entity.entityName}`
        );
      });
    });
  });
});

test("stacked Entity relationships prefer local field bridges instead of excessive fan-out", () => {
  const parent = simpleRelationshipEntity("stacked-parent", "StackedParent", 300, 0);
  const child = simpleRelationshipEntity("stacked-child", "StackedChild", 340, 500, "StackedParent");
  parent.width = 220;
  child.width = 220;
  const entities = [parent, child];

  const svg = annotationEntityRelationshipsSvg(entities, null, { interactive: true });
  const path = svg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const points = orthogonalPathPoints(path);
  const leftLimit = Math.min(parent.x, child.x) - 96;
  const rightLimit = Math.max(parent.x + parent.width, child.x + child.width) + 96;

  assert.ok(path, "relationship should render");
  assert.ok(Math.min(...points.map(point => point.x)) >= leftLimit, `${path} should not fan out far left`);
  assert.ok(Math.max(...points.map(point => point.x)) <= rightLimit, `${path} should not fan out far right`);
});

test("selected Entity relationship routes expose draggable handles for movable segments", () => {
  const parent = simpleRelationshipEntity("route-handle-parent", "RouteHandleParent", 0, 0);
  const child = simpleRelationshipEntity(
    "route-handle-child",
    "RouteHandleChild",
    800,
    0,
    "RouteHandleParent"
  );
  const initialSvg = annotationEntityRelationshipsSvg([parent, child], null, { interactive: true });
  const relationshipId = initialSvg.match(
    /data-annotation-object-id="([^"]+)" data-annotation-object-type="entity-relationship"/
  )?.[1];
  assert.ok(relationshipId, "relationship should be individually selectable");

  const selectedSvg = annotationEntityRelationshipsSvg([parent, child], null, {
    interactive: true,
    manualRoutes: true,
    selectedIds: new Set([relationshipId])
  });

  assert.match(selectedSvg, /data-annotation-relationship-handle="segment"/);
  assert.match(selectedSvg, /data-annotation-relationship-segment-axis="x"/);
  assert.match(selectedSvg, /data-annotation-relationship-segment-index="0"/);
  assert.match(selectedSvg, /tabindex="0"/);
  assert.match(selectedSvg, /aria-label="Nudge relationship segment with arrow keys"/);
});

test("selected Entity relationship segment handles can be nudged from the keyboard", async () => {
  const source = await readFile(new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url), "utf8");

  assert.match(source, /function nudgeEntityRelationshipSegment/);
  assert.match(source, /\["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"\]\.includes\(event\.key\)/);
  assert.match(source, /adjustAnnotationEntityRelationshipRoute\(points, segmentIndex, axis, coordinate\)/);
  assert.match(source, /state\.manualEntityRelationshipRoutes = true/);
  assert.match(source, /Relationship segment nudged/);
});

test("selected Entity template name prompt includes the schema-qualified entity name", async () => {
  const source = await readFile(new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url), "utf8");

  assert.match(
    source,
    /formatAnnotationEntityIdentifier\(selection\[0\]\.entitySchema,\s*selection\[0\]\.entityName\)/
  );
});

test("dragging an Entity relationship endpoint segment keeps a short field stub and inserts a nearby joint", () => {
  const points = [
    { x: 100, y: 40 },
    { x: 220, y: 40 },
    { x: 220, y: 180 },
    { x: 500, y: 180 }
  ];
  const adjusted = adjustAnnotationEntityRelationshipRoute(points, 0, "y", 120);

  assert.deepEqual(adjusted[0], points[0], "the field endpoint should stay anchored");
  assert.equal(adjusted[1].y, points[0].y, "the short horizontal stub should keep the original field row");
  assert.ok(adjusted[1].x > points[0].x, "the new joint should sit just outside the entity edge");
  assert.ok(adjusted[1].x <= points[0].x + 40, "the new joint should stay near the table margin");
  assert.deepEqual(adjusted[2], { x: adjusted[1].x, y: 120 });
  assert.equal(adjusted[3].y, 120, "the route after the joint should move to the dragged row");
  assert.equal(adjusted.at(-1).x, points.at(-1).x);
  assert.equal(adjusted.at(-1).y, points.at(-1).y);
});

test("manual Entity relationship route overrides render and persist with the source FK", () => {
  const parent = simpleRelationshipEntity("manual-route-parent", "ManualRouteParent", 0, 0);
  const child = simpleRelationshipEntity(
    "manual-route-child",
    "ManualRouteChild",
    800,
    0,
    "ManualRouteParent"
  );
  const baseSvg = annotationEntityRelationshipsSvg([parent, child], null, { interactive: true });
  const path = baseSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
  const points = orthogonalPathPoints(path);
  const segmentIndex = points.findIndex((point, index) => index > 0
    && index < points.length - 2
    && Math.abs(point.x - points[index + 1].x) <= 0.001);
  assert.ok(segmentIndex > 0, "test route should include a movable vertical segment");

  const adjusted = adjustAnnotationEntityRelationshipRoute(
    points,
    segmentIndex,
    "x",
    points[segmentIndex].x + 80
  );
  child.foreignKeys[0].routeOverride = adjusted;
  const automaticSvg = annotationEntityRelationshipsSvg([parent, child], null, { interactive: true });
  const manualSvg = annotationEntityRelationshipsSvg([parent, child], null, {
    interactive: true,
    manualRoutes: true
  });
  const manualPoints = orthogonalPathPoints(
    manualSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1]
  );

  assert.equal(
    automaticSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1],
    baseSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1],
    "automatic routing should ignore saved manual routes while manual mode is off"
  );
  assert.ok(
    manualPoints.some(point => Math.abs(point.x - adjusted[segmentIndex].x) <= 0.001),
    "manual route should use the adjusted segment coordinate"
  );

  const restored = parseAnnotationSvg(buildAnnotationSvg(normalizeAnnotationState({
    width: 1200,
    height: 600,
    manualEntityRelationshipRoutes: true,
    objects: [parent, child]
  })));
  const restoredChild = restored.objects.find(object => object.id === child.id);
  assert.deepEqual(
    restoredChild.foreignKeys[0].routeOverride,
    adjusted.map(point => ({ x: point.x, y: point.y }))
  );

  const clearResult = clearAnnotationEntityRelationshipRouteOverrides(restored);
  assert.equal(clearResult.clearedCount, 1);
  assert.equal(Object.hasOwn(restored.objects.find(object => object.id === child.id).foreignKeys[0], "routeOverride"), false);
});

test("matching Entity relationships share an aligned target lane without moving field anchors", () => {
  const users = simpleRelationshipEntity("aligned-users", "Users", 33, 444);
  users.width = 313;
  users.height = 317;
  users.fields[0].name = "UserId";

  const auditEntity = (id, name, x, y) => ({
    ...simpleRelationshipEntity(id, name, x, y),
    width: 313,
    height: 255,
    fields: [
      { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: "CreatedByUserId", dataType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true },
      { name: "UpdatedByUserId", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true }
    ],
    foreignKeys: [
      {
        name: `FK_${name}_CreatedBy`,
        columns: ["CreatedByUserId"],
        referencedSchema: "pmt",
        referencedTable: "Users",
        referencedColumns: ["UserId"],
        relationshipType: "one-to-many"
      },
      {
        name: `FK_${name}_UpdatedBy`,
        columns: ["UpdatedByUserId"],
        referencedSchema: "pmt",
        referencedTable: "Users",
        referencedColumns: ["UserId"],
        relationshipType: "one-to-many"
      }
    ]
  });
  const projects = auditEntity("aligned-projects", "Projects", 588, 34);
  const sprints = auditEntity("aligned-sprints", "Sprints", 591, 438);
  const entities = [users, projects, sprints];
  const expectedTarget = {
    x: users.x + users.width,
    y: expectedEntityFieldAnchorY(users, "UserId")
  };
  const pathForSource = (svg, source) => {
    const relationshipStart = svg.indexOf(`data-pmt-relationship-source="${source}"`);
    assert.ok(relationshipStart >= 0, `${source} relationship should render`);
    const relationshipEnd = svg.indexOf("</g>", relationshipStart);
    const relationshipSvg = svg.slice(relationshipStart, relationshipEnd);
    const path = relationshipSvg.match(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/)?.[1];
    assert.ok(path, `${source} relationship should retain its complete selectable route`);
    return orthogonalPathPoints(path);
  };

  for (const sprintX of [591, 588]) {
    sprints.x = sprintX;
    for (const allowOverlappingLines of [false, true]) {
      const svg = annotationEntityRelationshipsSvg(entities, null, {
        allowOverlappingLines,
        interactive: true
      });
      const projectCreated = pathForSource(svg, "pmt.Projects.CreatedByUserId");
      const sprintCreated = pathForSource(svg, "pmt.Sprints.CreatedByUserId");
      const projectUpdated = pathForSource(svg, "pmt.Projects.UpdatedByUserId");
      const sprintUpdated = pathForSource(svg, "pmt.Sprints.UpdatedByUserId");

      assert.equal(projectCreated[1].x, sprintCreated[1].x);
      assert.equal(projectUpdated[1].x, sprintUpdated[1].x);
      if (!allowOverlappingLines) assert.notEqual(projectCreated[1].x, projectUpdated[1].x);
      [projectCreated, sprintCreated, projectUpdated, sprintUpdated].forEach(points => {
        assert.deepEqual(points.at(-1), expectedTarget);
      });
    }
  }
});

test("annotation output and copied-selection bounds include cardinality markers and obstacle detours", () => {
  const verifyOutputAndSelection = (objects, relationshipStyle, verifyRoute) => {
    const state = normalizeAnnotationState({
      width: 1200,
      height: 800,
      relationshipStyle,
      objects
    });
    const outputSvg = buildAnnotationSvg(state, "");
    const selectionSvg = buildAnnotationSelectionSvg(
      state,
      new Set(state.objects.map(object => object.id)),
      ""
    );
    [outputSvg, selectionSvg].forEach(svg => {
      assertRelationshipPaintFitsViewBox(svg, relationshipStyle.strokeWidth);
      verifyRoute(relationshipPaintPoints(svg));
    });
  };

  const normalParent = simpleRelationshipEntity("normal-parent", "NormalParent", 0, 0);
  const normalChild = simpleRelationshipEntity("normal-child", "NormalChild", 800, 0, "NormalParent");
  verifyOutputAndSelection(
    [normalParent, normalChild],
    { stroke: "#42526b", strokeWidth: 12, arrowSize: 100, showSymbols: true },
    points => assert.ok(Math.min(...points.map(point => point.y)) < normalChild.y)
  );

  const detourParent = simpleRelationshipEntity("detour-parent", "DetourParent", 0, 0);
  const detourChild = simpleRelationshipEntity("detour-child", "DetourChild", 800, 0, "DetourParent");
  const blocker = simpleRelationshipEntity("detour-blocker", "DetourBlocker", 350, -100);
  blocker.height = 1000;
  verifyOutputAndSelection(
    [detourParent, blocker, detourChild],
    { stroke: "#42526b", strokeWidth: 10, arrowSize: 30, showSymbols: true },
    points => assert.ok(
      Math.min(...points.map(point => point.y)) <= blocker.y - compactEntityGap + 0.01
        || Math.max(...points.map(point => point.y)) >= blocker.y + blocker.height + compactEntityMargin - 0.01,
      "relationship should detour outside the blocker margin"
    )
  );
});

test("an Entity relationship reroutes instead of touching an endpoint Entity away from its field", () => {
  const parent = simpleRelationshipEntity("parent", "Parent", 0, 0);
  const child = simpleRelationshipEntity("child", "Child", 800, 0, "Parent");
  const blockingEndpoint = simpleRelationshipEntity("blocking-endpoint", "BlockingEndpoint", 790, 0);
  blockingEndpoint.width = 20;

  const svg = annotationEntityRelationshipsSvg([parent, blockingEndpoint, child]);

  assert.match(svg, /image-annotation-entity-relationship-path/);
  assert.doesNotMatch(svg, /<polygon\b/);
  assert.equal(entityRouteContactsAwayFromConnectedFields(svg, [parent, blockingEndpoint, child]).length, 0);
});

test("PMT schema relationships use the shortest clear field routes", async () => {
  const storedSvg = await readFile(
    new URL("../../wwwroot/assets/docs/pmt-database-schema.svg", import.meta.url),
    "utf8"
  );
  const state = parseAnnotationSvg(storedSvg);
  const relationshipsSvg = annotationEntityRelationshipsSvg(
    state.objects,
    state.relationshipStyle,
    {
      interactive: true,
      zoom: 1,
      allowOverlappingLines: state.allowOverlappingEntityLines
    }
  );
  const matches = [...relationshipsSvg.matchAll(
    /data-pmt-relationship-source="([^"]+)" data-pmt-relationship-target="([^"]+)"[\s\S]*?<path class="image-annotation-entity-relationship-hit" d="([^"]+)"/g
  )];
  const assertShortRoute = (source, target, maximumLength) => {
    const match = matches.find(item => item[1] === source && item[2] === target);
    assert.ok(match, `the bundled PMT schema should include ${source} to ${target}`);
    const points = orthogonalPathPoints(match[3]);
    const length = points.slice(1).reduce((total, point, index) => total
      + Math.abs(point.x - points[index].x)
      + Math.abs(point.y - points[index].y), 0);
    assert.ok(length < maximumLength, `expected a short clear route, received ${length}px: ${match[3]}`);
  };

  assertShortRoute("pmt.WorkTasks.LinkedBlogId", "pmt.Blogs.BlogId", 600);
  assertShortRoute("pmt.UserImageAnnotationTemplateLibraries.UserId", "pmt.Users.UserId", 1000);
  assertShortRoute("pmt.Lookups.UpdatedByUserId", "pmt.Users.UserId", 1200);
});

test("Entity size layout separates overlapping relationship endpoints before routing", () => {
  const parent = simpleRelationshipEntity("overlap-parent", "Parent", 100, 100);
  const child = simpleRelationshipEntity("overlap-child", "Child", 100, 100, "Parent");
  const state = normalizeAnnotationState({
    width: 1000,
    height: 700,
    objects: [parent, child]
  });
  const stateChild = state.objects.find(object => object.id === child.id);

  const result = resolveAnnotationEntitySizeChangeLayout(state, stateChild);
  const stateParent = state.objects.find(object => object.id === parent.id);

  assert.equal(result.unresolvedOverlapCount, 0);
  assert.notEqual(stateParent.x, stateChild.x);
  assert.match(annotationEntityRelationshipsSvg(state.objects), /image-annotation-entity-relationship-path/);
});

test("Entity overlap resolution cascades until every movable table is visible", () => {
  const first = simpleRelationshipEntity("overlap-first", "First", 100, 100);
  const second = simpleRelationshipEntity("overlap-second", "Second", 180, 100);
  const third = simpleRelationshipEntity("overlap-third", "Third", 260, 100);
  first.anchorTable = true;
  const state = normalizeAnnotationState({
    width: 1200,
    height: 700,
    objects: [first, second, third]
  });

  const result = resolveAnnotationEntityOverlaps(state);
  const entities = state.objects.filter(object => object.type === "entity");
  const overlaps = entities.flatMap((entity, index) => entities.slice(index + 1).filter(other =>
    Math.min(entity.x + entity.width, other.x + other.width) - Math.max(entity.x, other.x) > 0
      && Math.min(entity.y + entity.height, other.y + other.height) - Math.max(entity.y, other.y) > 0
  ));

  assert.equal(result.unresolvedOverlapCount, 0);
  assert.ok(result.movedCount >= 2);
  assert.equal(overlaps.length, 0);
  assert.deepEqual(
    { x: state.objects[0].x, y: state.objects[0].y },
    { x: first.x, y: first.y },
    "the Anchor table should remain fixed"
  );
});

test("Entity overlap resolution treats near-touching tables as a layout collision", () => {
  const first = simpleRelationshipEntity("near-touch-first", "NearTouchFirst", 100, 100);
  const second = simpleRelationshipEntity(
    "near-touch-second",
    "NearTouchSecond",
    first.x + first.width + 10,
    100
  );
  first.anchorTable = true;
  const state = normalizeAnnotationState({
    width: 1200,
    height: 700,
    objects: [first, second]
  });

  const result = resolveAnnotationEntityOverlaps(state);
  const entities = state.objects.filter(object => object.type === "entity");

  assert.equal(result.unresolvedOverlapCount, 0);
  assert.ok(result.movedCount >= 1);
  assert.ok(
    minimumEntityGap(entities[0], entities[1]) >= 96 - 0.001,
    "movable Entities should keep the universal Entity margin"
  );
});

test("read-only SVG rendering applies the universal Entity margin to old saved diagrams", () => {
  const first = simpleRelationshipEntity("saved-near-touch-first", "SavedNearTouchFirst", 100, 100);
  const second = simpleRelationshipEntity(
    "saved-near-touch-second",
    "SavedNearTouchSecond",
    first.x + first.width + 10,
    100
  );
  first.anchorTable = true;
  const svg = buildAnnotationSvg(normalizeAnnotationState({
    width: 1200,
    height: 700,
    objects: [first, second]
  }));
  const restored = parseAnnotationSvg(svg);
  const entities = restored.objects.filter(object => object.type === "entity");

  assert.ok(
    minimumEntityGap(entities[0], entities[1]) >= 96 - 0.001,
    "rendered SVG metadata should not preserve near-touching Entity positions"
  );
});

test("global Entity Relationships formatting defaults to simple lines and persists opt-in symbols", () => {
  const state = entityRelationshipState();
  assert.equal(state.allowOverlappingEntityLines, false);
  assert.deepEqual(
    {
      stroke: state.relationshipStyle.stroke,
      strokeWidth: state.relationshipStyle.strokeWidth,
      arrowSize: state.relationshipStyle.arrowSize,
      showSymbols: state.relationshipStyle.showSymbols
    },
    { stroke: "#d946ef", strokeWidth: 7, arrowSize: 30, showSymbols: false }
  );
  assert.equal(state.objects.some(object => object.type === "entity-relationships"), false);

  state.allowOverlappingEntityLines = true;
  const svg = buildAnnotationSvg(state, "");
  assert.match(svg, /class="image-annotation-entity-relationship-path"[^>]+stroke="#d946ef"[^>]+stroke-width="7"/);
  assert.doesNotMatch(svg, /image-annotation-entity-relationship-marker|<polygon\b/);

  applyAnnotationEntityRelationshipGroupStyle(state, { showSymbols: true });
  const symbolSvg = buildAnnotationSvg(state, "");
  assert.match(symbolSvg, /<path class="image-annotation-entity-relationship-marker"[^>]+stroke="#d946ef"[^>]+stroke-width="7"/);
  assert.match(symbolSvg, /<polygon[^>]+fill="#d946ef"/);

  const restored = parseAnnotationSvg(symbolSvg);
  assert.deepEqual(
    {
      stroke: restored.relationshipStyle.stroke,
      strokeWidth: restored.relationshipStyle.strokeWidth,
      arrowSize: restored.relationshipStyle.arrowSize,
      showSymbols: restored.relationshipStyle.showSymbols
    },
    { stroke: "#d946ef", strokeWidth: 7, arrowSize: 30, showSymbols: true }
  );
  assert.equal(restored.allowOverlappingEntityLines, true);
});

test("individual Entity relationships persist and render independent style overrides", () => {
  const state = entityRelationshipState();
  const workTasks = state.objects.find(object => object.id === "work-tasks");
  const linkedBlog = workTasks.foreignKeys.find(foreignKey => foreignKey.columns.includes("LinkedBlogId"));
  linkedBlog.styleOverride = {
    stroke: "#dc2626",
    strokeWidth: 8,
    arrowSize: 34
  };

  const svg = buildAnnotationSvg(state, "");
  const relationshipMarkup = svg.match(/<g class="image-annotation-entity-relationship"[^>]+data-pmt-relationship-source="pmt\.WorkTasks\.LinkedBlogId"[\s\S]*?<\/g>/)?.[0];
  assert.ok(relationshipMarkup);
  assert.match(relationshipMarkup, /data-annotation-relationship-stroke-width="8"/);
  assert.match(svg, /class="image-annotation-entity-relationship-path"[^>]+stroke="#dc2626"[^>]+stroke-width="8"/);

  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(
    restored.objects.find(object => object.id === "work-tasks")
      .foreignKeys.find(foreignKey => foreignKey.columns.includes("LinkedBlogId"))
      .styleOverride,
    { stroke: "#dc2626", strokeWidth: 8, arrowSize: 34 }
  );
});

test("shared same-style relationship segments paint once while every relationship stays selectable", () => {
  const parent = simpleRelationshipEntity("dedupe-parent", "Parent", 0, 300);
  const children = [
    simpleRelationshipEntity("dedupe-child-a", "ChildA", 900, 0, "Parent"),
    simpleRelationshipEntity("dedupe-child-b", "ChildB", 900, 300, "Parent"),
    simpleRelationshipEntity("dedupe-child-c", "ChildC", 900, 600, "Parent")
  ];
  const entities = [parent, ...children];
  const options = { allowOverlappingLines: true, interactive: true, zoom: 1 };

  const svg = annotationEntityRelationshipsSvg(entities, null, options);
  const visiblePaths = [...svg.matchAll(/class="image-annotation-entity-relationship-path" d="([^"]+)"/g)];
  const hitPaths = [...svg.matchAll(/class="image-annotation-entity-relationship-hit" d="([^"]+)"/g)];
  const visibleSegments = visiblePaths.flatMap(match => orthogonalPathSegmentKeys(match[1]));
  const hitSegments = hitPaths.flatMap(match => orthogonalPathSegmentKeys(match[1]));

  assert.equal(visiblePaths.length, 1);
  assert.equal(hitPaths.length, 3);
  assert.equal((svg.match(/<g class="image-annotation-entity-relationship"/g) || []).length, 3);
  assert.equal(new Set(visibleSegments).size, visibleSegments.length);
  assertNoOverlappingOrthogonalSegments(visiblePaths.map(match => match[1]));
  assert.ok(visibleSegments.length < hitSegments.length, "shared route segments should paint only once");
  assert.doesNotMatch(svg, /image-annotation-entity-relationship-marker|<polygon\b/);

  const groupSelected = annotationEntityRelationshipsSvg(entities, null, { ...options, selected: true });
  assert.equal((groupSelected.match(/class="image-annotation-entity-relationship-selection"/g) || []).length, 1);
  assert.equal((groupSelected.match(/class="image-annotation-entity-relationship-hit"/g) || []).length, 3);

  const symbols = annotationEntityRelationshipsSvg(entities, { showSymbols: true }, options);
  assert.equal((symbols.match(/<polygon\b/g) || []).length, 3);

  children[0].foreignKeys[0].styleOverride = { stroke: "#dc2626" };
  const styled = annotationEntityRelationshipsSvg(entities, null, options);
  assert.equal((styled.match(/class="image-annotation-entity-relationship-path"/g) || []).length, 2);
  assert.match(styled, /class="image-annotation-entity-relationship-path"[^>]+stroke="#dc2626"/);
  assert.match(styled, /class="image-annotation-entity-relationship-path"[^>]+stroke="#42526b"/);
});

test("formatting the Entity Relationships parent clears only that property from child overrides", () => {
  const state = entityRelationshipState();
  const workTasks = state.objects.find(object => object.id === "work-tasks");
  const linkedBlog = workTasks.foreignKeys.find(foreignKey => foreignKey.columns.includes("LinkedBlogId"));
  linkedBlog.styleOverride = {
    stroke: "#dc2626",
    strokeWidth: 8,
    arrowSize: 34
  };

  applyAnnotationEntityRelationshipGroupStyle(state, { stroke: "#111827", strokeWidth: 4 });

  assert.equal(state.relationshipStyle.stroke, "#111827");
  assert.equal(state.relationshipStyle.strokeWidth, 4);
  assert.deepEqual(linkedBlog.styleOverride, { arrowSize: 34 });
  const svg = buildAnnotationSvg(state, "");
  assert.match(svg, /class="image-annotation-entity-relationship-path"[^>]+stroke="#111827"[^>]+stroke-width="4"/);
});

test("remapping a styled foreign key preserves its connector override", () => {
  const original = [{
    name: "",
    columns: ["ParentId"],
    referencedSchema: "pmt",
    referencedTable: "ParentA",
    referencedColumns: ["ParentAId"],
    relationshipType: "one-to-many",
    styleOverride: { stroke: "#dc2626", strokeWidth: 6 }
  }];
  const remapped = setAnnotationEntityFieldForeignKeyMapping(original, "ParentId", {
    referencedEntity: "pmt.ParentB",
    referencedField: "ParentBId",
    relationshipType: "one-to-one"
  });
  assert.deepEqual(remapped[0].styleOverride, { stroke: "#dc2626", strokeWidth: 6 });
  assert.deepEqual(setAnnotationEntityFieldForeignKeyMapping(remapped, "ParentId"), []);
});

test("Objects tree and live SVG expose one fixed selectable Entity Relationships unit", () => {
  const state = entityRelationshipState();
  const relationshipNodes = buildAnnotationObjectTree(state)
    .filter(node => node.id === "entity-relationships");
  assert.equal(relationshipNodes.length, 1);
  assert.equal(relationshipNodes[0].name, "Entity Relationships");
  assert.equal(relationshipNodes[0].fixed, true);
  assert.equal(relationshipNodes[0].count, 1);
  assert.equal(relationshipNodes[0].children.length, 1);
  assert.equal(relationshipNodes[0].children[0].kind, "relationship");
  assert.equal(relationshipNodes[0].children[0].fixed, true);
  assert.equal(relationshipNodes[0].children[0].name, "pmt.WorkTasks.LinkedBlogId → pmt.Blogs.BlogId");
  const relationshipId = relationshipNodes[0].children[0].id;

  const liveSvg = annotationEntityRelationshipsSvg(
    state.objects,
    state.relationshipStyle,
    { interactive: true, selected: true, zoom: 1 }
  );
  assert.equal((liveSvg.match(/data-annotation-object-id="entity-relationships"/g) || []).length, 1);
  assert.match(liveSvg, /data-annotation-object-type="entity-relationships"/);
  assert.match(liveSvg, /class="image-annotation-entity-relationship-hit"[^>]+stroke="transparent"[^>]+pointer-events="stroke"/);
  assert.match(liveSvg, /class="image-annotation-entity-relationship-selection"/);
  assert.match(liveSvg, new RegExp(`data-annotation-object-id="${relationshipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.doesNotMatch(liveSvg, /image-annotation-entity-relationship-marker|<polygon\b/);
  [
    "image-annotation-entity-relationship-path",
    "image-annotation-entity-relationship-hit"
  ].forEach(className => {
    const element = liveSvg.match(new RegExp(`<path\\b[^>]*class="${className}"[^>]*>`))?.[0] || "";
    assert.ok(element, `${className} should render`);
    assert.doesNotMatch(element, /vector-effect="non-scaling-stroke"/);
  });
  const selectionElement = liveSvg.match(/<path\b[^>]*class="image-annotation-entity-relationship-selection"[^>]*>/)?.[0] || "";
  assert.ok(selectionElement, "relationship selection should render");
  assert.match(selectionElement, /stroke-width="1"/);
  assert.match(selectionElement, /vector-effect="non-scaling-stroke"/);

  const symbolSvg = annotationEntityRelationshipsSvg(
    state.objects,
    { ...state.relationshipStyle, showSymbols: true }
  );
  const marker = symbolSvg.match(/<path\b[^>]*class="image-annotation-entity-relationship-marker"[^>]*>/)?.[0] || "";
  assert.ok(marker, "relationship marker should render when symbols are enabled");
  assert.doesNotMatch(marker, /vector-effect="non-scaling-stroke"/);

  const individuallySelectedSvg = annotationEntityRelationshipsSvg(
    state.objects,
    state.relationshipStyle,
    { interactive: true, selectedIds: new Set([relationshipId]), zoom: 1 }
  );
  assert.equal((individuallySelectedSvg.match(/class="image-annotation-entity-relationship-selection"/g) || []).length, 1);

  const relationshipTemplate = captureAnnotationTemplate(
    state,
    new Set([relationshipId]),
    "",
    "One Connector"
  );
  assert.ok(relationshipTemplate.relationshipStyle);
  assert.equal(relationshipTemplate.objects.length, 0);

  const workTasksOnly = normalizeAnnotationState({
    width: 1000,
    height: 800,
    objects: [state.objects.find(object => object.id === "work-tasks")]
  });
  assert.equal(buildAnnotationObjectTree(workTasksOnly)
    .some(node => node.id === "entity-relationships"), false);
});

test("relationship-only templates change global connector formatting without changing Entities", () => {
  const source = entityRelationshipState();
  const template = captureAnnotationTemplate(
    source,
    new Set(["entity-relationships"]),
    "",
    "ERD Connections"
  );
  assert.ok(template);
  assert.equal(template.objects.length, 0);
  assert.deepEqual(
    {
      type: template.relationshipStyle.type,
      stroke: template.relationshipStyle.stroke,
      strokeWidth: template.relationshipStyle.strokeWidth,
      arrowSize: template.relationshipStyle.arrowSize
    },
    {
      type: "entity-relationships",
      stroke: "#d946ef",
      strokeWidth: 7,
      arrowSize: 30
    }
  );

  const destination = entityRelationshipState({
    stroke: "#111111",
    strokeWidth: 2,
    arrowSize: 10
  });
  const entitiesBefore = structuredClone(destination.objects);
  const result = applyAnnotationTemplateFormatting(template, [destination.relationshipStyle]);
  assert.equal(result.structureMatches, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.changedCount, 1);
  assert.deepEqual(
    {
      stroke: destination.relationshipStyle.stroke,
      strokeWidth: destination.relationshipStyle.strokeWidth,
      arrowSize: destination.relationshipStyle.arrowSize
    },
    { stroke: "#d946ef", strokeWidth: 7, arrowSize: 30 }
  );
  assert.deepEqual(destination.objects, entitiesBefore);
});

test("Auto Format - Compact puts parents above descendants and only changes Entity positions", () => {
  const root = simpleRelationshipEntity("root", "Root", 700, 500);
  const childA = simpleRelationshipEntity("child-a", "ChildA", 50, 40, "Root");
  const childB = simpleRelationshipEntity("child-b", "ChildB", 1200, 900, "Root");
  const grandchild = simpleRelationshipEntity("grandchild", "Grandchild", 300, 120, "ChildA");
  const entities = [root, childA, childB, grandchild];
  const contentBefore = entities.map(entity => {
    const copy = structuredClone(entity);
    delete copy.x;
    delete copy.y;
    return copy;
  });

  const result = autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: root.id,
    allowOverlappingLines: false
  });
  assert.deepEqual(
    { levelCount: result.levelCount, cycleBreakCount: result.cycleBreakCount, relationshipCount: result.relationshipCount },
    { levelCount: 3, cycleBreakCount: 0, relationshipCount: 3 }
  );
  assert.ok(root.y < childA.y);
  assert.equal(childA.y, childB.y);
  assert.ok(childA.y < grandchild.y);
  assert.equal(Math.min(childA.x, childB.x) + childA.width + compactEntityGap, root.x);
  assert.equal(Math.max(childA.x, childB.x), root.x + root.width + compactEntityGap);
  const relationships = annotationEntityRelationshipsSvg(
    entities,
    { showSymbols: true },
    { allowOverlappingLines: false }
  );
  assert.match(relationships, /data-pmt-relationship-source="pmt\.ChildA\.RootId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.Root\.RootId"/);
  const arrowTip = relationshipArrowTip(relationships);
  assert.ok(arrowTip);
  assert.ok([root.x, root.x + root.width].includes(arrowTip[0]));
  assert.equal(arrowTip[1], expectedEntityFieldAnchorY(root, "RootId"));
  assert.deepEqual(entities.map(entity => {
    const copy = structuredClone(entity);
    delete copy.x;
    delete copy.y;
    return copy;
  }), contentBefore);

  const second = autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: root.id,
    allowOverlappingLines: false
  });
  assert.equal(second.movedCount, 0);
});

test("Auto Format - Compact nudges movable Entities off unrelated relationship routes and stays idempotent", () => {
  const entities = orgTreeRouteCollisionEntities();
  const result = autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: "route-root",
    allowOverlappingLines: false,
    gridSize: 20
  });

  assert.equal(result.routeAdjustedCount, 0);
  assert.equal(result.unresolvedRouteContactCount, 0);
  assert.equal(entities.find(entity => entity.id === "route-child-a").x, 0);
  assert.equal(new Set(entities
    .filter(entity => entity.id.startsWith("route-child-"))
    .map(entity => entity.y)).size, 1, "direct descendants should remain top-aligned");
  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true
  });
  assert.equal(unrelatedEntityRouteContacts(relationships, entities).length, 0);

  const positions = entities.map(entity => ({ id: entity.id, x: entity.x, y: entity.y }));
  const second = autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: "route-root",
    allowOverlappingLines: false,
    gridSize: 20
  });
  assert.equal(second.movedCount, 0);
  assert.deepEqual(entities.map(entity => ({ id: entity.id, x: entity.x, y: entity.y })), positions);
});

test("Auto Format - Compact preserves an unrelated Anchor table without needing the old spread-out shortcut", () => {
  const entities = orgTreeRouteCollisionEntities(true);
  const anchor = entities.find(entity => entity.id === "route-child-a");
  const originalPosition = { x: anchor.x, y: anchor.y };
  const result = autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: "route-root",
    allowOverlappingLines: false,
    gridSize: 20
  });

  assert.equal(result.routeAdjustedCount, 0);
  assert.equal(result.unresolvedRouteContactCount, 0);
  assert.equal(result.fixedConstraintShortcutCount, 0);
  assert.equal(annotationOrgTreeShortcutWarningRequired(result), false);
  assert.deepEqual({ x: anchor.x, y: anchor.y }, originalPosition);
});

test("global Entity unanchor state prevents an Anchor shortcut warning during Org Tree layout", () => {
  const state = normalizeAnnotationState({
    width: 2200,
    height: 1800,
    objects: orgTreeRouteCollisionEntities(true)
  });
  assert.deepEqual(annotationEntityGlobalUnanchorControlState(state), {
    entityCount: 6,
    anchoredEntityCount: 1,
    checked: false,
    indeterminate: true,
    disabled: false
  });

  setAnnotationEntitiesUnanchored(state, true);
  assert.deepEqual(annotationEntityGlobalUnanchorControlState(state), {
    entityCount: 6,
    anchoredEntityCount: 0,
    checked: true,
    indeterminate: false,
    disabled: false
  });

  const result = autoFormatAnnotationEntitiesOrgTree(state.objects, {
    preferredRootId: "route-root",
    allowOverlappingLines: false,
    gridSize: 20
  });
  assert.equal(result.anchorCount, 0);
  assert.equal(result.anchoredRelationshipCount, 0);
  assert.equal(result.fixedConstraintShortcutCount, 0);
  assert.equal(annotationOrgTreeShortcutWarningRequired(result), false);
  assert.equal(annotationEntityGlobalUnanchorControlState(state).checked, true,
    "Org Tree must leave the current global-unanchor checkbox state accurate");
  assert.equal(annotationEntityAnchorShortcutWarningAllowed(state), false,
    "the global-unanchor checkbox must suppress Anchor shortcut dialogs");
  assert.equal(annotationOrgTreeShortcutWarningRequired({
    anchoredRelationshipCount: 0,
    fixedConstraintShortcutCount: 0,
    unresolvedRouteContactCount: 3
  }), false, "unresolved movable contacts alone must not claim an Anchor shortcut");
});

test("Org Tree treats the selected central Entity as most important without reversing FK arrows", () => {
  const projects = simpleRelationshipEntity("projects", "Projects", 1100, 700);
  const blogs = simpleRelationshipEntity("blogs", "Blogs", 40, 700);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 500, 40, "Projects");
  workTasks.fields.push({
    name: "BlogId",
    dataType: "int",
    isNullable: false,
    isPrimaryKey: false,
    isForeignKey: true,
    isImportant: false
  });
  workTasks.foreignKeys.push({
    name: "FK_WorkTasks_Blogs",
    columns: ["BlogId"],
    referencedSchema: "pmt",
    referencedTable: "Blogs",
    referencedColumns: ["BlogsId"],
    relationshipType: "one-to-many"
  });

  const result = autoFormatAnnotationEntitiesOrgTree([projects, blogs, workTasks], {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false
  });

  assert.equal(result.levelCount, 2);
  assert.ok(workTasks.y < projects.y);
  assert.equal(projects.y, blogs.y);
  const relationships = annotationEntityRelationshipsSvg(
    [projects, blogs, workTasks],
    null,
    { allowOverlappingLines: false }
  );
  assert.match(relationships, /data-pmt-relationship-source="pmt\.WorkTasks\.ProjectsId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.Projects\.ProjectsId"/);
  assert.match(relationships, /data-pmt-relationship-source="pmt\.WorkTasks\.BlogId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.Blogs\.BlogsId"/);
});

test("Auto Format - Compact pulls unanchored side tables back to compact left and right corridors", () => {
  const blogs = simpleRelationshipEntity("blogs", "Blogs", -1000, 900);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 900, 0, "Blogs");
  const attachments = simpleRelationshipEntity("attachments", "TaskAttachments", 2400, 1200, "WorkTasks");
  workTasks.height = 720;

  const result = autoFormatAnnotationEntitiesOrgTree([blogs, workTasks, attachments], {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false,
    gridSize: 20
  });

  assert.equal(result.levelCount, 2);
  assert.equal(blogs.y, attachments.y, "direct level 1 tables should keep the same top");
  assert.equal(workTasks.x - (blogs.x + blogs.width), compactEntityGap);
  assert.equal(attachments.x - (workTasks.x + workTasks.width), compactEntityGap);
  assert.ok(workTasks.x - blogs.x < 1900, "left table should be pulled inward from the user's dragged-out distance");
  assert.ok(attachments.x < 2400, "right table should be pulled inward from the user's dragged-out position");
});

test("Auto Format - Compact balances same-side direct parents around the central Entity", () => {
  const projects = simpleRelationshipEntity("projects", "Projects", 400, 800);
  const sprints = simpleRelationshipEntity("sprints", "Sprints", 0, 800, "Projects");
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 900, 0, "Projects");
  workTasks.height = 720;
  workTasks.fields.push({
    name: "SprintId",
    dataType: "int",
    isNullable: false,
    isPrimaryKey: false,
    isForeignKey: true,
    isImportant: false
  });
  workTasks.foreignKeys.push({
    name: "FK_WorkTasks_Sprints",
    columns: ["SprintId"],
    referencedSchema: "pmt",
    referencedTable: "Sprints",
    referencedColumns: ["SprintsId"],
    relationshipType: "one-to-many"
  });

  const result = autoFormatAnnotationEntitiesOrgTree([sprints, projects, workTasks], {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false,
    gridSize: 20
  });

  assert.equal(result.levelCount, 2);
  assert.equal(projects.y, sprints.y, "same-level direct parents should stay top-aligned");
  assert.equal(workTasks.x - (projects.x + projects.width), compactEntityGap);
  assert.equal(sprints.x - (workTasks.x + workTasks.width), compactEntityGap);
  const relationships = annotationEntityRelationshipsSvg([sprints, projects, workTasks], null, {
    allowOverlappingLines: false,
    interactive: true
  });
  assert.match(relationships, /data-pmt-relationship-source="pmt\.WorkTasks\.ProjectsId"/);
  assert.match(relationships, /data-pmt-relationship-source="pmt\.WorkTasks\.SprintId"/);
});

test("Auto Format - Compact keeps relationship trunks outside the protected entity margin", () => {
  const blogs = simpleRelationshipEntity("blogs", "Blogs", -1000, 900);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 900, 0, "Blogs");
  const attachments = simpleRelationshipEntity("attachments", "TaskAttachments", 2400, 1200, "WorkTasks");
  workTasks.height = 720;

  autoFormatAnnotationEntitiesOrgTree([blogs, workTasks, attachments], {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg([blogs, workTasks, attachments], null, {
    allowOverlappingLines: false,
    interactive: true
  });
  const protectedMargin = compactEntityMargin;
  const protectedBounds = {
    x: workTasks.x - protectedMargin,
    y: workTasks.y - protectedMargin,
    width: workTasks.width + (protectedMargin * 2),
    height: workTasks.height + (protectedMargin * 2)
  };
  const attachmentRelationshipPoints = orthogonalPathPoints(
    relationshipHitPathForSource(relationships, "pmt.TaskAttachments.WorkTasksId")
  );
  attachmentRelationshipPoints.slice(1).forEach((point, index) => {
    const previous = attachmentRelationshipPoints[index];
    const isHorizontal = previous.y === point.y;
    const segmentInsideHorizontalMargin = point.x > protectedBounds.x
      && point.x < protectedBounds.x + protectedBounds.width
      && previous.x > protectedBounds.x
      && previous.x < protectedBounds.x + protectedBounds.width;
    const segmentOverlapsVerticalMargin = Math.max(Math.min(previous.y, point.y), protectedBounds.y)
      < Math.min(Math.max(previous.y, point.y), protectedBounds.y + protectedBounds.height);
    assert.ok(
      isHorizontal || !segmentInsideHorizontalMargin || !segmentOverlapsVerticalMargin,
      "only short horizontal field connectors may enter the protected entity margin"
    );
  });
});

test("Auto Format - Compact keeps vertical trunks on the table margin instead of arrow-head spacing", () => {
  const projects = simpleRelationshipEntity("projects", "Projects", 0, 700);
  const blogs = simpleRelationshipEntity("blogs", "Blogs", 500, 700);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 900, 0, "Projects");
  const attachments = simpleRelationshipEntity("attachments", "TaskAttachments", 1400, 700, "WorkTasks");
  workTasks.height = 720;
  workTasks.fields.push({
    name: "BlogId",
    dataType: "int",
    isNullable: false,
    isPrimaryKey: false,
    isForeignKey: true,
    isImportant: false
  });
  workTasks.foreignKeys.push({
    name: "FK_WorkTasks_Blogs",
    columns: ["BlogId"],
    referencedSchema: "pmt",
    referencedTable: "Blogs",
    referencedColumns: ["BlogsId"],
    relationshipType: "one-to-many"
  });
  const entities = [projects, blogs, workTasks, attachments];

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg(entities, {
    strokeWidth: 3,
    arrowSize: 30
  }, {
    allowOverlappingLines: false,
    interactive: true
  });
  const projectRelationshipPoints = orthogonalPathPoints(
    relationshipHitPathForSource(relationships, "pmt.WorkTasks.ProjectsId")
  );
  const projectRightMarginX = projects.x + projects.width + compactEntityMargin;
  const verticalSegments = projectRelationshipPoints
    .slice(1)
    .map((point, index) => [projectRelationshipPoints[index], point])
    .filter(([first, second]) => first.x === second.x);

  assert.equal(workTasks.x - (projects.x + projects.width), compactEntityGap);
  assert.equal(attachments.x - (workTasks.x + workTasks.width), compactEntityGap);
  assert.equal(blogs.x - (attachments.x + attachments.width), compactEntityGap);
  assert.equal(verticalSegments.length, 1);
  assert.equal(verticalSegments[0][0].x, projectRightMarginX);
  assert.equal(Math.abs(projectRelationshipPoints[1].x - projectRelationshipPoints[0].x), compactEntityMargin);
  assert.equal(Math.abs(projectRelationshipPoints.at(-1).x - projectRelationshipPoints.at(-2).x), compactEntityMargin);
  assert.deepEqual(projectRelationshipPoints, [
    { x: workTasks.x, y: expectedEntityFieldAnchorY(workTasks, "ProjectsId") },
    { x: projectRightMarginX, y: expectedEntityFieldAnchorY(workTasks, "ProjectsId") },
    { x: projectRightMarginX, y: expectedEntityFieldAnchorY(projects, "ProjectsId") },
    { x: projects.x + projects.width, y: expectedEntityFieldAnchorY(projects, "ProjectsId") }
  ]);
});

test("Auto Format - Compact keeps same-corridor relationships on the same horizontal lane", () => {
  const parentA = simpleRelationshipEntity("parent-a", "ParentA", 700, 100);
  const childA = simpleRelationshipEntity("child-a", "ChildA", 0, 0, "ParentA");
  const parentB = simpleRelationshipEntity("parent-b", "ParentB", 1020, 60);
  const childB = simpleRelationshipEntity("child-b", "ChildB", 320, 20, "ParentB");
  const blocker = simpleRelationshipEntity("blocker", "Blocker", 450, -100);
  blocker.width = 220;
  blocker.height = 180;
  const entities = [parentA, childA, parentB, childB, blocker];
  entities.forEach(entity => { entity.anchorTable = true; });

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: parentA.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true,
    compactRouting: true
  });
  const firstLane = interiorHorizontalLaneYs(
    orthogonalPathPoints(relationshipHitPathForSource(relationships, "pmt.ChildA.ParentAId"))
  );
  const secondLane = interiorHorizontalLaneYs(
    orthogonalPathPoints(relationshipHitPathForSource(relationships, "pmt.ChildB.ParentBId"))
  );

  assert.ok(firstLane.length, "first relationship should have a long horizontal lane");
  assert.ok(secondLane.length, "second relationship should have a long horizontal lane");
  assert.equal(secondLane[0], firstLane[0], "same-corridor relationships should share the green horizontal lane");
});

test("Auto Format - Compact avoids tiny jogs in otherwise clean relationship lanes", () => {
  const parent = simpleRelationshipEntity("parent", "Parent", 700, 100);
  const child = simpleRelationshipEntity("child", "Child", 0, 0, "Parent");
  const blocker = simpleRelationshipEntity("blocker", "Blocker", 450, -100);
  blocker.width = 220;
  blocker.height = 180;
  const entities = [parent, child, blocker];
  entities.forEach(entity => { entity.anchorTable = true; });

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: parent.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true,
    compactRouting: true
  });
  const points = orthogonalPathPoints(relationshipHitPathForSource(relationships, "pmt.Child.ParentId"));
  const jogLengths = orthogonalJogLengths(points);

  assert.ok(jogLengths.length, "relationship should include a deliberate dogleg around the blocker");
  assert.ok(
    jogLengths.every(length => length >= compactEntityMargin),
    `relationship should avoid tiny red-line jogs: ${JSON.stringify(points)}`
  );
});

test("Auto Format - Compact routes lower children through a mid-corridor instead of an endpoint-level rectangle", () => {
  const users = simpleRelationshipEntity("users", "Users", 460, 0);
  const gameScores = simpleRelationshipEntity("game-scores", "GameScores", 0, 300, "Users");
  const holidays = simpleRelationshipEntity("holidays", "Holidays", 40, 550, "Users");
  const entities = [users, gameScores, holidays];
  entities.forEach(entity => { entity.anchorTable = true; });

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: users.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true,
    compactRouting: true
  });
  const holidayPoints = orthogonalPathPoints(relationshipHitPathForSource(relationships, "pmt.Holidays.UsersId"));
  const endpointYs = [
    expectedEntityFieldAnchorY(holidays, "UsersId"),
    expectedEntityFieldAnchorY(users, "UsersId")
  ];
  const interiorHorizontalSegments = holidayPoints.slice(1).flatMap((point, index) => {
    const previous = holidayPoints[index];
    if (Math.abs(previous.y - point.y) > 0.001) return [];
    if (index === 0 || index === holidayPoints.length - 2) return [];
    const length = Math.abs(point.x - previous.x);
    return length > compactEntityMargin ? [{ y: point.y, length }] : [];
  });

  assert.ok(interiorHorizontalSegments.length, "lower child relationship should use a shared mid-corridor branch");
  assert.ok(
    interiorHorizontalSegments.every(segment => endpointYs.every(y => Math.abs(segment.y - y) > 0.001)),
    `mid-corridor branch should not be a long red endpoint-level rectangle: ${JSON.stringify(holidayPoints)}`
  );
  assert.ok(
    interiorHorizontalSegments.some(segment => segment.y >= users.y + users.height + compactEntityMargin - 0.01),
    `mid-corridor branch should run below the upper Entity margin: ${JSON.stringify(holidayPoints)}`
  );
});

test("Auto Format - Compact avoids perimeter fan-out around a central Entity", () => {
  const projects = simpleRelationshipEntity("projects", "Projects", 0, 900);
  const workTasks = simpleRelationshipEntity("work-tasks", "WorkTasks", 450, 0, "Projects");
  const taskAssignees = simpleRelationshipEntity("task-assignees", "TaskAssignees", 900, 900, "WorkTasks");
  const blogs = simpleRelationshipEntity("blogs", "Blogs", 1400, 900);
  workTasks.height = 720;
  workTasks.fields.push({
    name: "LinkedBlogId",
    dataType: "int",
    isNullable: true,
    isPrimaryKey: false,
    isForeignKey: true,
    isImportant: false
  });
  workTasks.foreignKeys.push({
    name: "FK_WorkTasks_Blogs",
    columns: ["LinkedBlogId"],
    referencedSchema: "pmt",
    referencedTable: "Blogs",
    referencedColumns: ["BlogsId"],
    relationshipType: "one-to-many"
  });
  const entities = [projects, workTasks, taskAssignees, blogs];

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: workTasks.id,
    allowOverlappingLines: false,
    gridSize: 20
  });
  const relationships = annotationEntityRelationshipsSvg(entities, null, {
    allowOverlappingLines: false,
    interactive: true
  });
  [
    "pmt.WorkTasks.ProjectsId",
    "pmt.WorkTasks.LinkedBlogId",
    "pmt.TaskAssignees.WorkTasksId"
  ].forEach(source => {
    const points = orthogonalPathPoints(relationshipHitPathForSource(relationships, source));
    assert.ok(points.length >= 4, `${source} should render as an orthogonal field route`);
    assert.equal(points[0].y, points[1].y, `${source} should leave its source field horizontally`);
    assert.equal(points.at(-2).y, points.at(-1).y, `${source} should enter its target field horizontally`);
    assert.ok(
      Math.abs(points[1].x - points[0].x) <= compactEntityMargin,
      `${source} should not fan out from the source by more than one table margin`
    );
    assert.ok(
      Math.abs(points.at(-1).x - points.at(-2).x) <= compactEntityMargin,
      `${source} should not fan out from the target by more than one table margin`
    );
    assert.ok(
      Math.min(...points.map(point => point.y)) >= workTasks.y - compactEntityGap,
      `${source} should not escape above the central Entity into a perimeter loop`
    );
  });
});

test("Auto Format - Compact preserves Anchor tables and top-aligns their direct children", () => {
  const root = simpleRelationshipEntity("root", "Root", 940, 620);
  root.anchorTable = true;
  const childA = simpleRelationshipEntity("child-a", "ChildA", 20, 20, "Root");
  const childB = simpleRelationshipEntity("child-b", "ChildB", 1500, 1200, "Root");

  const result = autoFormatAnnotationEntitiesOrgTree([root, childA, childB], {
    preferredRootId: root.id,
    allowOverlappingLines: false
  });

  assert.equal(result.anchorCount, 1);
  assert.deepEqual({ x: root.x, y: root.y }, { x: 940, y: 620 });
  assert.equal(childA.y, childB.y);
  assert.equal(childA.y, root.y + root.height + compactEntityGap);
});

test("Org Tree uses a best-effort field route when both parent and child are Anchor tables", () => {
  const root = simpleRelationshipEntity("root", "Root", 940, 620);
  const child = simpleRelationshipEntity("child", "Child", 20, 20, "Root");
  root.anchorTable = true;
  child.anchorTable = true;

  const result = autoFormatAnnotationEntitiesOrgTree([root, child], {
    preferredRootId: root.id,
    allowOverlappingLines: false
  });

  assert.equal(result.anchorCount, 2);
  assert.equal(result.anchoredRelationshipCount, 1);
  assert.deepEqual(
    [{ x: root.x, y: root.y }, { x: child.x, y: child.y }],
    [{ x: 940, y: 620 }, { x: 20, y: 20 }]
  );
  const relationships = annotationEntityRelationshipsSvg(
    [root, child],
    { showSymbols: true },
    { allowOverlappingLines: false }
  );
  assert.match(relationships, /data-pmt-relationship-source="pmt\.Child\.RootId"/);
  assert.match(relationships, /data-pmt-relationship-target="pmt\.Root\.RootId"/);
  assert.deepEqual(relationshipArrowTip(relationships), [root.x, expectedEntityFieldAnchorY(root, "RootId")]);
});

test("Org Tree auto-format breaks dependency cycles deterministically", () => {
  const first = simpleRelationshipEntity("first", "First", 400, 400, "Second");
  const second = simpleRelationshipEntity("second", "Second", 40, 40, "First");
  const result = autoFormatAnnotationEntitiesOrgTree([first, second], {
    allowOverlappingLines: true
  });
  assert.equal(result.cycleBreakCount, 1);
  assert.equal(result.levelCount, 2);
  assert.notEqual(first.y, second.y);
  const positions = [{ x: first.x, y: first.y }, { x: second.x, y: second.y }];
  autoFormatAnnotationEntitiesOrgTree([first, second], { allowOverlappingLines: true });
  assert.deepEqual([{ x: first.x, y: first.y }, { x: second.x, y: second.y }], positions);
});

test("manual field flags, collapsed state, and FK cardinality survive editable SVG round trip", () => {
  const workTasksDefinition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const blogsDefinition = parseAnnotationEntityDefinition(blogsCreateTableSql);
  const workTasks = entityObject(workTasksDefinition, "work-tasks", 40, 80, {
    foreignKeysAtTop: true,
    showDataTypes: true,
    anchorTable: true
  });
  const blogs = entityObject(blogsDefinition, "blogs", 800, 80);
  workTasks.fields.find(field => field.name === "Title").isImportant = true;
  workTasks.fields.find(field => field.name === "Severity").isPrimaryKey = true;
  workTasks.fields.find(field => field.name === "LinkedBlogId").isForeignKey = true;
  workTasks.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    workTasks.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-many"
    }
  );
  setAnnotationEntityCollapsedState(workTasks, true);

  const svg = buildAnnotationSvg({
    width: 1500,
    height: 1100,
    objects: [workTasks, blogs]
  }, "");
  assert.match(svg, /data-pmt-relationship-type="one-to-many"/);
  assert.ok(svg.indexOf("image-annotation-entity-relationships") < svg.indexOf(">pmt.WorkTasks</text>"));

  const restored = parseAnnotationSvg(svg);
  const restoredWorkTasks = restored.objects.find(object => object.id === "work-tasks");
  assert.equal(restoredWorkTasks.collapsed, true);
  assert.equal(restoredWorkTasks.showDataTypes, true);
  assert.equal(restoredWorkTasks.foreignKeysAtTop, true);
  assert.equal(restoredWorkTasks.anchorTable, true);
  assert.equal(restoredWorkTasks.fields.length, 30);
  assert.equal(restoredWorkTasks.fields.find(field => field.name === "Title")?.isImportant, true);
  assert.equal(restoredWorkTasks.fields.find(field => field.name === "Severity")?.isPrimaryKey, true);
  assert.equal(restoredWorkTasks.fields.find(field => field.name === "LinkedBlogId")?.isForeignKey, true);
  assert.deepEqual(
    restoredWorkTasks.foreignKeys.find(foreignKey => foreignKey.columns.includes("LinkedBlogId")),
    {
      name: "",
      columns: ["LinkedBlogId"],
      referencedSchema: "pmt",
      referencedTable: "Blogs",
      referencedColumns: ["BlogId"],
      relationshipType: "one-to-many"
    }
  );
  assert.deepEqual(
    annotationEntityVisibleFields(restoredWorkTasks).map(field => field.name),
    [
      "TaskId",
      "Severity",
      "ProjectId",
      "SprintId",
      "ParentTaskId",
      "CreatedByUserId",
      "UpdatedByUserId",
      "LinkedBlogId",
      "Title"
    ]
  );
});

test("global Entity unanchor control sets every Entity together and persists through SVG", () => {
  const root = simpleRelationshipEntity("global-anchor-root", "Root", 40, 40);
  const child = simpleRelationshipEntity("global-anchor-child", "Child", 420, 240, "Root");
  root.anchorTable = true;
  child.anchorTable = false;
  const state = normalizeAnnotationState({
    width: 1000,
    height: 700,
    objects: [root, child]
  });

  const unanchored = setAnnotationEntitiesUnanchored(state, true);
  assert.deepEqual(unanchored, { entityCount: 2, changedCount: 1, anchorTable: false });
  assert.ok(state.objects.filter(object => object.type === "entity").every(entity => entity.anchorTable === false));
  const unanchoredRoundTrip = parseAnnotationSvg(buildAnnotationSvg(state, ""));
  assert.ok(unanchoredRoundTrip.objects.filter(object => object.type === "entity")
    .every(entity => entity.anchorTable === false));

  const anchored = setAnnotationEntitiesUnanchored(state, false);
  assert.deepEqual(anchored, { entityCount: 2, changedCount: 2, anchorTable: true });
  assert.ok(state.objects.filter(object => object.type === "entity").every(entity => entity.anchorTable === true));
  const anchoredRoundTrip = parseAnnotationSvg(buildAnnotationSvg(state, ""));
  assert.ok(anchoredRoundTrip.objects.filter(object => object.type === "entity")
    .every(entity => entity.anchorTable === true));
});

test("Objects tree shows lock icons for locked and anchored canvas objects", () => {
  const anchored = simpleRelationshipEntity("anchored-entity", "Anchored", 40, 40);
  anchored.anchorTable = true;
  const state = normalizeAnnotationState({
    width: 900,
    height: 600,
    objects: [
      anchored,
      {
        id: "locked-rectangle",
        type: "rectangle",
        name: "Locked rectangle",
        x: 400,
        y: 80,
        width: 140,
        height: 80,
        fill: "#ffffff",
        stroke: "#172b4d",
        strokeWidth: 2,
        opacity: 1,
        locked: true
      },
      {
        id: "plain-text",
        type: "textbox",
        name: "Plain text",
        x: 400,
        y: 220,
        width: 140,
        height: 80,
        fill: "#ffffff",
        stroke: "#172b4d",
        strokeWidth: 2,
        opacity: 1,
        text: "Plain",
        textColor: "#172b4d",
        fontFamily: "Arial",
        fontSize: 18
      }
    ]
  });

  const html = annotationObjectTreeHtml(buildAnnotationObjectTree(state), new Set());
  assert.match(html, /data-annotation-tree-id="anchored-entity"[^>]*data-annotation-tree-anchored="true"/);
  assert.match(html, /data-annotation-tree-id="locked-rectangle"[^>]*data-annotation-tree-locked="true"/);
  assert.equal((html.match(/data-annotation-tree-lock-status/g) || []).length, 2);
  assert.match(html, /title="Anchor table"/);
  assert.match(html, /title="Locked"/);
});

test("diagram canvas persists a white background without an Original Image object", () => {
  const state = normalizeAnnotationState({
    width: 1600,
    height: 900,
    objects: []
  });

  assert.equal(state.objects.some(object => object.type === "embedded-image"), false);
  assert.deepEqual(state.canvasBounds, { x: 0, y: 0, width: 1600, height: 900 });
  assert.deepEqual(annotationOutputBounds(state), { x: 0, y: 0, width: 1600, height: 900 });

  const svg = buildAnnotationSvg(state, "data:image/svg+xml;charset=utf-8,test");
  assert.match(svg, /class="image-annotation-canvas-background"/);
  assert.doesNotMatch(svg, /<image\b/);

  const restored = parseAnnotationSvg(svg);
  assert.equal(restored?.objects.some(object => object.type === "embedded-image"), false);
});

test("a new source-backed annotation seeds one ordinary embedded Original Image", () => {
  const state = normalizeAnnotationState(null, {
    width: 640,
    height: 360,
    seedImageSource: sampleImageDataUrl,
    originalReference: "/uploads/richtext/source.png"
  });

  assert.equal(state.objects.length, 1);
  assert.deepEqual(state.objects[0], {
    id: state.objects[0].id,
    type: "embedded-image",
    name: "Original Image",
    visible: true,
    locked: false,
    groupId: "",
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    source: sampleImageDataUrl,
    imageClip: { x: 0, y: 0, width: 640, height: 360 },
    cropVisible: true,
    cropPermanent: false,
    isOriginalImage: true
  });
  assert.equal(state.originalReference, "/uploads/richtext/source.png");
  assert.equal(buildAnnotationObjectTree(state)[0].fixed, undefined);
});

test("new annotation canvases default the grid and grid snapping to off", () => {
  const defaults = normalizeAnnotationState({ width: 1600, height: 900 });
  const enabled = normalizeAnnotationState({
    width: 1600,
    height: 900,
    gridVisible: true,
    snapToGrid: true
  });

  assert.equal(defaults.gridVisible, false);
  assert.equal(defaults.snapToGrid, false);
  assert.equal(enabled.gridVisible, true);
  assert.equal(enabled.snapToGrid, true);
});

test("arrow shaft stops at a proportioned head across line widths and head sizes", () => {
  const normal = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    strokeWidth: 4,
    arrowSize: 20
  });
  assert.deepEqual(normal.shaftEnd, { x: 80, y: 0 });
  assert.deepEqual(normal.headPoints, [
    { x: 100, y: 0 },
    { x: 80, y: 9.6 },
    { x: 80, y: -9.6 }
  ]);

  const thick = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    strokeWidth: 20,
    arrowSize: 10
  });
  assert.deepEqual(thick.shaftEnd, { x: 70, y: 0 });
  assert.deepEqual(thick.headPoints, [
    { x: 100, y: 0 },
    { x: 70, y: 15 },
    { x: 70, y: -15 }
  ]);

  const short = annotationArrowGeometry({
    x1: 0,
    y1: 0,
    x2: 20,
    y2: 0,
    strokeWidth: 4,
    arrowSize: 160
  });
  assert.deepEqual(short.shaftEnd, { x: 4, y: 0 });
  assert.equal(short.headPoints[1].x, 4);
  assert.equal(short.headPoints[2].x, 4);
});

test("arrow endpoint resizing rotates and changes length without scaling the arrow head", () => {
  const original = {
    id: "arrow-1",
    type: "arrow",
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    stroke: "#3f7f0d",
    strokeWidth: 6,
    arrowSize: 24
  };
  const originalGeometry = annotationArrowGeometry(original);
  const headDimensions = geometry => ({
    length: Math.hypot(
      geometry.headPoints[0].x - geometry.shaftEnd.x,
      geometry.headPoints[0].y - geometry.shaftEnd.y
    ),
    width: Math.hypot(
      geometry.headPoints[1].x - geometry.headPoints[2].x,
      geometry.headPoints[1].y - geometry.headPoints[2].y
    )
  });

  const movedBase = adjustAnnotationArrowEndpoint(original, "arrow-base", { x: 20, y: 80 });
  assert.deepEqual({ x: movedBase.x2, y: movedBase.y2 }, { x: 100, y: 0 });
  const movedBaseHead = headDimensions(annotationArrowGeometry(movedBase));
  const originalHead = headDimensions(originalGeometry);
  assert.ok(Math.abs(movedBaseHead.length - originalHead.length) < 0.000001);
  assert.ok(Math.abs(movedBaseHead.width - originalHead.width) < 0.000001);
  assert.equal(movedBase.arrowSize, original.arrowSize);
  assert.equal(movedBase.strokeWidth, original.strokeWidth);

  const movedTip = adjustAnnotationArrowEndpoint(original, "arrow-tip", { x: 140, y: 60 });
  assert.deepEqual({ x: movedTip.x1, y: movedTip.y1 }, { x: 0, y: 0 });
  const movedTipHead = headDimensions(annotationArrowGeometry(movedTip));
  assert.ok(Math.abs(movedTipHead.length - originalHead.length) < 0.000001);
  assert.ok(Math.abs(movedTipHead.width - originalHead.width) < 0.000001);

  const minimum = adjustAnnotationArrowEndpoint(original, "arrow-base", { x: 100, y: 0 });
  assert.ok(Math.hypot(minimum.x2 - minimum.x1, minimum.y2 - minimum.y1) >= 30);
  assert.deepEqual({ x: minimum.x2, y: minimum.y2 }, { x: 100, y: 0 });

  const fittedOversizedHead = fitAnnotationArrowToHead({ ...original, arrowSize: 160 });
  const fittedGeometry = annotationArrowGeometry(fittedOversizedHead);
  assert.equal(fittedOversizedHead.x1, -100);
  assert.equal(Math.hypot(
    fittedGeometry.headPoints[0].x - fittedGeometry.shaftEnd.x,
    fittedGeometry.headPoints[0].y - fittedGeometry.shaftEnd.y
  ), 160);
  const movedFittedBase = adjustAnnotationArrowEndpoint(
    fittedOversizedHead,
    "arrow-base",
    { x: -220, y: 0 }
  );
  const movedFittedGeometry = annotationArrowGeometry(movedFittedBase);
  assert.equal(Math.hypot(
    movedFittedGeometry.headPoints[0].x - movedFittedGeometry.shaftEnd.x,
    movedFittedGeometry.headPoints[0].y - movedFittedGeometry.shaftEnd.y
  ), 160);
});

test("group arrow width and head scale beyond direct editor limits and survive persistence", () => {
  const enlarged = scaleGroupedAnnotationArrowStyle({ strokeWidth: 40, arrowSize: 160 }, 2);
  assert.deepEqual(enlarged, { strokeWidth: 80, arrowSize: 320 });
  const reduced = scaleGroupedAnnotationArrowStyle({ strokeWidth: 1, arrowSize: 6 }, 0.5);
  assert.deepEqual(reduced, { strokeWidth: 0.5, arrowSize: 3 });
  const reducedAgain = scaleGroupedAnnotationArrowStyle(reduced, 0.5);
  assert.deepEqual(reducedAgain, { strokeWidth: 0.25, arrowSize: 1.5 });

  const state = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 100, height: 50, source: sampleImageDataUrl },
      {
        id: "arrow",
        type: "arrow",
        x1: -400,
        y1: 25,
        x2: 100,
        y2: 25,
        strokeWidth: enlarged.strokeWidth,
        arrowSize: enlarged.arrowSize,
        groupId: "group-1"
      }
    ]
  });
  const svg = buildAnnotationSvg(state);
  const restored = parseAnnotationSvg(svg).objects.find(object => object.type === "arrow");
  assert.equal(restored.strokeWidth, 80);
  assert.equal(restored.arrowSize, 320);
});

test("annotation SVG is self-contained, vector, editable, and escapes hostile text", () => {
  const state = normalizeAnnotationState({
    version: 1,
    width: 800,
    height: 450,
    originalReference: "/uploads/richtext/original.png",
    gridVisible: true,
    snapToGrid: true,
    gridSize: 20,
    objects: [
      {
        id: "image-1",
        type: "embedded-image",
        x: -120,
        y: -80,
        width: 1200,
        height: 700,
        source: sampleImageDataUrl,
        imageClip: { x: 0, y: 0, width: 800, height: 450 },
        isOriginalImage: true,
        locked: true
      },
      { id: "rect-1", type: "rectangle", x: 30, y: 40, width: 240, height: 120, fill: "none", stroke: "#ff0000", strokeWidth: 5 },
      { id: "arrow-1", type: "arrow", x1: 100, y1: 100, x2: 400, y2: 250, stroke: "#00b050", strokeWidth: 6, arrowSize: 28 },
      {
        id: "text-1",
        type: "textbox",
        x: 320,
        y: 40,
        width: 300,
        height: 160,
        fill: "#548235",
        stroke: "#375623",
        strokeWidth: 4,
        text: "Review <script>alert('x')</script> & keep the source",
        textColor: "#ffffff",
        fontFamily: "Arial",
        fontSize: 28,
        textAlign: "right",
        textVerticalAlign: "bottom",
        groupId: "group-1"
      }
    ]
  });
  const sourceImage = state.objects.find(object => object.id === "image-1");
  assert.deepEqual(sourceImage.imageClip, { x: 0, y: 0, width: 800, height: 450 });
  const svg = buildAnnotationSvg(state);

  assert.match(svg, /<image[^>]+data:image\/png;base64,AAECAwQ=/);
  assert.match(svg, /<rect/);
  assert.match(svg, /<line/);
  assert.match(svg, /<polygon/);
  assert.doesNotMatch(svg, /<line[^>]+x2="400"[^>]+y2="250"/);
  assert.match(svg, /<text/);
  assert.match(svg, /text-anchor="end"/);
  assert.doesNotMatch(svg, /<script>/i);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /data-pmt-image-annotation-state="true"/);
  assert.doesNotMatch(svg, /image-annotation-arrow-(?:head-)?hit/);

  const restored = parseAnnotationSvg(svg);
  assert.equal(restored.originalReference, "/uploads/richtext/original.png");
  assert.equal(restored.objects.length, 4);
  assert.equal(restored.objects.find(object => object.id === "text-1").text, "Review <script>alert('x')</script> & keep the source");
  assert.equal(restored.objects.find(object => object.id === "text-1").textAlign, "right");
  assert.equal(restored.objects.find(object => object.id === "text-1").textVerticalAlign, "bottom");
  const restoredImage = restored.objects.find(object => object.id === "image-1");
  assert.equal(restoredImage.locked, true);
  assert.equal(restoredImage.source, sampleImageDataUrl);
  assert.deepEqual(restoredImage.imageClip, sourceImage.imageClip);
});

test("rectangle and text outlines can be hidden without losing their saved colors", () => {
  const state = normalizeAnnotationState({
    width: 120,
    height: 80,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 120, height: 80, source: sampleImageDataUrl },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 30, height: 20, fill: "#ffffff", stroke: "#123456", strokeWidth: 4, outlineVisible: false },
      { id: "text", type: "textbox", x: 50, y: 10, width: 50, height: 40, fill: "#ffffff", stroke: "#654321", strokeWidth: 3, outlineVisible: false, text: "No outline" }
    ]
  });
  const svg = buildAnnotationSvg(state);

  assert.match(svg, /<rect x="10" y="10" width="30" height="20"[^>]+stroke="none"/);
  assert.match(svg, /<rect x="50" y="10" width="50" height="40"[^>]+stroke="none"/);

  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(
    restored.objects.filter(object => ["rectangle", "textbox"].includes(object.type)).map(object => ({
      outlineVisible: object.outlineVisible,
      stroke: object.stroke
    })),
    [
      { outlineVisible: false, stroke: "#123456" },
      { outlineVisible: false, stroke: "#654321" }
    ]
  );
  assert.equal(normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [{ id: "default-rectangle", type: "rectangle", x: 0, y: 0, width: 10, height: 10 }]
  }).objects.find(object => object.type === "rectangle").outlineVisible, true);
});

test("circle and plain line objects render, select, copy, and survive SVG persistence", () => {
  const state = normalizeAnnotationState({
    width: 320,
    height: 180,
    objects: [
      {
        id: "circle",
        type: "circle",
        x: 20,
        y: 30,
        width: 100,
        height: 80,
        fill: "#dff0d8",
        stroke: "#2f6b2f",
        strokeWidth: 4,
        opacity: 0.7
      },
      {
        id: "line",
        type: "line",
        x1: 150,
        y1: 40,
        x2: 280,
        y2: 130,
        stroke: "#315c8a",
        strokeWidth: 6,
        opacity: 0.8
      }
    ]
  });

  const svg = buildAnnotationSvg(state, "");
  assert.match(svg, /<ellipse[^>]+cx="70"[^>]+cy="70"[^>]+rx="50"[^>]+ry="40"/);
  assert.match(svg, /class="image-annotation-line"[^>]+x1="150"[^>]+y1="40"[^>]+x2="280"[^>]+y2="130"/);
  assert.doesNotMatch(svg, /image-annotation-arrow-head|<polygon/);

  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(restored.objects.map(object => object.type), ["circle", "line"]);
  assert.deepEqual(
    restored.objects.map(object => object.opacity),
    [0.7, 0.8]
  );

  const lineSelection = buildAnnotationSelectionSvg(state, new Set(["line"]));
  assert.match(lineSelection, /<line x1="150" y1="40" x2="280" y2="130" stroke="#315c8a"/);
  assert.doesNotMatch(lineSelection, /image-annotation-arrow-head|<polygon/);
  assert.deepEqual(
    annotationObjectsIntersectingRect(state.objects, { x: 140, y: 30, width: 150, height: 110 })
      .map(object => object.id),
    ["line"]
  );
});

test("vector opacity persists through SVG, templates, and copied native instances without affecting images", () => {
  const state = normalizeAnnotationState({
    width: 160,
    height: 90,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 160, height: 90, source: sampleImageDataUrl, opacity: 0.2 },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 40, height: 25, opacity: 0.35 },
      { id: "arrow", type: "arrow", x1: 20, y1: 70, x2: 90, y2: 30, opacity: 0.65 },
      { id: "text", type: "textbox", x: 80, y: 10, width: 70, height: 40, text: "Faded", opacity: 0 }
    ]
  });
  assert.equal(Object.hasOwn(state.objects[0], "opacity"), false);
  assert.deepEqual(state.objects.slice(1).map(object => object.opacity), [0.35, 0.65, 0]);

  const svg = buildAnnotationSvg(state);
  assert.doesNotMatch(svg, /<image\b[^>]*\bopacity=/);
  assert.match(svg, /<rect\b[^>]*\bx="10"[^>]*\bopacity="0\.35"/);
  assert.match(svg, /<g\b[^>]*\bopacity="0\.65"[^>]*>[^]*image-annotation-arrow-shaft/);
  assert.match(svg, /<g\b[^>]*\bopacity="0"[^>]*>[^]*<text\b/);
  const restored = parseAnnotationSvg(svg);
  assert.deepEqual(restored.objects.slice(1).map(object => object.opacity), [0.35, 0.65, 0]);

  const vectorIds = new Set(["rectangle", "arrow", "text"]);
  const template = captureAnnotationTemplate(state, vectorIds, "", "Opacity");
  assert.deepEqual(template.objects.map(object => object.opacity), [0.35, 0.65, 0]);
  let sequence = 0;
  const instances = instantiateAnnotationTemplate(
    template,
    { x: 200, y: 100 },
    type => `${type}-opacity-${++sequence}`,
    "opacity-group"
  );
  assert.deepEqual(instances.map(object => object.opacity), [0.35, 0.65, 0]);

  const copiedSvg = buildAnnotationSelectionSvg(state, vectorIds);
  assert.match(copiedSvg, /opacity="0\.35"/);
  assert.match(copiedSvg, /opacity="0\.65"/);
  assert.match(copiedSvg, /opacity="0"/);
  assert.doesNotMatch(copiedSvg, /<image\b/);
});

test("copied annotation SVG contains only the selected artwork at tight painted bounds", () => {
  const state = normalizeAnnotationState({
    width: 120,
    height: 80,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 120, height: 80, source: sampleImageDataUrl },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 30, height: 20, fill: "#ffffff", stroke: "#123456", strokeWidth: 4 }
    ]
  });
  const svg = buildAnnotationSelectionSvg(state, new Set(["rectangle"]));

  assert.match(svg, /^<svg[^>]+width="34" height="24" viewBox="8 8 34 24"/);
  assert.match(svg, /<rect x="10" y="10" width="30" height="20"/);
  assert.doesNotMatch(svg, /<image\b/);
  assert.doesNotMatch(svg, /\b(?:class|role|tabindex|aria-[\w-]+|data-(?:annotation|pmt)-[\w-]+|pointer-events)=|<title>/);
});

test("copied annotation SVG keeps logical groups as plain SVG groups without editor metadata", () => {
  const state = normalizeAnnotationState({
    width: 320,
    height: 180,
    objects: [
      { id: "group-rectangle", type: "rectangle", groupId: "diagram-group", x: 10, y: 10, width: 80, height: 50 },
      { id: "outside-circle", type: "circle", x: 220, y: 40, width: 60, height: 60 },
      { id: "group-text", type: "textbox", groupId: "diagram-group", x: 20, y: 20, width: 60, height: 30, text: "Grouped" }
    ]
  });
  const svg = buildAnnotationSelectionSvg(
    state,
    new Set(["group-rectangle", "group-text", "outside-circle"])
  );

  assert.match(svg, /^<svg[^>]*><ellipse[^]*<g><rect[^]*>Gr<\/tspan>[^]*<\/g><\/svg>$/);
  assert.doesNotMatch(svg, /diagram-group|data-pmt-|data-annotation-|\bclass=|<metadata/);
});

test("copied Entity SVG omits editor header controls", () => {
  const entity = entityObject(parseAnnotationEntityDefinition(blogsCreateTableSql), "blogs", 40, 80);
  const svg = buildAnnotationSelectionSvg(
    normalizeAnnotationState({ width: 900, height: 700, objects: [entity] }),
    new Set([entity.id])
  );

  assert.match(svg, />pmt\.Blogs<\/text>/);
  assert.doesNotMatch(svg, /Expand Entity|Collapse Entity|Show data types|Hide data types|&#859[34];/);
});

test("portable copied selections inline URL-backed images with their crop and vector annotations", async () => {
  const uploadedSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120">',
    '<rect width="240" height="120" fill="#1677c8"/>',
    '<text x="12" y="32">Uploaded Diagram Image</text>',
    '</svg>'
  ].join("");
  const requests = [];
  const state = normalizeAnnotationState({
    width: 500,
    height: 300,
    objects: [
      {
        id: "uploaded-image",
        type: "embedded-image",
        name: "diagram-background.svg",
        x: -10,
        y: 20,
        width: 240,
        height: 120,
        source: "/uploads/richtext/diagram-background.svg",
        imageClip: { x: 20, y: 35, width: 150, height: 70 },
        cropVisible: true
      },
      {
        id: "hidden-image",
        type: "embedded-image",
        name: "hidden.png",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        source: "/uploads/richtext/hidden.png",
        visible: false
      },
      {
        id: "red-arrow",
        type: "arrow",
        x1: 30,
        y1: 45,
        x2: 150,
        y2: 90,
        stroke: "#ff0000",
        strokeWidth: 6,
        arrowSize: 24
      }
    ]
  });

  const copiedSvg = await buildPortableAnnotationSelectionSvg(
    state,
    new Set(["uploaded-image", "hidden-image", "red-arrow"]),
    {
      fetch: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          blob: async () => new Blob([uploadedSvg], { type: "image/svg+xml" })
        };
      }
    }
  );

  assert.deepEqual(requests, [{
    url: "/uploads/richtext/diagram-background.svg",
    options: { cache: "no-store", credentials: "same-origin" }
  }]);
  assert.doesNotMatch(copiedSvg, /\/uploads\/richtext\//);
  assert.doesNotMatch(copiedSvg, /hidden\.png/);
  assert.match(copiedSvg, /<image\b[^>]*\bx="-10"[^>]*\by="20"[^>]*\bwidth="240"[^>]*\bheight="120"/);
  assert.match(copiedSvg, /<clipPath\b[^>]*><rect x="20" y="35" width="150" height="70"><\/rect><\/clipPath>/);
  assert.match(copiedSvg, /<line x1="30" y1="45"[^>]*stroke="#ff0000"/);
  const inlineSource = copiedSvg.match(/<image\b[^>]*\bhref="([^"]+)"/)?.[1] || "";
  assert.match(inlineSource, /^data:image\/svg\+xml;base64,/);
  assert.equal(Buffer.from(inlineSource.split(",")[1], "base64").toString("utf8"), uploadedSvg);
});

test("portable copied selections fail instead of silently omitting an unavailable selected image", async () => {
  const state = normalizeAnnotationState({
    width: 120,
    height: 80,
    objects: [{
      id: "missing-image",
      type: "embedded-image",
      name: "missing.png",
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      source: "/uploads/richtext/missing.png"
    }]
  });

  await assert.rejects(
    buildPortableAnnotationSelectionSvg(state, new Set(["missing-image"]), {
      fetch: async () => ({ ok: false })
    }),
    /selected image "missing\.png" could not be loaded for copying/
  );
});

test("template capture preserves cropped source bytes and native vectors while instances get fresh identity", () => {
  const originalDataUrl = "data:image/png;base64,AAECAwQFBgcICQ==";
  const state = normalizeAnnotationState({
    width: 80,
    height: 50,
    objects: [
      {
        id: "source-image",
        type: "embedded-image",
        x: -20,
        y: -10,
        width: 120,
        height: 80,
        source: originalDataUrl,
        imageClip: { x: 0, y: 0, width: 80, height: 50 },
        isOriginalImage: true,
        locked: true,
        groupId: "source-group"
      },
      {
        id: "source-rectangle",
        type: "rectangle",
        x: 10,
        y: 8,
        width: 30,
        height: 20,
        fill: "#ffee00",
        stroke: "#123456",
        strokeWidth: 4,
        groupId: "source-group"
      },
      {
        id: "source-arrow",
        type: "arrow",
        x1: 5,
        y1: 45,
        x2: 65,
        y2: 20,
        stroke: "#654321",
        strokeWidth: 6,
        arrowSize: 18,
        groupId: "source-group"
      }
    ]
  });
  const selectedIds = new Set(state.objects.map(object => object.id));
  const template = captureAnnotationTemplate(state, selectedIds, "", "Mixed cropped source");

  assert.ok(template);
  assert.equal(template.name, "Mixed cropped source");
  assert.deepEqual(template.objects.map(object => object.type), ["embedded-image", "rectangle", "arrow"]);
  assert.ok(template.objects.every(object => object.locked === false));
  assert.ok(template.objects.every(object => object.groupId === ""));
  const embedded = template.objects.find(object => object.type === "embedded-image");
  const rectangle = template.objects.find(object => object.type === "rectangle");
  const arrow = template.objects.find(object => object.type === "arrow");
  assert.equal(embedded.source, originalDataUrl);
  assert.deepEqual(embedded.imageClip, { x: 0, y: 0, width: 80, height: 50 });
  assert.deepEqual(
    {
      type: rectangle.type,
      fill: rectangle.fill,
      stroke: rectangle.stroke,
      strokeWidth: rectangle.strokeWidth
    },
    { type: "rectangle", fill: "#ffee00", stroke: "#123456", strokeWidth: 4 }
  );
  assert.deepEqual(
    {
      type: arrow.type,
      stroke: arrow.stroke,
      strokeWidth: arrow.strokeWidth,
      arrowSize: arrow.arrowSize
    },
    { type: "arrow", stroke: "#654321", strokeWidth: 6, arrowSize: 18 }
  );

  let sequence = 0;
  const idFactory = type => `${type}-instance-${++sequence}`;
  const firstInstance = instantiateAnnotationTemplate(template, { x: 200, y: 120 }, idFactory, "instance-group-1");
  const secondInstance = instantiateAnnotationTemplate(template, { x: 400, y: 240 }, idFactory, "instance-group-2");
  const templateIds = new Set(template.objects.map(object => object.id));
  const firstIds = new Set(firstInstance.map(object => object.id));
  const secondIds = new Set(secondInstance.map(object => object.id));
  assert.equal(firstInstance.length, 3);
  assert.ok(firstInstance.every(object => !templateIds.has(object.id)));
  assert.ok(secondInstance.every(object => !templateIds.has(object.id) && !firstIds.has(object.id)));
  assert.deepEqual([...new Set(firstInstance.map(object => object.groupId))], ["instance-group-1"]);
  assert.deepEqual([...new Set(secondInstance.map(object => object.groupId))], ["instance-group-2"]);
  assert.ok(firstInstance.every(object => object.locked === false));
  assert.equal(firstInstance.find(object => object.type === "embedded-image").source, embedded.source);
  assert.equal(firstIds.size, firstInstance.length);
  assert.equal(secondIds.size, secondInstance.length);
  const firstBounds = annotationSelectionBounds(firstInstance);
  assert.ok(Math.abs(firstBounds.x + (firstBounds.width / 2) - 200) < 0.000001);
  assert.ok(Math.abs(firstBounds.y + (firstBounds.height / 2) - 120) < 0.000001);

  const persistedState = normalizeAnnotationState({
    width: 500,
    height: 300,
    objects: [
      { id: "document-image", type: "embedded-image", x: 0, y: 0, width: 500, height: 300, source: sampleImageDataUrl },
      ...firstInstance
    ]
  });
  const persistedSvg = buildAnnotationSvg(persistedState);
  assert.match(persistedSvg, /<image\b[^>]+data:image\/png;base64,/);
  assert.match(persistedSvg, /<rect\b/);
  assert.match(persistedSvg, /<line\b/);
  assert.match(persistedSvg, /<polygon\b/);
  const restoredEmbedded = parseAnnotationSvg(persistedSvg).objects
    .find(object => object.id === firstInstance.find(item => item.type === "embedded-image").id);
  assert.ok(restoredEmbedded);
  assert.equal(restoredEmbedded.source, embedded.source);
});

test("individual template files download and upload without losing Entity metadata", () => {
  const state = normalizeAnnotationState({
    width: 1200,
    height: 1000,
    objects: [entityObject(
      parseAnnotationEntityDefinition(workTasksCreateTableSql),
      "download-entity",
      40,
      80,
      { showDataTypes: true, foreignKeysAtTop: true }
    )]
  });
  const template = captureAnnotationTemplate(
    state,
    new Set(["download-entity"]),
    "",
    "pmt.WorkTasks"
  );
  const file = annotationTemplateDownloadFile(template);

  assert.equal(file.fileName, "pmt.WorkTasks.pmt-template.json");
  const uploaded = parseAnnotationTemplateUpload(file.contents);
  assert.deepEqual(uploaded, template);
  assert.equal(uploaded.objects[0].entityName, "WorkTasks");
  assert.equal(uploaded.objects[0].fields.length, 30);
  assert.equal(uploaded.objects[0].foreignKeys.length, 6);
  assert.deepEqual(parseAnnotationTemplateUpload(JSON.stringify(template)), template);
  assert.throws(
    () => parseAnnotationTemplateUpload(JSON.stringify({
      format: "pmt-image-annotation-template",
      version: 999,
      template
    })),
    /version is not supported/
  );
  assert.throws(() => parseAnnotationTemplateUpload("not json"), /valid PMT template JSON/);
});

test("template library normalizes drawing defaults and preserves explicit reset data", () => {
  const library = normalizeAnnotationTemplateLibrary({
    version: 99,
    templates: [
      {
        id: "valid-template",
        name: "  Rectangle preset  ",
        width: 40,
        height: 20,
        createdAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
        objects: [
          {
            id: "template-rectangle",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 40,
            height: 20,
            fill: "#abcdef",
            stroke: "#123456",
            strokeWidth: 7,
            locked: true,
            groupId: "old-group"
          }
        ]
      },
      { id: "invalid-template", name: "No artwork", objects: [] }
    ],
    defaults: {
      arrow: { stroke: "#ABCDEF", strokeWidth: 999, arrowSize: 1 },
      rectangle: { fill: "#FEDCBA", stroke: "invalid", outlineVisible: false, strokeWidth: 999 }
    }
  });

  assert.equal(library.version, 1);
  assert.equal(library.templates.length, 1);
  assert.equal(library.templates[0].name, "Rectangle preset");
  assert.equal(library.templates[0].objects[0].locked, false);
  assert.equal(library.templates[0].objects[0].groupId, "");
  assert.deepEqual(library.defaults, {
    arrow: { stroke: "#abcdef", strokeWidth: 40, arrowSize: 6, opacity: 1 },
    rectangle: { fill: "#fedcba", stroke: "#3f7f0d", outlineVisible: false, strokeWidth: 40, opacity: 1 }
  });

  const reset = normalizeAnnotationTemplateLibrary({
    ...library,
    defaults: { arrow: null, rectangle: null }
  });
  assert.equal(reset.templates.length, 1);
  assert.deepEqual(reset.defaults, { arrow: null, rectangle: null });
  assert.deepEqual(normalizeAnnotationTemplateLibrary(null), {
    version: 1,
    templates: [],
    defaults: { arrow: null, rectangle: null }
  });
});

test("restoring defaults prepends only missing template designs and preserves personal data", () => {
  const template = (id, name, stroke = "#4ea72e", updatedAt = "2026-07-18T00:00:00.000Z") => ({
    id,
    name,
    width: 40,
    height: 20,
    createdAt: updatedAt,
    updatedAt,
    objects: [
      { id: `${id}-object`, type: "rectangle", x: 0, y: 0, width: 40, height: 20, fill: "none", stroke }
    ]
  });
  const personalDuplicate = template("personal-green", "Green Box", "#4ea72e", "2026-07-19T00:00:00.000Z");
  const personal = template("personal-note", "Personal Note", "#126bff");
  const library = {
    version: 1,
    templates: [personalDuplicate, personal],
    defaults: { arrow: { stroke: "#126bff", strokeWidth: 8, arrowSize: 24, opacity: 0.8 }, rectangle: null }
  };
  const defaults = {
    version: 1,
    templates: [
      template("default-green", "Green Box"),
      template("default-red", "Red Box", "#ff0000")
    ],
    defaults: { arrow: null, rectangle: null }
  };

  const restored = restoreAnnotationDefaultTemplates(library, defaults);
  assert.equal(restored.addedCount, 1);
  assert.equal(restored.capacityExceeded, false);
  assert.deepEqual(restored.library.templates.map(item => item.id), [
    "default-red",
    "personal-green",
    "personal-note"
  ]);
  assert.deepEqual(restored.library.defaults, normalizeAnnotationTemplateLibrary(library).defaults);
});

test("restoring a customized default keeps both versions with unique IDs and is idempotent", () => {
  const base = {
    id: "default-arrow",
    name: "Green Arrow",
    width: 100,
    height: 60,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    objects: [
      { id: "arrow", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 60, stroke: "#4ea72e", strokeWidth: 12, arrowSize: 48 }
    ]
  };
  const customized = structuredClone(base);
  customized.objects[0].stroke = "#126bff";

  const first = restoreAnnotationDefaultTemplates(
    { version: 1, templates: [customized], defaults: { arrow: null, rectangle: null } },
    { version: 1, templates: [base], defaults: { arrow: null, rectangle: null } }
  );
  assert.equal(first.addedCount, 1);
  assert.deepEqual(first.library.templates.map(item => item.id), ["default-arrow-default", "default-arrow"]);
  assert.equal(first.library.templates[1].objects[0].stroke, "#126bff");

  const second = restoreAnnotationDefaultTemplates(
    first.library,
    { version: 1, templates: [base], defaults: { arrow: null, rectangle: null } }
  );
  assert.equal(second.addedCount, 0);
  assert.deepEqual(second.library, first.library);
});

test("restoring defaults ignores duplicate designs inside the shared catalog", () => {
  const first = {
    id: "default-green",
    name: "Green Box",
    width: 40,
    height: 20,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    objects: [
      { id: "green-object", type: "rectangle", x: 0, y: 0, width: 40, height: 20, fill: "none", stroke: "#4ea72e" }
    ]
  };
  const duplicate = structuredClone(first);
  duplicate.id = "default-green-copy";
  duplicate.createdAt = "2026-07-19T00:00:00.000Z";
  duplicate.updatedAt = "2026-07-19T00:00:00.000Z";
  duplicate.objects[0].id = "green-object-copy";

  const restored = restoreAnnotationDefaultTemplates(
    { version: 1, templates: [], defaults: { arrow: null, rectangle: null } },
    { version: 1, templates: [first, duplicate], defaults: { arrow: null, rectangle: null } }
  );

  assert.equal(restored.addedCount, 1);
  assert.deepEqual(restored.library.templates.map(template => template.id), ["default-green"]);
});

test("restoring defaults refuses atomically when personal templates need more than 50 slots", () => {
  const rectangle = (id, name, stroke) => ({
    id,
    name,
    width: 20,
    height: 20,
    objects: [{ id: `${id}-object`, type: "rectangle", x: 0, y: 0, width: 20, height: 20, fill: "none", stroke }]
  });
  const personalTemplates = Array.from({ length: 49 }, (_, index) => rectangle(
    `personal-${index}`,
    `Personal ${index}`,
    `#${index.toString(16).padStart(6, "0")}`
  ));
  const library = normalizeAnnotationTemplateLibrary({
    version: 1,
    templates: personalTemplates,
    defaults: { arrow: null, rectangle: null }
  });
  const restored = restoreAnnotationDefaultTemplates(library, {
    version: 1,
    templates: [rectangle("default-a", "Default A", "#ff0000"), rectangle("default-b", "Default B", "#00ff00")],
    defaults: { arrow: null, rectangle: null }
  });

  assert.equal(restored.capacityExceeded, true);
  assert.equal(restored.requiredSlots, 1);
  assert.equal(restored.addedCount, 0);
  assert.deepEqual(restored.library, library);
});

test("template formatting applies exact structures one-to-one without changing content or geometry", () => {
  const template = {
    id: "format-template",
    name: "Formatted callout",
    width: 320,
    height: 180,
    objects: [
      {
        id: "template-rectangle",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 70,
        fill: "#112233",
        stroke: "#445566",
        outlineVisible: false,
        strokeWidth: 7,
        opacity: 0.4
      },
      {
        id: "template-arrow",
        type: "arrow",
        x1: 10,
        y1: 90,
        x2: 250,
        y2: 90,
        stroke: "#778899",
        strokeWidth: 9,
        arrowSize: 36,
        opacity: 0.55
      },
      {
        id: "template-text",
        type: "textbox",
        x: 20,
        y: 110,
        width: 220,
        height: 60,
        text: "Template text must not replace destination text",
        fill: "#aabbcc",
        stroke: "#ddeeff",
        outlineVisible: true,
        strokeWidth: 5,
        opacity: 0.65,
        textColor: "#102030",
        fontFamily: "Georgia",
        fontSize: 42,
        textAlign: "center",
        textVerticalAlign: "bottom"
      }
    ]
  };
  const destination = [
    {
      id: "destination-rectangle",
      type: "rectangle",
      name: "Destination rectangle",
      groupId: "destination-group",
      locked: false,
      x: 410,
      y: 220,
      width: 75,
      height: 45,
      fill: "none",
      stroke: "#000000",
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1
    },
    {
      id: "destination-arrow",
      type: "arrow",
      name: "Destination arrow",
      groupId: "destination-group",
      locked: false,
      x1: 500,
      y1: 310,
      x2: 710,
      y2: 365,
      stroke: "#000000",
      strokeWidth: 2,
      arrowSize: 10,
      opacity: 1
    },
    {
      id: "destination-text",
      type: "textbox",
      name: "Destination text",
      groupId: "destination-group",
      locked: false,
      x: 530,
      y: 390,
      width: 260,
      height: 90,
      text: "Keep this destination text",
      fill: "none",
      stroke: "#000000",
      outlineVisible: false,
      strokeWidth: 2,
      opacity: 1,
      textColor: "#ffffff",
      fontFamily: "Arial",
      fontSize: 18,
      textAlign: "left",
      textVerticalAlign: "top"
    }
  ];
  const templateBefore = structuredClone(template);
  const destinationIdentityAndGeometry = destination.map(object => object.type === "arrow"
    ? {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2
      }
    : {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        ...(object.type === "textbox" ? { text: object.text } : {})
      });

  const result = applyAnnotationTemplateFormatting(template, destination);

  assert.deepEqual(result, {
    structureMatches: true,
    selectedCount: 3,
    matchedCount: 3,
    appliedCount: 3,
    changedCount: 3,
    lockedCount: 0,
    geometryConstrainedCount: 0
  });
  assert.deepEqual(destination.map(object => object.type === "arrow"
    ? {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2
      }
    : {
        id: object.id,
        name: object.name,
        groupId: object.groupId,
        locked: object.locked,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        ...(object.type === "textbox" ? { text: object.text } : {})
      }), destinationIdentityAndGeometry);
  assert.deepEqual(destination[0], {
    ...destination[0],
    fill: "#112233",
    stroke: "#445566",
    outlineVisible: false,
    strokeWidth: 7,
    opacity: 0.4
  });
  assert.deepEqual(
    (({ stroke, strokeWidth, arrowSize, opacity }) => ({ stroke, strokeWidth, arrowSize, opacity }))(destination[1]),
    { stroke: "#778899", strokeWidth: 9, arrowSize: 36, opacity: 0.55 }
  );
  assert.deepEqual(
    (({
      fill,
      stroke,
      outlineVisible,
      strokeWidth,
      opacity,
      textColor,
      fontFamily,
      fontSize,
      textAlign,
      textVerticalAlign
    }) => ({
      fill,
      stroke,
      outlineVisible,
      strokeWidth,
      opacity,
      textColor,
      fontFamily,
      fontSize,
      textAlign,
      textVerticalAlign
    }))(destination[2]),
    {
      fill: "#aabbcc",
      stroke: "#ddeeff",
      outlineVisible: true,
      strokeWidth: 5,
      opacity: 0.65,
      textColor: "#102030",
      fontFamily: "Georgia",
      fontSize: 42,
      textAlign: "center",
      textVerticalAlign: "bottom"
    }
  );
  assert.deepEqual(template, templateBefore);
});

test("Entity template formatting preserves schema, content, and every destination geometry value", () => {
  const workTasksDefinition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const blogsDefinition = parseAnnotationEntityDefinition(blogsCreateTableSql);
  const destination = entityObject(workTasksDefinition, "destination-work-tasks", 430, 260, {
    width: 640,
    height: 980,
    fill: "#ffffff",
    stroke: "#111111",
    strokeWidth: 2,
    opacity: 1,
    textColor: "#222222",
    fontFamily: "Arial",
    fontSize: 18,
    showKeyColumn: true,
    showDataTypes: false,
    foreignKeysAtTop: false
  });
  destination.fields.find(field => field.name === "Title").isImportant = true;
  destination.fields.find(field => field.name === "Severity").isPrimaryKey = true;
  destination.foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    destination.foreignKeys,
    "LinkedBlogId",
    {
      referencedEntity: "pmt.Blogs",
      referencedField: "BlogId",
      relationshipType: "one-to-many"
    }
  );
  setAnnotationEntityCollapsedState(destination, true);
  const invariants = {
    id: destination.id,
    x: destination.x,
    y: destination.y,
    width: destination.width,
    height: destination.height,
    expandedHeight: destination.expandedHeight,
    collapsed: destination.collapsed,
    entitySchema: destination.entitySchema,
    entityName: destination.entityName,
    sourceText: destination.sourceText,
    fields: structuredClone(destination.fields),
    foreignKeys: structuredClone(destination.foreignKeys)
  };
  const templateEntity = entityObject(blogsDefinition, "template-blogs", 0, 0, {
    fill: "#f2f7ff",
    stroke: "#0b57d0",
    outlineVisible: false,
    strokeWidth: 6,
    opacity: 0.65,
    textColor: "#102030",
    fontFamily: "Georgia",
    fontSize: 24,
    showKeyColumn: false,
    showDataTypes: true,
    foreignKeysAtTop: true,
    collapsed: false
  });

  const result = applyAnnotationTemplateFormatting({
    id: "entity-style-template",
    name: "Entity style",
    width: 520,
    height: 900,
    objects: [templateEntity]
  }, [destination]);

  assert.deepEqual(result, {
    structureMatches: true,
    selectedCount: 1,
    matchedCount: 1,
    appliedCount: 1,
    changedCount: 1,
    lockedCount: 0,
    geometryConstrainedCount: 0
  });
  assert.deepEqual(
    {
      fill: destination.fill,
      stroke: destination.stroke,
      outlineVisible: destination.outlineVisible,
      strokeWidth: destination.strokeWidth,
      opacity: destination.opacity,
      textColor: destination.textColor,
      fontFamily: destination.fontFamily,
      fontSize: destination.fontSize,
      showKeyColumn: destination.showKeyColumn,
      showDataTypes: destination.showDataTypes,
      foreignKeysAtTop: destination.foreignKeysAtTop
    },
    {
      fill: "#f2f7ff",
      stroke: "#0b57d0",
      outlineVisible: false,
      strokeWidth: 6,
      opacity: 0.65,
      textColor: "#102030",
      fontFamily: "Georgia",
      fontSize: 24,
      showKeyColumn: false,
      showDataTypes: true,
      foreignKeysAtTop: true
    }
  );
  assert.deepEqual(
    {
      id: destination.id,
      x: destination.x,
      y: destination.y,
      width: destination.width,
      height: destination.height,
      expandedHeight: destination.expandedHeight,
      collapsed: destination.collapsed,
      entitySchema: destination.entitySchema,
      entityName: destination.entityName,
      sourceText: destination.sourceText,
      fields: destination.fields,
      foreignKeys: destination.foreignKeys
    },
    {
      id: invariants.id,
      x: invariants.x,
      y: invariants.y,
      width: invariants.width,
      height: invariants.height,
      expandedHeight: invariants.expandedHeight,
      collapsed: invariants.collapsed,
      entitySchema: invariants.entitySchema,
      entityName: invariants.entityName,
      sourceText: invariants.sourceText,
      fields: invariants.fields,
      foreignKeys: invariants.foreignKeys
    }
  );
});

test("mismatched template formatting pairs by type, reuses the last available style, and skips locks", () => {
  const template = {
    id: "mixed-format-template",
    name: "Mixed formatting",
    width: 300,
    height: 180,
    objects: [
      { id: "source-arrow-1", type: "arrow", x1: 0, y1: 0, x2: 160, y2: 0, stroke: "#ff0000", strokeWidth: 4, arrowSize: 20, opacity: 0.7 },
      { id: "source-arrow-2", type: "arrow", x1: 0, y1: 30, x2: 160, y2: 30, stroke: "#0000ff", strokeWidth: 8, arrowSize: 30, opacity: 0.8 },
      { id: "source-rectangle-1", type: "rectangle", x: 0, y: 60, width: 80, height: 40, fill: "#00ff00", stroke: "#006600", strokeWidth: 6, opacity: 0.5 },
      { id: "source-rectangle-extra", type: "rectangle", x: 90, y: 60, width: 80, height: 40, fill: "#ffff00", stroke: "#666600", strokeWidth: 3, opacity: 0.6 },
      { id: "source-text", type: "textbox", x: 0, y: 110, width: 140, height: 50, text: "Source", fill: "none", stroke: "#333333", textColor: "#abcdef", fontFamily: "Verdana", fontSize: 30 }
    ]
  };
  const arrow = (id, y, locked = false) => ({
    id,
    type: "arrow",
    x1: 200,
    y1: y,
    x2: 400,
    y2: y,
    stroke: "#111111",
    strokeWidth: 2,
    arrowSize: 12,
    opacity: 1,
    locked
  });
  const destination = [
    { id: "destination-rectangle", type: "rectangle", x: 10, y: 10, width: 45, height: 25, fill: "none", stroke: "#111111", strokeWidth: 1, opacity: 1 },
    arrow("destination-arrow-1", 40),
    { id: "destination-text", type: "textbox", x: 10, y: 70, width: 120, height: 40, text: "Keep me", fill: "#ffffff", stroke: "#111111", textColor: "#111111", fontFamily: "Arial", fontSize: 18, locked: true },
    arrow("destination-arrow-2", 110),
    arrow("destination-arrow-3", 150)
  ];
  const lockedBefore = structuredClone(destination[2]);

  const result = applyAnnotationTemplateFormatting(template, destination);

  assert.equal(result.structureMatches, false);
  assert.equal(result.selectedCount, 5);
  assert.equal(result.matchedCount, 5);
  assert.equal(result.appliedCount, 4);
  assert.equal(result.changedCount, 4);
  assert.equal(result.lockedCount, 1);
  assert.equal(destination.length, 5);
  assert.deepEqual(
    (({ fill, stroke, strokeWidth, opacity }) => ({ fill, stroke, strokeWidth, opacity }))(destination[0]),
    { fill: "#00ff00", stroke: "#006600", strokeWidth: 6, opacity: 0.5 }
  );
  assert.equal(destination[1].stroke, "#ff0000");
  assert.equal(destination[3].stroke, "#0000ff");
  assert.equal(destination[4].stroke, "#0000ff");
  assert.deepEqual(destination[2], lockedBefore);

  const image = { id: "destination-image", type: "embedded-image", x: 0, y: 0, width: 100, height: 60, source: sampleImageDataUrl, locked: false, groupId: "" };
  const imageBefore = structuredClone(image);
  const noMatch = applyAnnotationTemplateFormatting(template, [image]);
  assert.equal(noMatch.structureMatches, false);
  assert.equal(noMatch.appliedCount, 0);
  assert.equal(noMatch.changedCount, 0);
  assert.deepEqual(image, imageBefore);
});

test("template arrow formatting is limited when needed so normalization never moves destination endpoints", () => {
  const destination = {
    id: "short-destination-arrow",
    type: "arrow",
    x1: 10,
    y1: 15,
    x2: 30,
    y2: 15,
    stroke: "#111111",
    strokeWidth: 1,
    arrowSize: 4,
    opacity: 1,
    locked: false,
    groupId: ""
  };
  const endpoints = { x1: destination.x1, y1: destination.y1, x2: destination.x2, y2: destination.y2 };
  const result = applyAnnotationTemplateFormatting({
    id: "oversized-arrow-style",
    name: "Oversized arrow style",
    width: 300,
    height: 80,
    objects: [
      { id: "large-source-arrow", type: "arrow", x1: 0, y1: 40, x2: 300, y2: 40, stroke: "#ff0000", strokeWidth: 40, arrowSize: 160, opacity: 0.4 }
    ]
  }, [destination]);

  assert.equal(result.structureMatches, true);
  assert.equal(result.geometryConstrainedCount, 1);
  assert.deepEqual(
    { x1: destination.x1, y1: destination.y1, x2: destination.x2, y2: destination.y2 },
    endpoints
  );
  const normalized = normalizeAnnotationState({
    width: 100,
    height: 80,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 100, height: 80, source: sampleImageDataUrl },
      structuredClone(destination)
    ]
  });
  const normalizedArrow = normalized.objects.find(object => object.id === destination.id);
  assert.deepEqual(
    { x1: normalizedArrow.x1, y1: normalizedArrow.y1, x2: normalizedArrow.x2, y2: normalizedArrow.y2 },
    endpoints
  );
});

test("grouped embedded image and arrow template instances resize proportionally", () => {
  const embeddedSource = "data:image/png;base64,AAECAwQ=";
  let sequence = 0;
  const instance = instantiateAnnotationTemplate({
    id: "image-arrow-template",
    name: "Image and arrow",
    width: 100,
    height: 60,
    objects: [
      {
        id: "template-image",
        type: "embedded-image",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        source: embeddedSource
      },
      {
        id: "template-arrow",
        type: "arrow",
        x1: 10,
        y1: 50,
        x2: 90,
        y2: 10,
        stroke: "#123456",
        strokeWidth: 5,
        arrowSize: 20
      }
    ]
  }, { x: 50, y: 30 }, type => `${type}-resized-${++sequence}`, "resized-group");
  const originals = structuredClone(instance);
  const startBounds = annotationSelectionBounds(originals);
  const state = {
    snapToGrid: false,
    gridSize: 20,
    objects: structuredClone(instance)
  };
  resizeAnnotationObjects(state, {
    startBounds,
    direction: "se",
    originals
  }, {
    x: startBounds.x + (startBounds.width * 2),
    y: startBounds.y + (startBounds.height * 2)
  });

  const resizedBounds = annotationSelectionBounds(state.objects);
  const originalImage = originals.find(object => object.type === "embedded-image");
  const resizedImage = state.objects.find(object => object.type === "embedded-image");
  const originalArrow = originals.find(object => object.type === "arrow");
  const resizedArrow = state.objects.find(object => object.type === "arrow");
  assert.ok(Math.abs(resizedBounds.width - (startBounds.width * 2)) < 0.000001);
  assert.ok(Math.abs(resizedBounds.height - (startBounds.height * 2)) < 0.000001);
  assert.equal(resizedBounds.width / resizedBounds.height, startBounds.width / startBounds.height);
  assert.equal(resizedImage.width, originalImage.width * 2);
  assert.equal(resizedImage.height, originalImage.height * 2);
  assert.equal(resizedImage.source, embeddedSource);
  assert.equal(
    Math.hypot(resizedArrow.x2 - resizedArrow.x1, resizedArrow.y2 - resizedArrow.y1),
    Math.hypot(originalArrow.x2 - originalArrow.x1, originalArrow.y2 - originalArrow.y1) * 2
  );
  assert.equal(resizedArrow.strokeWidth, originalArrow.strokeWidth * 2);
  assert.equal(resizedArrow.arrowSize, originalArrow.arrowSize * 2);
  assert.deepEqual([...new Set(state.objects.map(object => object.groupId))], ["resized-group"]);
});

test("object tree projects topmost-first groups and preserves custom object and group names", () => {
  const state = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "callout-group": "Release callout" },
    objects: [
      {
        id: "source-image",
        type: "embedded-image",
        name: "Quarterly dashboard",
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        source: sampleImageDataUrl,
        isOriginalImage: true
      },
      {
        id: "lower-rectangle",
        type: "rectangle",
        name: "Callout box",
        x: 20,
        y: 30,
        width: 100,
        height: 60,
        groupId: "callout-group"
      },
      {
        id: "upper-arrow",
        type: "arrow",
        name: "Revenue arrow",
        x1: 40,
        y1: 140,
        x2: 180,
        y2: 70,
        groupId: "callout-group"
      },
      {
        id: "top-text",
        type: "textbox",
        name: "Executive note",
        x: 160,
        y: 20,
        width: 130,
        height: 70,
        text: "Review"
      }
    ]
  });

  const tree = buildAnnotationObjectTree(state);
  assert.deepEqual(tree.map(node => ({ kind: node.kind, id: node.id, name: node.name })), [
    { kind: "object", id: "top-text", name: "Executive note" },
    { kind: "group", id: "callout-group", name: "Release callout" },
    { kind: "object", id: "source-image", name: "Quarterly dashboard" }
  ]);
  assert.deepEqual(tree[1].children.map(node => ({ id: node.id, name: node.name })), [
    { id: "upper-arrow", name: "Revenue arrow" },
    { id: "lower-rectangle", name: "Callout box" }
  ]);

  const restored = parseAnnotationSvg(buildAnnotationSvg(state));
  assert.equal(restored.groupNames["callout-group"], "Release callout");
  assert.deepEqual(
    restored.objects.map(object => [object.id, object.name]),
    [
      ["source-image", "Quarterly dashboard"],
      ["lower-rectangle", "Callout box"],
      ["upper-arrow", "Revenue arrow"],
      ["top-text", "Executive note"]
    ]
  );
});

test("copying one child does not preserve a larger parent group identity", () => {
  const state = normalizeAnnotationState({
    width: 160,
    height: 90,
    groupNames: { callout: "Callout Group" },
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 160, height: 90, source: sampleImageDataUrl },
      { id: "box", type: "rectangle", x: 10, y: 10, width: 40, height: 30, groupId: "callout" },
      { id: "arrow", type: "arrow", x1: 20, y1: 70, x2: 90, y2: 30, groupId: "callout" }
    ]
  });

  const childTemplate = captureAnnotationTemplate(
    state,
    new Set(["box"]),
    "data:image/png;base64,AAECAwQ=",
    "One child"
  );
  assert.equal(childTemplate.grouped, false);
  assert.equal(childTemplate.groupName, "");
  assert.equal(instantiateAnnotationTemplate(childTemplate, { x: 100, y: 100 })[0].groupId, "");

  const groupTemplate = captureAnnotationTemplate(
    state,
    new Set(["box", "arrow"]),
    "data:image/png;base64,AAECAwQ=",
    "Whole group"
  );
  assert.equal(groupTemplate.grouped, true);
  assert.equal(groupTemplate.groupName, "Callout Group");
});

test("object tree reorder and reparent keep z-order coherent for ordinary image layers", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "callout-group": "Callout" },
    objects: [
      { id: "source-image", type: "embedded-image", x: 0, y: 0, width: 320, height: 180, source: sampleImageDataUrl, isOriginalImage: true },
      { id: "group-rectangle", type: "rectangle", x: 20, y: 30, width: 100, height: 60, groupId: "callout-group" },
      { id: "group-arrow", type: "arrow", x1: 40, y1: 140, x2: 180, y2: 70, groupId: "callout-group" },
      { id: "top-text", type: "textbox", x: 160, y: 20, width: 130, height: 70, text: "Review" }
    ]
  });

  const insideGroup = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "top-text",
    targetKind: "group",
    targetId: "callout-group"
  });
  assert.equal(insideGroup.objects.find(object => object.id === "top-text").groupId, "callout-group");
  assert.deepEqual(
    buildAnnotationObjectTree(insideGroup)[0].children.map(node => node.id),
    ["top-text", "group-arrow", "group-rectangle"]
  );

  const backToRoot = reorderAnnotationObjectTree(insideGroup, {
    draggedKind: "object",
    draggedId: "group-arrow",
    targetKind: "root",
    targetId: ""
  });
  assert.equal(backToRoot.objects.find(object => object.id === "group-arrow").groupId, "");
  assert.deepEqual(buildAnnotationObjectTree(backToRoot).map(node => node.id), [
    "group-arrow",
    "callout-group",
    "source-image"
  ]);

  const movedGroup = reorderAnnotationObjectTree(backToRoot, {
    draggedKind: "group",
    draggedId: "callout-group",
    targetKind: "object",
    targetId: "group-arrow"
  });
  assert.deepEqual(buildAnnotationObjectTree(movedGroup).map(node => node.id), [
    "callout-group",
    "group-arrow",
    "source-image"
  ]);
  assert.deepEqual(movedGroup.objects.map(object => object.id), [
    "source-image",
    "group-arrow",
    "group-rectangle",
    "top-text"
  ]);

  const raisedImage = reorderAnnotationObjectTree(movedGroup, {
    draggedKind: "object",
    draggedId: "source-image",
    targetKind: "root",
    targetId: ""
  });
  assert.equal(raisedImage.objects.at(-1).id, "source-image");
  assert.equal(buildAnnotationObjectTree(raisedImage)[0].id, "source-image");
});

test("object tree drop placement can promote an item above a top group without joining it", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: { "top-group": "Top Group" },
    objects: [
      { id: "source-image", type: "embedded-image", x: 0, y: 0, width: 320, height: 180, source: sampleImageDataUrl },
      { id: "candidate", type: "textbox", x: 20, y: 20, width: 80, height: 40, text: "Promote" },
      { id: "group-box", type: "rectangle", x: 120, y: 30, width: 80, height: 60, groupId: "top-group" },
      { id: "group-arrow", type: "arrow", x1: 140, y1: 130, x2: 240, y2: 60, groupId: "top-group" }
    ]
  });

  const promoted = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "candidate",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "before"
  });
  const tree = buildAnnotationObjectTree(promoted);
  assert.deepEqual(tree.map(node => node.id), ["candidate", "top-group", "source-image"]);
  assert.equal(promoted.objects.find(object => object.id === "candidate").groupId, "");
  assert.deepEqual(tree[1].children.map(node => node.id), ["group-arrow", "group-box"]);

  const joined = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "candidate",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "after"
  });
  assert.equal(joined.objects.find(object => object.id === "candidate").groupId, "top-group");
  assert.deepEqual(buildAnnotationObjectTree(joined).map(node => node.id), ["top-group", "source-image"]);
});

test("object tree drop placement can promote a group above a top group without merging it", () => {
  const source = normalizeAnnotationState({
    width: 320,
    height: 180,
    groupNames: {
      "candidate-group": "Candidate Group",
      "top-group": "Top Group"
    },
    objects: [
      { id: "source-image", type: "embedded-image", x: 0, y: 0, width: 320, height: 180, source: sampleImageDataUrl },
      { id: "candidate-box", type: "rectangle", x: 20, y: 20, width: 80, height: 40, groupId: "candidate-group" },
      { id: "candidate-arrow", type: "arrow", x1: 30, y1: 120, x2: 100, y2: 70, groupId: "candidate-group" },
      { id: "top-box", type: "rectangle", x: 120, y: 30, width: 80, height: 60, groupId: "top-group" },
      { id: "top-arrow", type: "arrow", x1: 140, y1: 130, x2: 240, y2: 60, groupId: "top-group" }
    ]
  });

  assert.deepEqual(buildAnnotationObjectTree(source).map(node => node.id), [
    "top-group",
    "candidate-group",
    "source-image"
  ]);

  const promoted = reorderAnnotationObjectTree(source, {
    draggedKind: "group",
    draggedId: "candidate-group",
    targetKind: "group",
    targetId: "top-group",
    targetPlacement: "before"
  });
  const tree = buildAnnotationObjectTree(promoted);
  assert.deepEqual(tree.map(node => node.id), ["candidate-group", "top-group", "source-image"]);
  assert.deepEqual(tree[0].children.map(node => node.id), ["candidate-arrow", "candidate-box"]);
  assert.deepEqual(tree[1].children.map(node => node.id), ["top-arrow", "top-box"]);
  assert.equal(promoted.objects.find(object => object.id === "candidate-box").groupId, "candidate-group");
  assert.equal(promoted.objects.find(object => object.id === "top-box").groupId, "top-group");
});

test("object tree before and after placements map to the visible root order", () => {
  const source = normalizeAnnotationState({
    width: 200,
    height: 120,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 200, height: 120, source: sampleImageDataUrl },
      { id: "bottom", type: "rectangle", x: 10, y: 10, width: 30, height: 30 },
      { id: "middle", type: "rectangle", x: 50, y: 10, width: 30, height: 30 },
      { id: "top", type: "rectangle", x: 90, y: 10, width: 30, height: 30 }
    ]
  });

  const belowMiddle = reorderAnnotationObjectTree(source, {
    draggedKind: "object",
    draggedId: "top",
    targetKind: "object",
    targetId: "middle",
    targetPlacement: "after"
  });
  assert.deepEqual(buildAnnotationObjectTree(belowMiddle).map(node => node.id), [
    "middle",
    "top",
    "bottom",
    "image"
  ]);
});

test("object tree search is case-insensitive and retains matching group context", () => {
  const tree = buildAnnotationObjectTree(normalizeAnnotationState({
    width: 200,
    height: 120,
    groupNames: { callouts: "Primary Callouts" },
    objects: [
      { id: "image", type: "embedded-image", name: "Dashboard Source", x: 0, y: 0, width: 200, height: 120, source: sampleImageDataUrl },
      { id: "box", type: "rectangle", name: "Revenue Box", x: 10, y: 10, width: 60, height: 40, groupId: "callouts" },
      { id: "arrow", type: "arrow", name: "Margin Arrow", x1: 20, y1: 90, x2: 120, y2: 45, groupId: "callouts" },
      { id: "note", type: "textbox", name: "Executive Note", x: 100, y: 10, width: 80, height: 50, text: "Review" }
    ]
  }));

  const childMatch = filterAnnotationObjectTree(tree, "REVENUE");
  assert.deepEqual(childMatch.map(node => node.id), ["callouts"]);
  assert.deepEqual(childMatch[0].children.map(node => node.id), ["box"]);

  const groupMatch = filterAnnotationObjectTree(tree, "primary");
  assert.deepEqual(groupMatch.map(node => node.id), ["callouts"]);
  assert.deepEqual(groupMatch[0].children.map(node => node.id), ["arrow", "box"]);

  assert.deepEqual(filterAnnotationObjectTree(tree, "missing"), []);
  assert.deepEqual(filterAnnotationObjectTree(tree, ""), tree);
  assert.deepEqual(tree.map(node => node.id), ["note", "callouts", "image"]);
});

test("object tree compacts interleaved groups into paint-order blocks without special image ordering", () => {
  const objects = [
    { id: "image", type: "embedded-image", source: sampleImageDataUrl, groupId: "image-group" },
    { id: "background-note", type: "textbox", groupId: "" },
    { id: "first-member", type: "rectangle", groupId: "callout-group" },
    { id: "middle-note", type: "textbox", groupId: "" },
    { id: "image-outline", type: "rectangle", groupId: "image-group" },
    { id: "second-member", type: "arrow", groupId: "callout-group" },
    { id: "top-note", type: "textbox", groupId: "" }
  ];

  compactAnnotationGroupLayers(objects);
  assert.deepEqual(objects.map(object => object.id), [
    "background-note",
    "middle-note",
    "image",
    "image-outline",
    "first-member",
    "second-member",
    "top-note"
  ]);
  assert.equal(objects[2].type, "embedded-image");
  assert.deepEqual(objects.slice(2, 4).map(object => object.groupId), ["image-group", "image-group"]);
  assert.deepEqual(objects.slice(4, 6).map(object => object.groupId), ["callout-group", "callout-group"]);
});

test("text vertical alignment persists and places text at the top, middle, or bottom", () => {
  const base = {
    width: 300,
    height: 180,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 300, height: 180, source: sampleImageDataUrl },
      {
        id: "text",
        type: "textbox",
        x: 20,
        y: 20,
        width: 240,
        height: 120,
        text: "One line",
        fontSize: 20,
        textAlign: "left"
      }
    ]
  };
  const textY = alignment => {
    const state = structuredClone(base);
    state.objects[1].textVerticalAlign = alignment;
    const match = buildAnnotationSvg(state)
      .match(/<text\b[^>]*\by="([^"]+)"/);
    return Number(match?.[1]);
  };

  assert.ok(textY("top") < textY("middle"));
  assert.ok(textY("middle") < textY("bottom"));
  assert.equal(textY("middle"), 86);
  assert.equal(normalizeAnnotationState(base).objects[1].textVerticalAlign, "top");
});

test("persisted group members remain individually selectable", () => {
  const objects = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 100, height: 50, source: sampleImageDataUrl, groupId: "group-1" },
      { id: "rectangle", type: "rectangle", x: 10, y: 10, width: 20, height: 20, groupId: "group-1" },
      { id: "text", type: "textbox", x: 40, y: 10, width: 20, height: 20 }
    ]
  }).objects;

  assert.deepEqual(annotationSelectionIdsForObject(objects, objects[0]), ["image"]);
  assert.deepEqual(annotationSelectionIdsForObject(objects, objects[2]), ["text"]);
});

test("object and group visibility persist while hidden layers stay out of rendering and hit testing", () => {
  const state = normalizeAnnotationState({
    width: 500,
    height: 300,
    groupNames: { "overlay-group": "Entity Descriptions" },
    groupVisibility: { "overlay-group": false },
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 500, height: 300, source: sampleImageDataUrl, visible: false },
      {
        id: "overlay-label",
        type: "textbox",
        x: 20,
        y: 20,
        width: 180,
        height: 60,
        text: "HIDDEN GROUP LABEL",
        groupId: "overlay-group"
      },
      {
        id: "overlay-arrow",
        type: "arrow",
        x1: 40,
        y1: 90,
        x2: 180,
        y2: 130,
        groupId: "overlay-group"
      },
      {
        id: "hidden-root",
        type: "textbox",
        x: 220,
        y: 20,
        width: 120,
        height: 50,
        text: "HIDDEN ROOT LABEL",
        visible: false
      },
      {
        id: "visible-root",
        type: "textbox",
        x: 300,
        y: 180,
        width: 140,
        height: 50,
        text: "VISIBLE ROOT LABEL"
      }
    ]
  });

  assert.equal(state.groupVisibility["overlay-group"], false);
  assert.equal(state.objects.find(object => object.id === "overlay-label").visible, true);
  assert.equal(state.objects.find(object => object.id === "hidden-root").visible, false);

  const tree = buildAnnotationObjectTree(state);
  const overlayGroup = tree.find(node => node.id === "overlay-group");
  assert.equal(overlayGroup.visible, false);
  assert.ok(overlayGroup.children.every(child => child.visible === true && child.effectiveVisible === false));
  assert.equal(tree.find(node => node.id === "hidden-root").effectiveVisible, false);
  assert.equal(tree.find(node => node.id === "visible-root").effectiveVisible, true);

  const svg = buildAnnotationSvg(state);
  const renderedBody = svg.split("</metadata>")[1];
  assert.match(renderedBody, />VISIBLE</);
  assert.doesNotMatch(renderedBody, />HIDDEN|>GROUP|>ROOT/);
  const reopened = parseAnnotationSvg(svg);
  assert.equal(reopened.groupVisibility["overlay-group"], false);
  assert.equal(reopened.objects.find(object => object.id === "hidden-root").visible, false);

  assert.deepEqual(
    annotationObjectsIntersectingRect(
      state.objects,
      { x: 0, y: 0, width: 500, height: 300 },
      null,
      state.groupVisibility
    ).map(object => object.id),
    ["visible-root"]
  );
  assert.deepEqual(
    annotationSelectionIdsForObject(
      state.objects,
      state.objects.find(object => object.id === "overlay-label"),
      state.groupVisibility
    ),
    []
  );

  const overlayTemplate = captureAnnotationTemplate(
    state,
    new Set(["overlay-label", "overlay-arrow"]),
    "",
    "Entity Descriptions"
  );
  assert.equal(overlayTemplate.groupVisible, false);
  const uploadedTemplate = parseAnnotationTemplateUpload(annotationTemplateDownloadFile(overlayTemplate).contents);
  assert.equal(uploadedTemplate.groupVisible, false);
  assert.ok(uploadedTemplate.objects.every(object => object.visible === true));
});

test("corner handles resize proportionally while side handles resize one axis", () => {
  const start = { x: 10, y: 20, width: 100, height: 50 };
  const state = { snapToGrid: false, gridSize: 20 };
  const edgeResize = resizedAnnotationBounds(start, "e", { x: 160, y: 45 }, state);
  assert.deepEqual(edgeResize, { x: 10, y: 20, width: 150, height: 50 });

  const topResize = resizedAnnotationBounds(start, "n", { x: 60, y: 5 }, state);
  assert.deepEqual(topResize, { x: 10, y: 5, width: 100, height: 65 });

  const cornerResize = resizedAnnotationBounds(start, "se", { x: 160, y: 120 }, state);
  assert.deepEqual(cornerResize, { x: 10, y: 20, width: 200, height: 100 });
  assert.equal(cornerResize.width / cornerResize.height, 2);

  const centered = resizedAnnotationBounds(start, "e", { x: 160, y: 45 }, state, true);
  assert.deepEqual(centered, { x: -40, y: 20, width: 200, height: 50 });
  assert.equal(centered.x + (centered.width / 2), start.x + (start.width / 2));
  assert.equal(centered.y + (centered.height / 2), start.y + (start.height / 2));
});

test("side resizing preserves text size and corner resizing scales text proportionally", () => {
  const startBounds = { x: 10, y: 20, width: 100, height: 50 };
  const base = { x: 10, y: 20, width: 100, height: 50, groupId: "" };

  for (const type of ["rectangle", "embedded-image", "textbox", "entity"]) {
    const original = {
      ...base,
      id: type,
      type,
      ...(type === "embedded-image"
        ? { source: sampleImageDataUrl, imageClip: { x: base.x, y: base.y, width: base.width, height: base.height } }
        : {}),
      ...(["textbox", "entity"].includes(type) ? { fontSize: 20 } : {}),
      ...(type === "entity" ? { expandedHeight: 50, collapsed: false } : {})
    };
    const edgeState = { snapToGrid: false, gridSize: 20, objects: [structuredClone(original)] };
    resizeAnnotationObjects(edgeState, {
      startBounds,
      direction: "e",
      originals: [structuredClone(original)]
    }, { x: 160, y: 45 });
    assert.deepEqual(
      annotationSelectionBounds(edgeState.objects),
      { x: 10, y: 20, width: 150, height: 50 },
      `${type} side resize should change only width`
    );
    if (["textbox", "entity"].includes(type)) {
      assert.equal(edgeState.objects[0].fontSize, 20, `${type} side resize must preserve text size`);
    }

    const cornerState = { snapToGrid: false, gridSize: 20, objects: [structuredClone(original)] };
    resizeAnnotationObjects(cornerState, {
      startBounds,
      direction: "se",
      originals: [structuredClone(original)]
    }, { x: 160, y: 120 });
    assert.deepEqual(
      annotationSelectionBounds(cornerState.objects),
      { x: 10, y: 20, width: 200, height: 100 },
      `${type} corner resize should remain proportional`
    );
    if (["textbox", "entity"].includes(type)) {
      assert.equal(cornerState.objects[0].fontSize, 40, `${type} corner resize should scale text`);
    }
  }

  const groupedObjects = [
    { ...base, id: "group-a", type: "rectangle", width: 40, height: 20, groupId: "group" },
    { ...base, id: "group-b", type: "rectangle", x: 70, y: 40, width: 40, height: 30, groupId: "group" }
  ];
  const groupedState = { snapToGrid: false, gridSize: 20, objects: structuredClone(groupedObjects) };
  resizeAnnotationObjects(groupedState, {
    startBounds,
    direction: "e",
    originals: structuredClone(groupedObjects)
  }, { x: 160, y: 45 });
  const groupedBounds = annotationSelectionBounds(groupedState.objects);
  assert.deepEqual(groupedBounds, { x: 10, y: 20, width: 150, height: 50 });
});

test("side resizing a selection keeps contained arrows proportional", () => {
  const startBounds = { x: 10, y: 20, width: 100, height: 50 };
  const arrow = {
    id: "group-arrow",
    type: "arrow",
    x1: 20,
    y1: 30,
    x2: 100,
    y2: 60,
    strokeWidth: 4,
    arrowSize: 10,
    groupId: "group"
  };
  const rectangle = {
    id: "group-rectangle",
    type: "rectangle",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    groupId: "group"
  };
  const state = {
    snapToGrid: false,
    gridSize: 20,
    objects: [structuredClone(rectangle), structuredClone(arrow)]
  };

  resizeAnnotationObjects(state, {
    startBounds,
    direction: "e",
    originals: [structuredClone(rectangle), structuredClone(arrow)]
  }, { x: 160, y: 45 });

  const resizedArrow = state.objects.find(object => object.type === "arrow");
  assert.equal(resizedArrow.x2 - resizedArrow.x1, arrow.x2 - arrow.x1);
  assert.equal(resizedArrow.y2 - resizedArrow.y1, arrow.y2 - arrow.y1);
  assert.equal((resizedArrow.x1 + resizedArrow.x2) / 2, 85);
  assert.equal((resizedArrow.y1 + resizedArrow.y2) / 2, 45);
  assert.equal(resizedArrow.strokeWidth, arrow.strokeWidth);
  assert.equal(resizedArrow.arrowSize, arrow.arrowSize);
});

test("Entity side resizing keeps the PK/FK column fixed and gives width to field names", () => {
  const state = normalizeAnnotationState({
    width: 1600,
    height: 1200,
    objects: [entityObject(
      parseAnnotationEntityDefinition(workTasksCreateTableSql),
      "entity-resize",
      40,
      80,
      { showDataTypes: true }
    )]
  });
  const entity = state.objects[0];
  const original = structuredClone(entity);
  const clipWidth = (svg, name) => {
    const match = svg.match(new RegExp(`id="pmt-annotation-entity-clip-entity-resize-${name}"><rect[^>]*width="([^"]+)"`));
    assert.ok(match, `${name} clip should render`);
    return Number(match[1]);
  };
  const beforeSvg = buildAnnotationSvg(state, "");
  const beforeKeyWidth = clipWidth(beforeSvg, "keys");
  const beforeFieldWidth = clipWidth(beforeSvg, "fields");

  resizeAnnotationObjects(state, {
    startBounds: annotationSelectionBounds([entity]),
    direction: "e",
    originals: [original]
  }, { x: original.x + original.width + 180, y: original.y + (original.height / 2) });

  assert.equal(entity.width, original.width + 180);
  assert.equal(entity.height, original.height);
  assert.equal(entity.fontSize, original.fontSize);
  assert.equal(entity.expandedHeight, original.expandedHeight);
  const afterSvg = buildAnnotationSvg(state, "");
  assert.equal(clipWidth(afterSvg, "keys"), beforeKeyWidth);
  assert.equal(clipWidth(afterSvg, "fields"), beforeFieldWidth + 180);
});

test("temporary workspace is centered while exported SVG trims to image and annotation paint", () => {
  const state = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 100, height: 50, source: sampleImageDataUrl },
      { id: "outside", type: "rectangle", x: -20, y: 10, width: 10, height: 10, fill: "none", stroke: "#ff0000", strokeWidth: 4 },
      { id: "arrow", type: "arrow", x1: 100, y1: 25, x2: 140, y2: 25, stroke: "#00b050", strokeWidth: 4, arrowSize: 10 }
    ]
  });
  const before = structuredClone(state);
  const output = annotationOutputBounds(state);
  assert.deepEqual(output, { x: -22, y: 0, width: 162, height: 50 });

  const workspace = annotationWorkspaceBounds(state, 900, 600);
  assert.ok(workspace.width >= 9960);
  assert.ok(workspace.height >= 6960);
  assert.equal(workspace.x + (workspace.width / 2), output.x + (output.width / 2));
  assert.equal(workspace.y + (workspace.height / 2), output.y + (output.height / 2));

  const svg = buildAnnotationSvg(state);
  assert.match(svg, /width="162" height="50" viewBox="-22 0 162 50"/);
  assert.match(svg, /<image\b[^>]*href="data:image\/png;base64,AAECAwQ="[^>]*width="100"[^>]*height="50"/);
  assert.doesNotMatch(svg, /pmt-annotation-image-clip-image/);
  assert.deepEqual(state, before);
});

test("moving and resizing an embedded image keep its crop aligned", () => {
  const state = normalizeAnnotationState({
    width: 300,
    height: 200,
    objects: [{
      id: "image",
      type: "embedded-image",
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      source: sampleImageDataUrl,
      imageClip: { x: 30, y: 30, width: 40, height: 30 }
    }]
  });
  const image = state.objects[0];

  moveAnnotationObjects(state, {
    startPoint: { x: 0, y: 0 },
    startBounds: annotationSelectionBounds([image]),
    originals: [structuredClone(image)]
  }, { x: 25, y: 15 });
  assert.deepEqual(
    { x: image.x, y: image.y, imageClip: image.imageClip },
    { x: 35, y: 35, imageClip: { x: 55, y: 45, width: 40, height: 30 } }
  );

  const moved = structuredClone(image);
  const startBounds = annotationSelectionBounds([image]);
  resizeAnnotationObjects(state, {
    startBounds,
    direction: "se",
    originals: [moved]
  }, {
    x: startBounds.x + (startBounds.width * 2),
    y: startBounds.y + (startBounds.height * 2)
  });
  assert.deepEqual(
    { x: image.x, y: image.y, width: image.width, height: image.height },
    { x: 15, y: 25, width: 200, height: 120 }
  );
  assert.deepEqual(image.imageClip, { x: 55, y: 45, width: 80, height: 60 });

  const svg = buildAnnotationSvg(state);
  assert.match(svg, /viewBox="0 0 300 200"/);
  assert.match(svg, /<rect x="55" y="45" width="80" height="60"><\/rect><\/clipPath>/);
  assert.deepEqual(parseAnnotationSvg(svg).objects[0].imageClip, image.imageClip);
});

test("a cropped embedded image retains vectors beyond its crop", () => {
  const state = normalizeAnnotationState({
    width: 80,
    height: 50,
    objects: [
      {
        id: "image",
        type: "embedded-image",
        x: -20,
        y: 0,
        width: 100,
        height: 50,
        source: sampleImageDataUrl,
        imageClip: { x: 0, y: 0, width: 80, height: 50 }
      },
      { id: "outside", type: "rectangle", x: 90, y: 10, width: 10, height: 10, fill: "none", stroke: "#ff0000", strokeWidth: 2 }
    ]
  });

  assert.deepEqual(state.objects[0].imageClip, { x: 0, y: 0, width: 80, height: 50 });
  assert.deepEqual(annotationOutputBounds(state), { x: 0, y: 0, width: 101, height: 50 });
});

test("marquee intersection includes edge touches, grouped members, locked objects, arrows, and the image", () => {
  const objects = normalizeAnnotationState({
    width: 100,
    height: 50,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 100, height: 50, source: sampleImageDataUrl },
      { id: "group-a", type: "rectangle", x: 110, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, groupId: "group-1" },
      { id: "group-b", type: "textbox", x: 170, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, groupId: "group-1" },
      { id: "locked", type: "rectangle", x: 210, y: 10, width: 20, height: 20, stroke: "#000000", strokeWidth: 2, locked: true },
      { id: "arrow", type: "arrow", x1: 250, y1: 20, x2: 300, y2: 20, stroke: "#000000", strokeWidth: 4, arrowSize: 14 }
    ]
  }).objects;
  const frame = { x: 0, y: 0, width: 100, height: 50 };

  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 131, y: 15, width: 0, height: 1 }, frame).map(object => object.id),
    ["group-a"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 215, y: 15, width: 1, height: 1 }, frame).map(object => object.id),
    ["locked"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 299, y: 19, width: 2, height: 2 }, frame).map(object => object.id),
    ["arrow"]
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(objects, { x: 100, y: 20, width: 0, height: 1 }, frame).map(object => object.id),
    ["image"]
  );
  assert.deepEqual(annotationObjectsIntersectingRect(objects, { x: 400, y: 400, width: 10, height: 10 }, frame), []);

  const diagonalArrow = normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 10, height: 10, source: sampleImageDataUrl },
      { id: "diagonal", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100, stroke: "#000000", strokeWidth: 4, arrowSize: 14 }
    ]
  }).objects.filter(object => object.type === "arrow");
  assert.deepEqual(
    annotationObjectsIntersectingRect(diagonalArrow, { x: 0, y: 90, width: 5, height: 5 }).map(object => object.id),
    []
  );
  assert.deepEqual(
    annotationObjectsIntersectingRect(diagonalArrow, { x: 48, y: 48, width: 4, height: 4 }).map(object => object.id),
    ["diagonal"]
  );

  const thickDiagonalArrow = normalizeAnnotationState({
    width: 10,
    height: 10,
    objects: [
      { id: "image", type: "embedded-image", x: 0, y: 0, width: 10, height: 10, source: sampleImageDataUrl },
      { id: "thick-diagonal", type: "arrow", x1: 0, y1: 0, x2: 100, y2: 100, stroke: "#000000", strokeWidth: 40, arrowSize: 6 }
    ]
  }).objects.filter(object => object.type === "arrow");
  assert.deepEqual(annotationObjectsIntersectingRect(thickDiagonalArrow, { x: 0, y: 30, width: 0, height: 0 }), []);
  assert.deepEqual(
    annotationObjectsIntersectingRect(thickDiagonalArrow, { x: 0, y: 28, width: 0, height: 0 }).map(object => object.id),
    ["thick-diagonal"]
  );
});

test("annotation snapping and cursor-centered zoom preserve the pointed document coordinate", () => {
  assert.equal(snapAnnotationValue(49, true, 20), 40);
  assert.equal(snapAnnotationValue(51, true, 20), 60);
  assert.equal(snapAnnotationValue(51, false, 20), 51);
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 10, y: 15 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 10, y: 15 }
  );
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 110, y: 70 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 110, y: 70 }
  );
  assert.deepEqual(
    snapAnnotationCropPoint({ x: 31, y: 44 }, { x: 10, y: 15, width: 100, height: 55 }, true, 20),
    { x: 30, y: 35 }
  );

  const result = zoomAnnotationAtPoint({
    oldZoom: 1,
    newZoom: 2,
    scrollLeft: 300,
    scrollTop: 160,
    pointX: 200,
    pointY: 100
  });
  assert.deepEqual(result, { zoom: 2, scrollLeft: 800, scrollTop: 420 });
  assert.equal((300 + 200) / 1, (result.scrollLeft + 200) / result.zoom);
  assert.equal((160 + 100) / 1, (result.scrollTop + 100) / result.zoom);

  const paddedResult = zoomAnnotationAtPoint({
    oldZoom: 1,
    newZoom: 2,
    scrollLeft: 300,
    scrollTop: 160,
    pointX: 200,
    pointY: 100,
    contentOffsetX: 24,
    contentOffsetY: 24
  });
  assert.deepEqual(paddedResult, { zoom: 2, scrollLeft: 776, scrollTop: 396 });
  assert.equal((300 + 200 - 24) / 1, (paddedResult.scrollLeft + 200 - 24) / paddedResult.zoom);
  assert.equal((160 + 100 - 24) / 1, (paddedResult.scrollTop + 100 - 24) / paddedResult.zoom);

});

test("large SVG planes stay under the device texture budget at every visual zoom", () => {
  const normal = annotationSvgPlaneMetrics(1200, 800, 1);
  assert.deepEqual(normal, { width: 1200, height: 800, baseScale: 1 });

  const large = annotationSvgPlaneMetrics(21393, 11622, 1);
  assert.equal(Math.round(large.width), 7680);
  assert.ok(large.height < 7680);
  assert.ok(large.baseScale < 1);
  assert.equal(large.width / large.baseScale, 21393);

  const highDpi = annotationSvgPlaneMetrics(21393, 11622, 2);
  assert.equal(Math.round(highDpi.width), 3840);
  assert.ok(highDpi.height < 3840);
});

test("two embedded images keep independent crop cues and visibility toggles", () => {
  const state = normalizeAnnotationState({
    width: 220,
    height: 60,
    objects: [
      {
        id: "first-image",
        type: "embedded-image",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        source: sampleImageDataUrl,
        imageClip: { x: 20, y: 10, width: 40, height: 30 }
      },
      {
        id: "second-image",
        type: "embedded-image",
        x: 120,
        y: 0,
        width: 100,
        height: 60,
        source: "data:image/png;base64,AQID",
        imageClip: { x: 130, y: 5, width: 60, height: 40 }
      }
    ]
  });
  const firstImage = state.objects[0];
  const secondImage = state.objects[1];

  assert.equal(annotationImageHasReversibleCrop(state, firstImage), true);
  assert.equal(annotationImageHasReversibleCrop(state, secondImage), true);
  assert.equal(firstImage.cropVisible, true);
  assert.equal(secondImage.cropVisible, true);

  assert.equal(setAnnotationImageCropVisibility(state, false, firstImage), true);
  assert.deepEqual(firstImage.imageClip, { x: 20, y: 10, width: 40, height: 30 });
  assert.equal(secondImage.cropVisible, true);
  const tree = buildAnnotationObjectTree(state);
  const hiddenTreeImage = tree.find(node => node.id === "first-image");
  const visibleTreeImage = tree.find(node => node.id === "second-image");
  assert.equal(hiddenTreeImage.cropped, true);
  assert.equal(hiddenTreeImage.reversibleCrop, true);
  assert.equal(hiddenTreeImage.cropVisible, false);
  assert.equal(visibleTreeImage.cropped, true);
  assert.equal(visibleTreeImage.cropVisible, true);
  assert.doesNotMatch(buildAnnotationSvg(state), /pmt-annotation-image-clip-first-image/);
  assert.match(buildAnnotationSvg(state), /pmt-annotation-image-clip-second-image/);

  const restored = parseAnnotationSvg(buildAnnotationSvg(state));
  const restoredImage = restored.objects.find(object => object.id === "first-image");
  const restoredSecondImage = restored.objects.find(object => object.id === "second-image");
  assert.equal(restoredImage.cropVisible, false);
  assert.deepEqual(restoredImage.imageClip, firstImage.imageClip);
  assert.equal(restoredSecondImage.cropVisible, true);
  assert.deepEqual(restoredSecondImage.imageClip, secondImage.imageClip);
  assert.equal(setAnnotationImageCropVisibility(restored, true, restoredImage), true);
  assert.match(buildAnnotationSvg(restored), /pmt-annotation-image-clip-first-image/);
});

test("object tree keeps a permanent-crop cue after the baked image becomes the full source", () => {
  const state = normalizeAnnotationState({
    width: 40,
    height: 30,
    objects: [{
      id: "source-image",
      type: "embedded-image",
      x: 10,
      y: 15,
      width: 40,
      height: 30,
      source: "data:image/png;base64,AA==",
      cropPermanent: true
    }]
  });
  const imageNode = buildAnnotationObjectTree(state).at(-1);
  assert.equal(annotationImageHasReversibleCrop(state), false);
  assert.equal(imageNode.cropped, true);
  assert.equal(imageNode.reversibleCrop, false);
  assert.equal(imageNode.permanentCrop, true);
});

test("a permanent crop rasterizes only the selected embedded image", async () => {
  const originalDocument = globalThis.document;
  const OriginalImage = globalThis.Image;
  const OriginalFileReader = globalThis.FileReader;
  const drawCalls = [];

  class TestImage {
    listeners = {};
    naturalWidth = 400;
    naturalHeight = 240;

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    set src(value) {
      this.source = value;
      queueMicrotask(() => this.listeners.load?.());
    }
  }

  class TestFileReader {
    listeners = {};
    result = "";

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    readAsDataURL() {
      this.result = "data:image/png;base64,Y3JvcHBlZA==";
      queueMicrotask(() => this.listeners.load?.());
    }
  }

  globalThis.Image = TestImage;
  globalThis.FileReader = TestFileReader;
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(contextType) {
          assert.equal(contextType, "2d");
          return { drawImage: (...args) => drawCalls.push(args) };
        },
        toBlob(callback, type) {
          callback(new Blob(["cropped"], { type }));
        }
      };
    }
  };

  try {
    const state = normalizeAnnotationState({
      width: 320,
      height: 120,
      objects: [
        {
          id: "source-image",
          type: "embedded-image",
          x: 0,
          y: 0,
          width: 200,
          height: 120,
          source: "data:image/png;base64,b2xkLWZ1bGwtaW1hZ2U=",
          cropVisible: false,
          imageClip: { x: 40, y: 20, width: 80, height: 60 }
        },
        {
          id: "untouched-image",
          type: "embedded-image",
          x: 220,
          y: 10,
          width: 80,
          height: 80,
          source: "data:image/png;base64,c2Vjb25k",
          imageClip: { x: 230, y: 20, width: 50, height: 50 }
        }
      ]
    });
    const untouchedBefore = structuredClone(state.objects[1]);
    const result = await permanentlyCropAnnotationImage(state, "source-image");

    assert.equal(result.dataUrl, "data:image/png;base64,Y3JvcHBlZA==");
    assert.equal(result.width, 160);
    assert.equal(result.height, 120);
    assert.deepEqual(drawCalls[0].slice(1), [80, 40, 160, 120, 0, 0, 160, 120]);
    const image = state.objects[0];
    assert.deepEqual(
      { x: image.x, y: image.y, width: image.width, height: image.height },
      { x: 40, y: 20, width: 80, height: 60 }
    );
    assert.deepEqual(image.imageClip, { x: 40, y: 20, width: 80, height: 60 });
    assert.equal(image.cropVisible, true);
    assert.equal(image.cropPermanent, true);
    assert.deepEqual(state.objects[1], untouchedBefore);
    const svg = buildAnnotationSvg(state);
    assert.match(svg, /Y3JvcHBlZA==/);
    assert.doesNotMatch(svg, /b2xkLWZ1bGwtaW1hZ2U=/);
    assert.match(svg, /c2Vjb25k/);
  } finally {
    globalThis.document = originalDocument;
    globalThis.Image = OriginalImage;
    globalThis.FileReader = OriginalFileReader;
  }
});

test("annotation text wraps more as the box narrows or the font grows", () => {
  const text = "The quick brown fox jumps over the lazy dog";
  const wide = wrapAnnotationText(text, 480, 20);
  const narrow = wrapAnnotationText(text, 180, 20);
  const larger = wrapAnnotationText(text, 480, 48);
  assert.ok(narrow.length > wide.length);
  assert.ok(larger.length > wide.length);
  assert.equal(narrow.join(" "), text);
});

test("selection bounds cover grouped geometry and layer commands preserve selected order", () => {
  const objects = [
    { id: "image", type: "embedded-image", x: 0, y: 0, width: 800, height: 450, source: sampleImageDataUrl },
    { id: "a", type: "rectangle", x: 10, y: 20, width: 100, height: 80 },
    { id: "b", type: "arrow", x1: 80, y1: 10, x2: 240, y2: 180 },
    { id: "c", type: "textbox", x: 300, y: 40, width: 100, height: 60 }
  ];
  assert.deepEqual(annotationSelectionBounds([objects[1], objects[2]]), {
    x: 10,
    y: 10,
    width: 230,
    height: 170
  });

  moveAnnotationLayers(objects, new Set(["a", "b"]), "front");
  assert.deepEqual(objects.map(object => object.id), ["image", "c", "a", "b"]);
  moveAnnotationLayers(objects, new Set(["a", "b"]), "backward");
  assert.deepEqual(objects.map(object => object.id), ["image", "a", "b", "c"]);
  moveAnnotationLayers(objects, new Set(["image"]), "front");
  assert.deepEqual(objects.map(object => object.id), ["a", "b", "c", "image"]);
});

test("Entity relationships render above Original Image and below Entity objects", () => {
  const state = normalizeAnnotationState({
    width: 900,
    height: 600,
    objects: [
      {
        id: "original-image",
        type: "embedded-image",
        x: 0,
        y: 0,
        width: 900,
        height: 600,
        source: sampleImageDataUrl,
        isOriginalImage: true
      },
      {
        id: "parent",
        type: "entity",
        x: 80,
        y: 60,
        width: 280,
        height: 120,
        entitySchema: "pmt",
        entityName: "Parent",
        fields: [{ name: "ParentId", dataType: "int", isPrimaryKey: true }]
      },
      {
        id: "child",
        type: "entity",
        x: 480,
        y: 300,
        width: 280,
        height: 140,
        entitySchema: "pmt",
        entityName: "Child",
        fields: [
          { name: "ChildId", dataType: "int", isPrimaryKey: true },
          { name: "ParentId", dataType: "int", isForeignKey: true }
        ],
        foreignKeys: [{
          columns: ["ParentId"],
          referencedSchema: "pmt",
          referencedTable: "Parent",
          referencedColumns: ["ParentId"],
          relationshipType: "one-to-many"
        }]
      }
    ]
  });
  const svg = buildAnnotationSvg(state);
  const imageIndex = svg.indexOf(`<image href="${sampleImageDataUrl}"`);
  const relationshipsIndex = svg.indexOf('class="image-annotation-entity-relationships"');
  const parentIndex = svg.indexOf("pmt.Parent");

  assert.ok(imageIndex >= 0);
  assert.ok(relationshipsIndex > imageIndex);
  assert.ok(parentIndex > relationshipsIndex);
});

test("reopening, editing, and applying an inline Diagram preserves Unicode Entity SQL metadata", async () => {
  const svg = buildAnnotationSvg({
    width: 800,
    height: 600,
    objects: [{
      id: "entity-private",
      type: "entity",
      x: 20,
      y: 30,
      width: 320,
      height: 180,
      entitySchema: "pmt",
      entityName: "PrivateNotes",
      sourceText: "CREATE TABLE pmt.PrivateNotes (Title nvarchar(220)); -- 私密",
      fields: [{ name: "Title", dataType: "nvarchar(220)", nullable: false }]
    }]
  }, "");

  const dataUrl = annotationSvgDataUrl(svg);
  assert.match(dataUrl, /^data:image\/svg\+xml;base64,/);

  const response = await fetch(dataUrl, { cache: "no-store", credentials: "same-origin" });
  assert.equal(response.ok, true);
  assert.equal(response.headers.get("content-type"), "image/svg+xml");
  const restoredSvg = await response.text();
  assert.equal(restoredSvg, svg);
  const reopened = parseAnnotationSvg(restoredSvg);
  assert.equal(
    reopened.objects[0].sourceText,
    "CREATE TABLE pmt.PrivateNotes (Title nvarchar(220)); -- 私密"
  );

  reopened.objects[0].fields.push({
    name: "Description",
    dataType: "nvarchar(max)",
    nullable: true
  });
  const editedDataUrl = annotationSvgDataUrl(buildAnnotationSvg(reopened, ""));
  const editedResponse = await fetch(editedDataUrl, { cache: "no-store", credentials: "same-origin" });
  const reapplied = parseAnnotationSvg(await editedResponse.text());

  assert.equal(reapplied.objects[0].sourceText, reopened.objects[0].sourceText);
  assert.deepEqual(
    reapplied.objects[0].fields.map(field => field.name),
    ["Title", "Description"]
  );
});

test("Diagram backing Documents are created once, then updated in place without changing visibility", async () => {
  const appSource = await readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8");
  const createStart = appSource.indexOf("async function createDiagramBackingDocument");
  const updateStart = appSource.indexOf("async function updateDiagramBackingDocument", createStart);
  const end = appSource.indexOf("\nasync function updateDiagramBackingInfo", updateStart);
  const createDiagram = appSource.slice(createStart, updateStart);
  const updateDiagram = appSource.slice(updateStart, end);

  assert.ok(createStart >= 0 && updateStart > createStart && end > updateStart, "Diagram backing Document functions were not found");
  assert.match(createDiagram, /saveJson\("\/api\/blogs",\s*"POST"/);
  assert.match(createDiagram, /isPrivate:\s*sourceDocument \? sourceDocument\.isPrivate !== false : true/);
  assert.match(createDiagram, /uploadedDiagramBackingBodyHtml\(title, diagram\)/);
  assert.match(updateDiagram, /saveJson\(`\/api\/blogs\/\$\{document\.id\}`,\s*"PUT"/);
  assert.match(updateDiagram, /expectedRowVersion:\s*document\.rowVersion/);
  assert.match(updateDiagram, /isPrivate:\s*document\.isPrivate !== false/);
  assert.match(updateDiagram, /uploadedDiagramBackingBodyHtml\(document\.title, diagram\)/);
  assert.match(appSource, /async function uploadedDiagramBackingBodyHtml[\s\S]*uploadFile\([\s\S]*"richtext"/);
  const uploadStart = appSource.indexOf("async function uploadedDiagramBackingBodyHtml");
  const uploadEnd = appSource.indexOf("\nasync function updateDiagramBackingInfo", uploadStart);
  assert.doesNotMatch(appSource.slice(uploadStart, uploadEnd), /data:image\/svg\+xml;base64/);
  assert.equal((createDiagram.match(/saveJson\s*\(/g) || []).length, 1);
  assert.equal((updateDiagram.match(/saveJson\s*\(/g) || []).length, 1);
});

test("editing a stored Diagram and normal RTE annotations both upload before changing the image source", async () => {
  const appSource = await readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8");
  const start = appSource.indexOf("async function annotateRichTextImage(image)");
  const end = appSource.indexOf("\nfunction detailField", start);
  const annotateImage = appSource.slice(start, end);

  assert.ok(start >= 0 && end > start, "annotateRichTextImage was not found");
  assert.doesNotMatch(annotateImage, /pmtDiagram|pmtPrivateDiagram|annotationSvgDataUrl/);
  assert.match(annotateImage, /uploadEmbeddedImage:\s*uploadRichTextCanvasImage/);
  assert.match(annotateImage, /persistCroppedOriginal:\s*uploadRichTextCanvasImage/);
  assert.match(annotateImage, /uploadFile\("richtext", file\)/);
  assert.match(annotateImage, /const annotationSource = appUrl\(upload\.url\)/);
  assert.match(annotateImage, /image\.setAttribute\("src", annotationSource\)/);
  assert.match(annotateImage, /image\.dataset\.pmtAnnotationSource = annotation\.originalReference/);
});

test("RTE Insert Diagram uses the shared blank canvas without a fake Original Image", async () => {
  const appSource = await readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8");
  const formsSource = await readFile(new URL("../../wwwroot/js/components/forms.js", import.meta.url), "utf8");
  const diagramSource = await readFile(new URL("../../wwwroot/js/features/diagram/diagram.js", import.meta.url), "utf8");
  const insertStart = appSource.indexOf("async function insertRichTextDiagram");
  const insertEnd = appSource.indexOf("\nfunction richUploadedDiagramHtml", insertStart);
  const insertDiagram = appSource.slice(insertStart, insertEnd);
  const markupStart = appSource.indexOf("function richUploadedDiagramHtml", insertEnd);
  const markupEnd = appSource.indexOf("\nfunction richUploadedImageHtml", markupStart);
  const insertedMarkup = appSource.slice(markupStart, markupEnd);
  const editStart = diagramSource.indexOf("async function editDiagram");
  const editEnd = diagramSource.indexOf("\n  function bindDiagramTreeSplitter", editStart);
  const editDiagram = diagramSource.slice(editStart, editEnd);

  assert.match(formsSource, /data-command="insertDiagram"[^>]+aria-label="Insert Diagram"/);
  assert.match(insertDiagram, /canvasWidth:\s*1600/);
  assert.match(insertDiagram, /canvasHeight:\s*900/);
  assert.doesNotMatch(insertDiagram, /originalUrl|includeOriginalImage/);
  assert.match(insertDiagram, /uploadFile\("richtext", file\)/);
  assert.match(insertDiagram, /restoreEditorSelection\(savedSelection\)[\s\S]*execCommand\("insertHTML"/);
  assert.match(insertedMarkup, /data-pmt-annotation-version=/);
  assert.doesNotMatch(insertedMarkup, /data-pmt-annotation-source|data-pmt-blank-diagram/);
  assert.match(editDiagram, /canvasWidth:\s*blankDiagramWidth/);
  assert.match(editDiagram, /canvasHeight:\s*blankDiagramHeight/);
  assert.doesNotMatch(editDiagram, /originalUrl|includeOriginalImage/);
});

test("RTE Insert Linked Diagram stores a database-backed Diagram OLE reference", async () => {
  const appSource = await readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8");
  const formsCss = await readFile(new URL("../../wwwroot/css/components/forms.css", import.meta.url), "utf8");
  const formsSource = await readFile(new URL("../../wwwroot/js/components/forms.js", import.meta.url), "utf8");
  const textSource = await readFile(new URL("../../wwwroot/js/shared/text-and-links.js", import.meta.url), "utf8");
  const documentationSource = await readFile(new URL("../../wwwroot/js/features/documentation/documentation.js", import.meta.url), "utf8");
  const scrumSource = await readFile(new URL("../../wwwroot/js/features/scrum/scrum.js", import.meta.url), "utf8");
  const exportSource = await readFile(new URL("../../wwwroot/js/features/documentation/documentation-export.js", import.meta.url), "utf8");
  const viewerStart = appSource.indexOf("function bindRichDiagramOleViewer");
  const viewerEnd = appSource.indexOf("\nfunction clampRichDiagramOleViewport", viewerStart);
  const viewerSource = appSource.slice(viewerStart, viewerEnd);

  assert.match(formsSource, /const linkedDiagramTitle = linkedDiagramDisabled[\s\S]*: "Insert Linked Diagram"/);
  assert.match(formsSource, /data-command="insertLinkedDiagram"[^>]+aria-label="\$\{escapeAttr\(linkedDiagramTitle\)\}"/);
  assert.match(appSource, /if \(command === "insertLinkedDiagram"\)[\s\S]*insertRichLinkedDiagram\(editor, savedSelection\)/);
  assert.match(appSource, /async function insertRichLinkedDiagram/);
  assert.match(appSource, /await loadState\(\)/);
  assert.match(appSource, /data-pmt-ole="diagram"/);
  assert.match(appSource, /data-diagram-id=/);
  assert.match(appSource, /data-active-tab-id=/);
  assert.match(appSource, /data-tabs="\$\{escapeAttr\(JSON\.stringify\(\[tab\]\)\)\}"/);
  assert.match(appSource, /function hydrateRichDiagramOleBlocks/);
  assert.match(appSource, /function ensureRichDiagramOleBlockIds/);
  assert.match(appSource, /function createRichDiagramOleBlockId/);
  assert.match(appSource, /function createRichDiagramOleTabId/);
  assert.match(appSource, /usedBlockIds\.has\(blockId\)/);
  assert.match(appSource, /function refreshRichDiagramOleBlocks/);
  assert.match(appSource, /function clampRichDiagramOleViewport/);
  assert.match(appSource, /function richDiagramOleTabsHtml/);
  assert.match(appSource, /function richDiagramOleTabs/);
  assert.match(appSource, /function richDiagramOleWriteTabs/);
  assert.match(appSource, /const RICH_DIAGRAM_OLE_MIN_ZOOM = 0\.01/);
  assert.match(appSource, /function richDiagramOleInitialViewport/);
  assert.match(appSource, /function richDiagramOleCurrentViewport/);
  assert.match(appSource, /function rememberRichDiagramOleViewport/);
  assert.match(appSource, /function diagramOleViewerSourceUrl/);
  assert.match(appSource, /buildAnnotationSvg\(diagramState,\s*{[\s\S]*entityHeaderButtonsVisible:\s*false/);
  assert.match(appSource, /function refreshRichDiagramOleViewerSource/);
  assert.match(appSource, /data-diagram-ole-fit/);
  assert.match(appSource, /const zoom = clampZoom\(Math\.min\(viewportWidth \/ imageWidth, viewportHeight \/ imageHeight\)\)/);
  assert.doesNotMatch(appSource, /Math\.min\(1,\s*viewportWidth \/ imageWidth,\s*viewportHeight \/ imageHeight\)/);
  assert.match(appSource, /data-diagram-ole-maximize/);
  assert.match(appSource, /data-diagram-ole-add-tab/);
  assert.match(appSource, /data-diagram-ole-rename-tab/);
  assert.match(appSource, /data-diagram-ole-move-tab-left/);
  assert.match(appSource, /data-diagram-ole-move-tab-right/);
  assert.match(appSource, /data-diagram-ole-delete-tab/);
  assert.match(appSource, /Reset to the saved initial view/);
  assert.match(appSource, /data-diagram-ole-change/);
  assert.match(appSource, /data-diagram-ole-delete/);
  assert.match(appSource, /data-diagram-ole-edit-action/);
  assert.match(appSource, /function deleteRichDiagramOleBlock\(editor, block\)/);
  assert.match(appSource, /block\.replaceWith\(blankLine\)/);
  assert.match(appSource, /block\.remove\(\)/);
  assert.match(appSource, /tab\.diagramId = Number\(nextDiagram\.id\)/);
  assert.match(appSource, /askForRichLinkedDiagram\(\{[\s\S]*selectedId:\s*diagram\?\.id \|\| activeTab\?\.diagramId[\s\S]*actionLabel:\s*"Change Tab Diagram"/);
  assert.match(appSource, /showToast\("Linked Diagram tab changed\. Save the record to keep it\."\)/);
  assert.match(appSource, /block\.dataset\.diagramOleHydratedKey === hydratedKey/);
  assert.match(appSource, /bindRichDiagramOleViewer\(block, diagram, activeTab, tabs\);[\s\S]*bindRichDiagramOleResizePersistence\(block, diagram, activeTab\);[\s\S]*return;/);
  assert.match(appSource, /clampRichDiagramOleViewport\(block, viewport, surface, view\)/);
  assert.ok(viewerStart >= 0 && viewerEnd > viewerStart, "bindRichDiagramOleViewer was not found");
  assert.match(viewerSource, /viewport\.addEventListener\("wheel"[\s\S]*event\.preventDefault\(\)[\s\S]*zoomBy/);
  assert.doesNotMatch(viewerSource, /event\.ctrlKey/);
  assert.match(viewerSource, /viewport\.addEventListener\("auxclick"[\s\S]*event\.button !== 1/);
  assert.match(viewerSource, /event\.button !== 0 && event\.button !== 1/);
  assert.match(viewerSource, /richDiagramOlePointerIsInResizeCorner\(block, event\)/);
  assert.match(formsCss, /\.pmt-diagram-ole-viewport\.is-panning/);
  assert.match(formsCss, /\.pmt-diagram-ole\s*{[\s\S]*resize:\s*both;/);
  assert.match(formsCss, /\.pmt-diagram-ole\.is-maximized/);
  assert.match(formsCss, /\.pmt-diagram-ole\.is-maximized\s*{[\s\S]*inset:\s*0;[\s\S]*z-index:\s*calc\(var\(--z-tooltip\) \+ 1\);/);
  assert.match(formsCss, /body\.has-pmt-diagram-ole-maximized\s*{[\s\S]*overflow:\s*hidden;/);
  assert.match(formsCss, /\.pmt-diagram-ole-tabs/);
  assert.doesNotMatch(formsCss, /\.pmt-diagram-ole::after/);
  assert.match(formsCss, /\.pmt-diagram-ole-picker-dialog\s*{[\s\S]*width:\s*calc\(100vw - 24px\);[\s\S]*height:\s*calc\(100vh - 24px\);/);
  assert.match(formsCss, /\.pmt-diagram-ole-picker-dialog\s*{[\s\S]*margin:\s*auto;/);
  assert.match(formsCss, /\.pmt-diagram-ole-picker-list\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(360px, 1fr\)\);/);
  assert.match(formsCss, /\.pmt-diagram-ole-picker-item\s*{[\s\S]*grid-template-rows:\s*minmax\(220px, 1fr\) auto;/);
  assert.match(formsCss, /\.pmt-diagram-ole-picker-thumb img\s*{[\s\S]*max-height:\s*260px;/);
  assert.match(formsCss, /\.pmt-diagram-ole-actions \.pmt-diagram-ole-delete-action:hover/);
  assert.match(appSource, /event\.target\.closest\("\.rich-code-block, \.rich-collapsible-block, \.pmt-diagram-ole"\)/);
  assert.match(appSource, /pmt-diagram-ole:\$\{documentId\}:\$\{diagram\?\.id/);
  assert.match(textSource, /function normalizeDiagramOleBlocksForStorage/);
  assert.match(textSource, /const usedBlockIds = new Set\(\)/);
  assert.match(textSource, /function createDiagramOleBlockId/);
  assert.match(textSource, /function normalizeDiagramOleTabsForStorage/);
  assert.match(textSource, /function normalizeDiagramOleTabForStorage/);
  assert.match(textSource, /data-tabs/);
  assert.match(textSource, /data-active-tab-id/);
  assert.match(textSource, /function diagramOleViewportForStorage/);
  assert.match(textSource, /data-view-x/);
  assert.match(textSource, /data-current-view-x/);
  assert.match(textSource, /removeAttribute\("data-diagram-ole-hydrated-key"\)/);
  assert.match(textSource, /removeAttribute\("data-diagram-ole-viewer-bound"\)/);
  assert.match(textSource, /tabs\.length > 1 \? `\$\{tabs\.length\} Linked Diagrams` : `Linked Diagram #\$\{activeTab\.diagramId\}`/);
  assert.match(documentationSource, /hydrateLinkedDiagrams/);
  assert.match(documentationSource, /hydrateLinkedDiagrams\?\.\(app\)/);
  assert.match(appSource, /createScrumFeature\(\{[\s\S]*hydrateLinkedDiagrams:\s*hydrateRichDiagramOleBlocks/);
  assert.match(scrumSource, /hydrateLinkedDiagrams/);
  assert.match(scrumSource, /hydrateLinkedDiagrams\?\.\(app\);[\s\S]*scheduleScrumAutoRefresh\(\);/);
  assert.match(scrumSource, /app\.querySelector\("\.pmt-diagram-ole-viewport\.is-panning"\)/);
  assert.match(scrumSource, /activeElement\?\.closest\?\.\("\.pmt-diagram-ole"\)/);
  assert.match(exportSource, /resolveDiagramOleBlocksForExport\(body\)/);
  assert.match(exportSource, /function diagramExportSourceUrl/);
});

test("Diagram read and edit viewers use plain mouse wheel zoom", async () => {
  const diagramSource = await readFile(new URL("../../wwwroot/js/features/diagram/diagram.js", import.meta.url), "utf8");
  const annotationSource = await readFile(new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url), "utf8");
  const wheelStart = diagramSource.indexOf("viewport.addEventListener(\"wheel\"");
  const wheelEnd = diagramSource.indexOf("}, { passive: false });", wheelStart);
  const readonlyWheelSource = diagramSource.slice(wheelStart, wheelEnd);

  assert.ok(wheelStart >= 0 && wheelEnd > wheelStart, "read-only Diagram wheel handler was not found");
  assert.match(diagramSource, /Read-only Diagram canvas\. Drag to pan; use mouse wheel to zoom\./);
  assert.match(diagramSource, /wheelZoomsWithoutCtrl:\s*true/);
  assert.match(readonlyWheelSource, /event\.preventDefault\(\)/);
  assert.match(readonlyWheelSource, /scheduleZoom\(previewZoom \+ \(event\.deltaY < 0 \? 0\.05 : -0\.05\)/);
  assert.doesNotMatch(readonlyWheelSource, /ctrlKey/);
  assert.match(annotationSource, /if \(!context\.wheelZoomsWithoutCtrl && !event\.ctrlKey\)/);
  assert.match(annotationSource, /Wheel: zoom at cursor/);
});

test("Diagram read-only context menu toggles connection symbols", async () => {
  const diagramSource = await readFile(new URL("../../wwwroot/js/features/diagram/diagram.js", import.meta.url), "utf8");

  assert.match(diagramSource, /data-diagram-toggle-connection-symbols/);
  assert.match(diagramSource, /role="menuitemcheckbox"/);
  assert.match(diagramSource, /Connection Symbols/);
  assert.match(diagramSource, /function diagramReadonlyImageHtml/);
  assert.match(diagramSource, /const renderReadonlyStateSvg = \(\) => \{/);
  assert.match(diagramSource, /interactiveEntityHeaders:\s*true,\s*[\r\n\s]*interactiveRelationships:\s*true/);
  assert.match(diagramSource, /const checked = readonlyState\?\.relationshipStyle\?\.showSymbols === true/);
  assert.match(diagramSource, /button\.setAttribute\("aria-checked", String\(checked\)\)/);
  assert.match(diagramSource, /button\.querySelector\("\.dropdown-menu-check"\)\.innerHTML = checked \? "&#10003;" : ""/);
  assert.match(diagramSource, /showSymbols:\s*readonlyState\.relationshipStyle\?\.showSymbols !== true/);
  assert.match(diagramSource, /renderReadonlyStateSvg\(\)/);
});

test("RTE Code Block delete removes the block directly and leaves a blank line", async () => {
  const appSource = await readFile(new URL("../../wwwroot/js/app.js", import.meta.url), "utf8");
  const formsCss = await readFile(new URL("../../wwwroot/css/components/forms.css", import.meta.url), "utf8");

  assert.match(appSource, /initializeWindowedDialog\(modal, \{ showResetButton: false \}\)/);
  assert.match(appSource, /data-rich-code-preview/);
  assert.match(appSource, /function openRichCodePreviewDialog/);
  assert.match(appSource, /class="rich-code-preview"/);
  assert.match(formsCss, /\.rich-code-preview-dialog/);
  assert.match(formsCss, /\.rich-code-preview/);
  assert.match(appSource, /function normalizeRichCodeIndentation\(code\)/);
  assert.match(appSource, /const contentLines = lines\.filter\(line => \/\\S\/\.test\(line\)\)/);
  assert.match(appSource, /code: normalizeRichCodeIndentation\(codeTextarea\?\.value \|\| ""\)/);
  assert.match(appSource, /root\.addEventListener\("mousedown", handleRichCodeBlockActionPointerDown, true\)/);
  assert.match(appSource, /function deleteRichCodeBlock\(editor, block\)/);
  assert.match(appSource, /block\.replaceWith\(blankLine\)/);
  assert.match(appSource, /block\.remove\(\)/);
  assert.match(appSource, /editor\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(appSource, /replaceRichNodeWithHtml\(editor, block/);
});

test("Entity Annotation creates one grouped callout and arrow that follow the Entity and survive SVG persistence", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const state = normalizeAnnotationState({
    width: 1800,
    height: 1200,
    objects: [entityObject(definition, "annotated-entity", 100, 160, { height: 720 })]
  });
  const entity = state.objects[0];
  const created = setAnnotationEntityAnnotation(
    state,
    entity,
    "Central work item table.\nChildren point back to this Entity."
  );

  assert.equal(created.createdCount, 2);
  const callout = state.objects.find(object => object.entityAnnotationRole === "callout");
  const arrow = state.objects.find(object => object.entityAnnotationRole === "arrow");
  assert.ok(callout);
  assert.ok(arrow);
  assert.equal(callout.groupId, arrow.groupId);
  assert.equal(callout.entityAnnotationOwnerId, entity.id);
  assert.deepEqual(
    new Set(annotationSelectionIdsForObject(state.objects, callout, state.groupVisibility)),
    new Set([callout.id])
  );
  assert.deepEqual(
    annotationEntityRelationshipRoutingObstacles(state.objects).map(object => object.id),
    [entity.id, callout.id, arrow.id]
  );

  const calloutStart = { x: callout.x, y: callout.y };
  const startBounds = annotationSelectionBounds([entity]);
  moveAnnotationObjects(state, {
    startPoint: { x: startBounds.x, y: startBounds.y },
    startBounds,
    originals: [structuredClone(entity)]
  }, { x: startBounds.x + 80, y: startBounds.y + 40 });
  assert.equal(callout.x, calloutStart.x + 80);
  assert.equal(callout.y, calloutStart.y + 40);

  const entityStart = { x: entity.x, y: entity.y };
  const calloutBounds = annotationSelectionBounds([callout]);
  moveAnnotationObjects(state, {
    startPoint: { x: calloutBounds.x, y: calloutBounds.y },
    startBounds: calloutBounds,
    originals: [structuredClone(callout)]
  }, { x: calloutBounds.x + 30, y: calloutBounds.y + 20 });
  assert.equal(entity.x, entityStart.x + 30);
  assert.equal(entity.y, entityStart.y + 20);
  syncAnnotationEntityAnnotationArrows(state);
  assert.ok(
    arrow.x2 === entity.x || arrow.x2 === entity.x + entity.width
      || arrow.y2 === entity.y || arrow.y2 === entity.y + entity.height,
    "annotation arrow head should terminate on the Entity boundary"
  );

  const restored = parseAnnotationSvg(buildAnnotationSvg(state));
  const restoredEntity = restored.objects.find(object => object.id === entity.id);
  const restoredCallout = restored.objects.find(object => object.entityAnnotationRole === "callout");
  assert.equal(restoredEntity.entityAnnotation, "Central work item table.\nChildren point back to this Entity.");
  assert.equal(restoredCallout.entityAnnotationOwnerId, entity.id);
  assert.equal(restored.groupNames[restoredCallout.groupId], "pmt.WorkTasks Annotation");

  const updated = setAnnotationEntityAnnotation(state, entity, "Updated annotation");
  assert.equal(updated.createdCount, 0);
  assert.equal(state.objects.find(object => object.entityAnnotationRole === "callout").text, "Updated annotation");
  const removed = setAnnotationEntityAnnotation(state, entity, "");
  assert.equal(removed.removedCount, 2);
  assert.equal(state.objects.some(object => object.entityAnnotationOwnerId === entity.id), false);
  assert.equal(entity.entityAnnotation, "");
});

test("Entity relationship routing treats an Entity Annotation callout box as an obstacle", () => {
  const state = entityRelationshipState();
  const workTasks = state.objects.find(object => object.id === "work-tasks");
  setAnnotationEntityAnnotation(state, workTasks, "This callout deliberately occupies the direct FK route.");
  const callout = state.objects.find(object => object.entityAnnotationRole === "callout");
  Object.assign(callout, { x: 620, y: 260, width: 120, height: 300 });
  syncAnnotationEntityAnnotationArrows(state);

  const svg = annotationEntityRelationshipsSvg(state.objects, state.relationshipStyle);
  const path = svg.match(/class="image-annotation-entity-relationship-path" d="([^"]+)"/)?.[1];
  assert.ok(path, "relationship route should still render around the callout");
  const points = orthogonalPathPoints(path);
  points.slice(1).forEach((point, index) => {
    assert.equal(
      orthogonalSegmentIntersectsEntityInterior(points[index], point, callout),
      false,
      "relationship route must not pass behind the Entity Annotation callout"
    );
  });
});

test("Entity Annotation can render without an arrow directly over the Entity", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const state = normalizeAnnotationState({
    width: 900,
    height: 600,
    objects: [entityObject(definition, "annotated-entity", 100, 160, { height: 360 })]
  });
  const entity = state.objects[0];
  setAnnotationEntityAnnotation(state, entity, "Overlay annotation", { showArrow: false });

  const callout = state.objects.find(object => object.entityAnnotationRole === "callout");
  assert.ok(callout);
  assert.equal(state.objects.some(object => object.entityAnnotationRole === "arrow"), false);
  assert.equal(entity.entityAnnotationShowArrow, false);
  assert.equal(callout.x, entity.x);
  assert.equal(callout.y, entity.y);
  assert.equal(callout.groupId, entity.groupId);

  const restored = parseAnnotationSvg(buildAnnotationSvg(state));
  assert.equal(restored.objects.find(object => object.type === "entity").entityAnnotationShowArrow, false);
  assert.equal(restored.objects.some(object => object.entityAnnotationRole === "arrow"), false);

  setAnnotationEntityAnnotation(state, entity, "Overlay annotation with arrow", { showArrow: true });
  assert.ok(state.objects.find(object => object.entityAnnotationRole === "arrow"));
  assert.equal(entity.entityAnnotationShowArrow, true);
});

test("Entity name and header colors render independently, round trip, and apply from templates", () => {
  const definition = parseAnnotationEntityDefinition(workTasksCreateTableSql);
  const source = entityObject(definition, "colored-source", 40, 80, {
    entityNameTextColor: "#fedcba",
    entityHeaderFill: "#123456"
  });
  const state = normalizeAnnotationState({ width: 1200, height: 900, objects: [source] });
  const svg = buildAnnotationSvg(state);
  assert.match(svg, /<rect\b[^>]*x="40"[^>]*y="80"[^>]*fill="#123456"/);
  assert.match(svg, /<text\b[^>]*fill="#fedcba"[^>]*>pmt\.WorkTasks<\/text>/);

  const restored = parseAnnotationSvg(svg).objects[0];
  assert.equal(restored.entityNameTextColor, "#fedcba");
  assert.equal(restored.entityHeaderFill, "#123456");

  const template = captureAnnotationTemplate(state, [source.id], "", "Colored Entity");
  const destination = entityObject(definition, "colored-destination", 700, 80, {
    entityNameTextColor: "#172b4d",
    entityHeaderFill: "#ffffff"
  });
  const applied = applyAnnotationTemplateFormatting(template, [destination]);
  assert.equal(applied.appliedCount, 1);
  assert.equal(destination.entityNameTextColor, "#fedcba");
  assert.equal(destination.entityHeaderFill, "#123456");
});

test("the global relationship-line switch persists and removes routes, markers, and interaction hits", async () => {
  const state = entityRelationshipState({ showSymbols: true });
  state.hideAllEntityRelationships = true;
  const svg = buildAnnotationSvg(state);
  assert.match(svg, />pmt\.WorkTasks<\/text>/);
  assert.doesNotMatch(svg, /class="image-annotation-entity-relationship-path"/);
  assert.doesNotMatch(svg, /class="image-annotation-entity-relationship-marker"/);
  assert.doesNotMatch(svg, /class="image-annotation-entity-relationship-hit"/);
  assert.equal(parseAnnotationSvg(svg).hideAllEntityRelationships, true);
  assert.equal(annotationEntityRelationshipsSvg(state.objects, state.relationshipStyle, { hidden: true }), "");

  const componentSource = await readFile(
    new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url),
    "utf8"
  );
  assert.match(componentSource, /Turn off all relationship lines \(global\)/);
  assert.match(componentSource, /data-annotation-entity-annotation/);
  assert.match(componentSource, /Show Original Script/);
  assert.match(componentSource, /data-annotation-entity-show-script/);
  assert.match(componentSource, /Manual relationship lines/);
  assert.match(componentSource, /data-annotation-entity-clear-manual-relationship-routes/);
  assert.match(componentSource, /Auto Format - Compact/);
  assert.match(componentSource, /relationship-segment/);
  assert.match(componentSource, /objectAlreadySelected && selectedIds\.size > objectSelectionIds\.length/);
  assert.match(componentSource, /Entity name text color/);
  assert.match(componentSource, /Header background color/);
});

test("textbox double-click opens a text edit dialog instead of live-editing the canvas", async () => {
  const componentSource = await readFile(
    new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url),
    "utf8"
  );
  assert.match(
    componentSource,
    /const askAnnotationText = \(\{ title, label, value,[\s\S]*textarea name="annotationText"/
  );
  assert.match(
    componentSource,
    /if \(object\.type === "textbox"\)[\s\S]*askAnnotationText\(\{[\s\S]*title: "Text Box"[\s\S]*object\.text = result\.text[\s\S]*pushHistory\(\)[\s\S]*renderWithWorkspaceExpansion\(\)/
  );
});

test("rich-text Diagram objects render on the canvas and round-trip editable HTML", () => {
  const state = normalizeAnnotationState({
    width: 900,
    height: 600,
    objects: [{
      id: "tutorial-rich-text",
      type: "rich-text",
      x: 80,
      y: 60,
      width: 420,
      height: 220,
      fill: "none",
      stroke: "#42526b",
      strokeWidth: 2,
      html: `<p><strong>Tutorial note</strong></p><details class="rich-code-block" open><summary>SQL</summary><pre><code><span class="rich-source-token-keyword">SELECT</span> 1<br></code></pre></details><script>alert("bad")</script>`
    }]
  });

  const svg = buildAnnotationSvg(state);
  assert.match(svg, /<foreignObject\b/);
  assert.match(svg, /class="image-annotation-rich-text-surface rich-readonly"/);
  assert.match(svg, /rich-source-token-keyword/);
  assert.doesNotMatch(svg, /<script/i);

  const restored = parseAnnotationSvg(svg).objects[0];
  assert.equal(restored.type, "rich-text");
  assert.match(restored.html, /Tutorial note/);
  assert.match(restored.html, /rich-code-block/);
  assert.doesNotMatch(restored.html, /<script/i);
});

test("rich-text Diagram editor surface participates in object double-click hit testing", async () => {
  const componentSource = await readFile(
    new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url),
    "utf8"
  );
  const formsSource = await readFile(
    new URL("../../wwwroot/js/components/forms.js", import.meta.url),
    "utf8"
  );
  assert.match(componentSource, /const richTextHitAttributes = `\$\{attributes\.id\}\$\{attributes\.type\}`/);
  assert.match(componentSource, /<foreignObject\$\{richTextHitAttributes\}/);
  assert.match(componentSource, /<div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"\$\{richTextHitAttributes\}/);
  assert.match(componentSource, /richTextToolsHtml\(\{[\s\S]*disableLinkedDiagram: true[\s\S]*Linked Diagram OLE is not supported inside Diagram Rich Text\./);
  assert.match(formsSource, /const linkedDiagramDisabled = options\.disableLinkedDiagram === true/);
  assert.match(formsSource, /data-command-disabled-reason="\$\{escapeAttr\(linkedDiagramTitle\)\}"/);
  assert.match(componentSource, /const topmostRichTextObjectAtPoint = point =>/);
  assert.match(componentSource, /return topmostRichTextObjectAtPoint\(point \|\| canvasPoint\(event\)\)/);
  assert.match(componentSource, /workspace\.addEventListener\("dblclick"[\s\S]*await editAnnotationObject\(object\)/);
  assert.match(
    componentSource,
    /if \(object\.type === "rich-text"\)[\s\S]*askAnnotationRichText\(\{[\s\S]*object\.html = result\.html[\s\S]*setStatus\("Rich text updated\."\)/
  );
});

test("Diagram editor status text lives in the Format tab instead of the canvas toolbar", async () => {
  const componentSource = await readFile(
    new URL("../../wwwroot/js/components/image-annotation.js", import.meta.url),
    "utf8"
  );
  const cssSource = await readFile(
    new URL("../../wwwroot/css/components/image-annotation.css", import.meta.url),
    "utf8"
  );
  assert.match(componentSource, /class="image-annotation-format-status" data-annotation-status/);
  assert.match(componentSource, /const statusRegions = \[\.\.\.dialog\.querySelectorAll\("\[data-annotation-status\]"\)\]/);
  assert.doesNotMatch(componentSource, /data-annotation-maximized-status/);
  assert.match(componentSource, /data-annotation-footer-status aria-hidden="true"/);
  assert.match(cssSource, /\.image-annotation-format-status[\s\S]*min-height:/);
});
