import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  autoFormatAnnotationEntitiesOrgTree,
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../wwwroot/js/components/image-annotation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = resolve(root, "SQL/03_SeedData_DiagramDemo.sql");
const svgAssetPath = resolve(root, "wwwroot/assets/docs/pmt-database-schema.svg");
const optionalSvgOutputPath = String(process.env.PMT_SCHEMA_DIAGRAM_SVG_OUTPUT || "").trim();
const sqlServer = process.env.PMT_SQL_SERVER || "localhost";
const sqlDatabase = process.env.PMT_SQL_DATABASE || "PMT";

const descriptions = {
  Attachments: "Uploaded-file metadata shared by tasks and documentation.",
  AttendanceEntries: "Per-user daily attendance status and its audit ownership.",
  AuditEvents: "Immutable activity details for task and other business changes.",
  BlogAttachments: "Joins Documentation and Diagram records to uploaded files.",
  BlogHistory: "Tracks Documentation and Diagram create, update, and move actions.",
  Blogs: "Stores Documentation and Diagram content, hierarchy, visibility, pins, and order.",
  DevLogs: "Personal and Scrum log entries, optionally scoped to a Project.",
  Holidays: "Non-working dates used by PMT planning and calendar features.",
  ImageAnnotationDefaultTemplateLibraries: "Shared default annotation-template library for every installation.",
  Lookups: "Configurable statuses, priorities, roles, and other shared choices.",
  ProjectMembers: "Assigns users to Projects and records membership ownership.",
  Projects: "Top-level delivery areas that organize Sprints, tasks, logs, and documents.",
  RolePermissions: "Default PMT feature rights granted to each role.",
  SecurityResources: "Catalog of PMT screens and the rights each screen supports.",
  SprintMembers: "Assigns users to individual Sprints within a Project.",
  Sprints: "Time-boxed delivery periods belonging to Projects.",
  TaskAssignees: "Many-to-many assignment of users responsible for work items.",
  TaskAttachments: "Joins work items to uploaded-file metadata.",
  TaskDependencies: "Maps work items to the other work items they depend on.",
  TaskReporters: "Many-to-many assignment of users reporting or tracking work items.",
  UserImageAnnotationTemplateLibraries: "Each user's saved annotation and ERD templates.",
  UserInvitationProjects: "Projects granted by a pending user invitation.",
  UserInvitations: "Secure, expiring invitations used to onboard PMT users.",
  UserLoginActivity: "One-to-one record of a user's latest successful sign-in.",
  UserPermissions: "Per-user overrides to role-based PMT feature rights.",
  Users: "PMT identities, profiles, roles, authentication, and audit ownership.",
  VacationPlans: "Planned user leave ranges shown by Scrum and scheduling views.",
  WfhSchedules: "One-to-one weekly work-from-home availability for each user.",
  WorkTasks: "Central PMT work item for Dev Tasks, bugs, hierarchy, and delivery status."
};

function queryJson(query) {
  const output = execFileSync(
    "sqlcmd",
    ["-S", sqlServer, "-d", sqlDatabase, "-E", "-C", "-y", "0", "-Q", query],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  ).trim();
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error(`SQL metadata query did not return JSON.\n${output}`);
  return JSON.parse(output.slice(start, end + 1));
}

const columns = queryJson(String.raw`
SET NOCOUNT ON;
SELECT
(
    SELECT
        [Schema].[name] AS [schemaName],
        [Table].[name] AS [tableName],
        [Column].[column_id] AS [columnOrder],
        [Column].[name] AS [columnName],
        [Type].[name] AS [typeName],
        [Column].[max_length] AS [maxLength],
        [Column].[precision] AS [precision],
        [Column].[scale] AS [scale],
        CONVERT(BIT, [Column].[is_nullable]) AS [nullable],
        CONVERT(BIT, [Column].[is_identity]) AS [isIdentity],
        CONVERT(NVARCHAR(80), [Identity].[seed_value]) AS [identitySeed],
        CONVERT(NVARCHAR(80), [Identity].[increment_value]) AS [identityIncrement],
        CONVERT(BIT, CASE WHEN EXISTS
        (
            SELECT 1
            FROM sys.indexes AS [Index]
            INNER JOIN sys.index_columns AS [IndexColumn]
                ON [IndexColumn].[object_id] = [Index].[object_id]
               AND [IndexColumn].[index_id] = [Index].[index_id]
            WHERE [Index].[object_id] = [Column].[object_id]
              AND [Index].[is_primary_key] = 1
              AND [IndexColumn].[column_id] = [Column].[column_id]
        ) THEN 1 ELSE 0 END) AS [isPrimaryKey],
        CONVERT(BIT, CASE WHEN EXISTS
        (
            SELECT 1
            FROM sys.foreign_key_columns AS [ForeignKeyColumn]
            WHERE [ForeignKeyColumn].[parent_object_id] = [Column].[object_id]
              AND [ForeignKeyColumn].[parent_column_id] = [Column].[column_id]
        ) THEN 1 ELSE 0 END) AS [isForeignKey]
    FROM sys.tables AS [Table]
    INNER JOIN sys.schemas AS [Schema]
        ON [Schema].[schema_id] = [Table].[schema_id]
    INNER JOIN sys.columns AS [Column]
        ON [Column].[object_id] = [Table].[object_id]
    INNER JOIN sys.types AS [Type]
        ON [Type].[user_type_id] = [Column].[user_type_id]
    LEFT JOIN sys.identity_columns AS [Identity]
        ON [Identity].[object_id] = [Column].[object_id]
       AND [Identity].[column_id] = [Column].[column_id]
    WHERE [Schema].[name] = N'pmt'
      AND [Table].[is_ms_shipped] = 0
    ORDER BY [Table].[name], [Column].[column_id]
    FOR JSON PATH
) AS [JsonValue];`);

const foreignKeyRows = queryJson(String.raw`
SET NOCOUNT ON;
SELECT
(
    SELECT
        [ParentSchema].[name] AS [schemaName],
        [ParentTable].[name] AS [tableName],
        [ForeignKey].[name] AS [foreignKeyName],
        [ForeignKeyColumn].[constraint_column_id] AS [columnOrder],
        [ParentColumn].[name] AS [columnName],
        [ReferencedSchema].[name] AS [referencedSchema],
        [ReferencedTable].[name] AS [referencedTable],
        [ReferencedColumn].[name] AS [referencedColumn]
    FROM sys.foreign_keys AS [ForeignKey]
    INNER JOIN sys.foreign_key_columns AS [ForeignKeyColumn]
        ON [ForeignKeyColumn].[constraint_object_id] = [ForeignKey].[object_id]
    INNER JOIN sys.tables AS [ParentTable]
        ON [ParentTable].[object_id] = [ForeignKey].[parent_object_id]
    INNER JOIN sys.schemas AS [ParentSchema]
        ON [ParentSchema].[schema_id] = [ParentTable].[schema_id]
    INNER JOIN sys.columns AS [ParentColumn]
        ON [ParentColumn].[object_id] = [ForeignKeyColumn].[parent_object_id]
       AND [ParentColumn].[column_id] = [ForeignKeyColumn].[parent_column_id]
    INNER JOIN sys.tables AS [ReferencedTable]
        ON [ReferencedTable].[object_id] = [ForeignKey].[referenced_object_id]
    INNER JOIN sys.schemas AS [ReferencedSchema]
        ON [ReferencedSchema].[schema_id] = [ReferencedTable].[schema_id]
    INNER JOIN sys.columns AS [ReferencedColumn]
        ON [ReferencedColumn].[object_id] = [ForeignKeyColumn].[referenced_object_id]
       AND [ReferencedColumn].[column_id] = [ForeignKeyColumn].[referenced_column_id]
    WHERE [ParentSchema].[name] = N'pmt'
    ORDER BY [ParentTable].[name], [ForeignKey].[name], [ForeignKeyColumn].[constraint_column_id]
    FOR JSON PATH
) AS [JsonValue];`);

function formatDataType(column) {
  const type = String(column.typeName || "").toUpperCase();
  if (["CHAR", "VARCHAR", "BINARY", "VARBINARY"].includes(type)) {
    return `${type}(${column.maxLength === -1 ? "MAX" : column.maxLength})`;
  }
  if (["NCHAR", "NVARCHAR"].includes(type)) {
    return `${type}(${column.maxLength === -1 ? "MAX" : column.maxLength / 2})`;
  }
  if (["DECIMAL", "NUMERIC"].includes(type)) return `${type}(${column.precision},${column.scale})`;
  if (["DATETIME2", "DATETIMEOFFSET", "TIME"].includes(type)) return `${type}(${column.scale})`;
  return type;
}

const tables = new Map();
columns.forEach(column => {
  const key = `${column.schemaName}.${column.tableName}`;
  if (!tables.has(key)) tables.set(key, { schema: column.schemaName, name: column.tableName, fields: [], foreignKeys: [] });
  const identity = column.isIdentity
    ? `IDENTITY(${column.identitySeed || 1},${column.identityIncrement || 1})`
    : "";
  tables.get(key).fields.push({
    name: column.columnName,
    dataType: formatDataType(column),
    nullable: column.nullable === true,
    isPrimaryKey: column.isPrimaryKey === true,
    isForeignKey: column.isForeignKey === true,
    isImportant: column.isPrimaryKey === true || ["Name", "Title", "Code", "Status", "Value"].includes(column.columnName),
    isIdentity: column.isIdentity === true,
    identity
  });
});

// Version 1.23 adds SortOrder to deployed Blogs after RowVersion, while a fresh
// database creates it beside the other tree controls. Keep one logical Diagram
// order for both installation paths.
const blogFields = tables.get("pmt.Blogs")?.fields || [];
const blogSortOrderIndex = blogFields.findIndex(field => field.name === "SortOrder");
const blogPinnedIndex = blogFields.findIndex(field => field.name === "IsPinned");
if (blogSortOrderIndex >= 0 && blogPinnedIndex >= 0 && blogSortOrderIndex !== blogPinnedIndex + 1) {
  const [sortOrder] = blogFields.splice(blogSortOrderIndex, 1);
  blogFields.splice(blogPinnedIndex + 1, 0, sortOrder);
}

const foreignKeys = new Map();
foreignKeyRows.forEach(row => {
  const key = `${row.schemaName}.${row.tableName}.${row.foreignKeyName}`;
  if (!foreignKeys.has(key)) {
    foreignKeys.set(key, {
      schemaName: row.schemaName,
      tableName: row.tableName,
      name: row.foreignKeyName,
      columns: [],
      referencedSchema: row.referencedSchema,
      referencedTable: row.referencedTable,
      referencedColumns: []
    });
  }
  foreignKeys.get(key).columns.push(row.columnName);
  foreignKeys.get(key).referencedColumns.push(row.referencedColumn);
});

foreignKeys.forEach(foreignKey => {
  const table = tables.get(`${foreignKey.schemaName}.${foreignKey.tableName}`);
  const primaryKeys = table.fields.filter(field => field.isPrimaryKey).map(field => field.name);
  const isOneToOne = primaryKeys.length === foreignKey.columns.length
    && primaryKeys.every(column => foreignKey.columns.includes(column));
  table.foreignKeys.push({
    name: foreignKey.name,
    columns: foreignKey.columns,
    referencedSchema: foreignKey.referencedSchema,
    referencedTable: foreignKey.referencedTable,
    referencedColumns: foreignKey.referencedColumns,
    relationshipType: isOneToOne ? "one-to-one" : "one-to-many"
  });
});

function createSourceText(table) {
  const lines = table.fields.map(field => {
    const identity = field.identity ? ` ${field.identity}` : "";
    const primaryKey = field.isPrimaryKey ? " PRIMARY KEY" : "";
    return `    ${field.name} ${field.dataType}${identity} ${field.nullable ? "NULL" : "NOT NULL"}${primaryKey}`;
  });
  table.foreignKeys.forEach(foreignKey => {
    lines.push(`    CONSTRAINT ${foreignKey.name} FOREIGN KEY (${foreignKey.columns.join(", ")}) REFERENCES ${foreignKey.referencedSchema}.${foreignKey.referencedTable} (${foreignKey.referencedColumns.join(", ")})`);
  });
  return `CREATE TABLE ${table.schema}.${table.name} (\n${lines.join(",\n")}\n);`;
}

function compactEntityWidth(table, fontSize) {
  const longestField = Math.max(...table.fields.map(field => field.name.length), 1);
  const keyColumnWidth = Math.max(42, fontSize * 2.8);
  const padding = Math.max(7, fontSize * 0.5);
  const fieldWidth = Math.max(180, (longestField * fontSize * 0.62) + (padding * 2));
  const entityName = `${table.schema}.${table.name}`;
  const headerHeight = Math.max(28, fontSize * 1.85);
  const titleWidth = (entityName.length * fontSize * 1.05 * 0.62) + (headerHeight * 2.4);
  return Math.ceil(Math.max(240, keyColumnWidth + fieldWidth, titleWidth));
}

const fontSize = 12;
const rowHeight = Math.max(23, fontSize * 1.45);
const headerHeight = Math.max(28, fontSize * 1.85);
const entities = [...tables.values()]
  .sort((left, right) => left.name.localeCompare(right.name))
  .map(table => {
    const width = compactEntityWidth(table, fontSize);
    const height = headerHeight + (table.fields.length * rowHeight);
    return {
      id: `entity-pmt-${table.name.toLowerCase()}`,
      type: "entity",
      name: `pmt.${table.name}`,
      locked: false,
      groupId: "",
      visible: true,
      x: 240,
      y: 380,
      width,
      height,
      expandedHeight: height,
      fill: "#ffffff",
      stroke: "#42526b",
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1,
      textColor: "#172b4d",
      fontFamily: "Arial",
      fontSize,
      entitySchema: table.schema,
      entityName: table.name,
      fields: table.fields,
      foreignKeys: table.foreignKeys,
      foreignKeysAtTop: false,
      showSelfRelationships: false,
      anchorTable: false,
      collapsed: false,
      sourceText: createSourceText(table),
      showKeyColumn: true,
      showDataTypes: false,
      dataTypeExpandedWidth: width + 245
    };
  });

const layout = autoFormatAnnotationEntitiesOrgTree(entities, {
  preferredRootId: "entity-pmt-worktasks",
  allowOverlappingLines: false
});

const minX = Math.min(...entities.map(entity => entity.x));
const maxX = Math.max(...entities.map(entity => entity.x + entity.width));
const maxY = Math.max(...entities.map(entity => entity.y + entity.height));
const titleWidth = Math.min(1200, Math.max(840, maxX - minX));
const title = {
  id: "textbox-pmt-diagram-tool-title",
  type: "textbox",
  name: "Diagram Title",
  locked: false,
  groupId: "",
  visible: true,
  x: minX + ((maxX - minX - titleWidth) / 2),
  y: 40,
  width: titleWidth,
  height: 110,
  fill: "none",
  stroke: "#42526b",
  outlineVisible: false,
  strokeWidth: 2,
  opacity: 1,
  text: "PMT's Diagram Tool by Sin",
  textColor: "#172b4d",
  fontFamily: "Arial",
  fontSize: 64,
  textAlign: "center",
  textVerticalAlign: "middle"
};

const descriptionObjects = entities.flatMap(entity => {
  const tableName = entity.entityName;
  const centerX = entity.x + (entity.width / 2);
  return [
    {
      id: `description-pmt-${tableName.toLowerCase()}`,
      type: "textbox",
      name: `${tableName} Description`,
      locked: false,
      groupId: "entity-descriptions",
      visible: true,
      x: entity.x,
      y: entity.y - 132,
      width: entity.width,
      height: 82,
      fill: "#eaf2ff",
      stroke: "#5b6b82",
      outlineVisible: true,
      strokeWidth: 2,
      opacity: 1,
      text: descriptions[tableName] || `PMT application data stored by pmt.${tableName}.`,
      textColor: "#172b4d",
      fontFamily: "Arial",
      fontSize: 14,
      textAlign: "center",
      textVerticalAlign: "middle"
    },
    {
      id: `description-arrow-pmt-${tableName.toLowerCase()}`,
      type: "arrow",
      name: `${tableName} Description Arrow`,
      locked: false,
      groupId: "entity-descriptions",
      visible: true,
      x1: centerX,
      y1: entity.y - 44,
      x2: centerX,
      y2: entity.y - 8,
      stroke: "#e07b39",
      strokeWidth: 3,
      arrowSize: 14,
      opacity: 1
    }
  ];
});

const state = normalizeAnnotationState({
  width: Math.ceil(maxX + 240),
  height: Math.ceil(maxY + 240),
  sourceWidth: Math.ceil(maxX + 240),
  sourceHeight: Math.ceil(maxY + 240),
  originalReference: "",
  includeOriginalImage: false,
  gridVisible: false,
  snapToGrid: false,
  allowOverlappingEntityLines: false,
  gridSize: 20,
  imageClip: {
    x: 0,
    y: 0,
    width: Math.ceil(maxX + 240),
    height: Math.ceil(maxY + 240)
  },
  relationshipStyle: {
    stroke: "#42526b",
    strokeWidth: 2,
    arrowSize: 14
  },
  groupNames: {
    "entity-descriptions": "Entity Descriptions"
  },
  groupVisibility: {
    "entity-descriptions": true
  },
  objects: [...entities, ...descriptionObjects, title]
});

const svg = `${buildAnnotationSvg(state, "")}\n`;
const relationshipCount = (svg.match(/data-pmt-relationship-source=/g) || []).length;
const fieldCount = entities.reduce((total, entity) => total + entity.fields.length, 0);
const hiddenSelfRelationshipCount = [...foreignKeys.values()]
  .filter(foreignKey => foreignKey.schemaName === foreignKey.referencedSchema
    && foreignKey.tableName === foreignKey.referencedTable)
  .length;
if (entities.length !== 29) throw new Error(`Expected 29 PMT tables, found ${entities.length}.`);
if (fieldCount !== 276) throw new Error(`Expected 276 PMT table fields, found ${fieldCount}. Run the Version 1.23 source schema before regenerating.`);
if (foreignKeys.size !== 82) throw new Error(`Expected 82 PMT foreign keys, found ${foreignKeys.size}.`);
if (relationshipCount !== foreignKeys.size - hiddenSelfRelationshipCount) {
  throw new Error(`Expected ${foreignKeys.size - hiddenSelfRelationshipCount} visible relationships after hiding self-references, rendered ${relationshipCount}.`);
}

const sqlLiteral = value => String(value).replaceAll("'", "''");
const svgVersion = createHash("sha256").update(svg).digest("hex").slice(0, 12);
const svgAssetUrl = `/assets/docs/pmt-database-schema.svg?v=${svgVersion}`;
const generatedSql = [
  "DECLARE @DatabaseSchemaDiagramBodyHtml NVARCHAR(MAX) =",
  `    N'<p><img class="rich-svg-image pmt-annotation-image" src="${sqlLiteral(svgAssetUrl)}" alt="PMT''s Database Schema" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-database-schema-v1" data-pmt-annotation-version="1"></p>';`
].join("\n");
const beginMarker = "-- BEGIN GENERATED PMT DATABASE SCHEMA DIAGRAM";
const endMarker = "-- END GENERATED PMT DATABASE SCHEMA DIAGRAM";
const generatedBlock = `${beginMarker}\n${generatedSql}\n${endMarker}`;

const seedSource = readFileSync(seedPath, "utf8");
const seedStart = seedSource.indexOf(beginMarker);
const seedEnd = seedSource.indexOf(endMarker, seedStart);
if (seedStart < 0 || seedEnd < seedStart) {
  throw new Error(`Generated Diagram markers were not found in ${seedPath}.`);
}
writeFileSync(seedPath, `${seedSource.slice(0, seedStart)}${generatedBlock}${seedSource.slice(seedEnd + endMarker.length)}`, "utf8");

mkdirSync(dirname(svgAssetPath), { recursive: true });
writeFileSync(svgAssetPath, svg, "utf8");

if (optionalSvgOutputPath) {
  mkdirSync(dirname(optionalSvgOutputPath), { recursive: true });
  writeFileSync(optionalSvgOutputPath, svg, "utf8");
  console.log(`Generated SVG preview ${optionalSvgOutputPath}`);
}
console.log(`Generated editable SVG asset ${svgAssetPath}`);
console.log(`Stored ${svgAssetUrl} in ${seedPath}. Add or update the active forward migration separately.`);
console.log(`${entities.length} entities; ${fieldCount} fields; ${foreignKeys.size} foreign keys; ${relationshipCount} visible relationship lines; ${layout.levelCount} hierarchy levels.`);
