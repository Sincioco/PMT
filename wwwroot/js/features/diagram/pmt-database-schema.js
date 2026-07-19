import {
  autoFormatAnnotationEntitiesOrgTree,
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../../components/image-annotation.js?v=20260719-vector-zoom-v15";

const schemaTitle = "PMT's Diagram Tool by Sin";
const schemaDiagramName = "PMT's Database Schema";
const schemaRelationshipStyle = {
  stroke: "#42526b",
  strokeWidth: 2,
  arrowSize: 14,
  showSymbols: false
};

export function buildPmtDatabaseSchemaDiagram(schemaInput) {
  const schema = normalizeSchema(schemaInput);
  if (!schema.columns.length) throw new Error("The PMT database did not return any table columns.");

  const tables = groupTables(schema.columns);
  addForeignKeys(tables, schema.foreignKeys);
  const entities = [...tables.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(createEntity);

  autoFormatAnnotationEntitiesOrgTree(entities, {
    preferredRootId: entities.find(entity => entity.entityName === "WorkTasks")?.id || entities[0]?.id,
    allowOverlappingLines: false,
    relationshipStyle: schemaRelationshipStyle,
    gridSize: 20
  });

  const minX = Math.min(...entities.map(entity => entity.x));
  const maxX = Math.max(...entities.map(entity => entity.x + entity.width));
  const maxY = Math.max(...entities.map(entity => entity.y + entity.height));
  const titleWidth = Math.min(1200, Math.max(840, maxX - minX));
  const width = Math.ceil(maxX + 240);
  const height = Math.ceil(maxY + 240);
  const state = normalizeAnnotationState({
    width,
    height,
    sourceWidth: width,
    sourceHeight: height,
    originalReference: "",
    gridVisible: false,
    snapToGrid: false,
    allowOverlappingEntityLines: false,
    gridSize: 20,
    relationshipStyle: schemaRelationshipStyle,
    objects: [
      ...entities,
      {
        id: "textbox-pmt-database-schema-title",
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
        text: schemaTitle,
        textColor: "#172b4d",
        fontFamily: "Arial",
        fontSize: 64,
        textAlign: "center",
        textVerticalAlign: "middle"
      }
    ]
  });

  return {
    title: schemaDiagramName,
    state,
    svg: buildAnnotationSvg(state),
    fileName: "pmt-database-schema.svg"
  };
}

function normalizeSchema(input) {
  const schema = input && typeof input === "object" ? input : {};
  return {
    columns: Array.isArray(schema.columns) ? schema.columns : [],
    foreignKeys: Array.isArray(schema.foreignKeys) ? schema.foreignKeys : []
  };
}

function groupTables(columns) {
  const tables = new Map();
  columns.forEach(column => {
    const schemaName = String(column.schemaName || "pmt");
    const tableName = String(column.tableName || "").trim();
    const columnName = String(column.columnName || "").trim();
    if (!tableName || !columnName) return;

    const key = tableKey(schemaName, tableName);
    if (!tables.has(key)) {
      tables.set(key, { schema: schemaName, name: tableName, fields: [], foreignKeys: [] });
    }
    const identity = column.isIdentity === true
      ? `IDENTITY(${column.identitySeed || 1},${column.identityIncrement || 1})`
      : "";
    tables.get(key).fields.push({
      name: columnName,
      dataType: formatDataType(column),
      nullable: column.nullable === true,
      isPrimaryKey: column.isPrimaryKey === true,
      isForeignKey: column.isForeignKey === true,
      isImportant: column.isPrimaryKey === true || ["Name", "Title", "Code", "Status", "Value"].includes(columnName),
      isIdentity: column.isIdentity === true,
      identity
    });
  });
  return tables;
}

function addForeignKeys(tables, foreignKeyRows) {
  const foreignKeys = new Map();
  foreignKeyRows.forEach(row => {
    const schemaName = String(row.schemaName || "pmt");
    const tableName = String(row.tableName || "");
    const foreignKeyName = String(row.foreignKeyName || "");
    if (!tableName || !foreignKeyName) return;

    const key = `${tableKey(schemaName, tableName)}.${foreignKeyName.toLowerCase()}`;
    if (!foreignKeys.has(key)) {
      foreignKeys.set(key, {
        schemaName,
        tableName,
        name: foreignKeyName,
        columns: [],
        referencedSchema: String(row.referencedSchema || "pmt"),
        referencedTable: String(row.referencedTable || ""),
        referencedColumns: []
      });
    }
    foreignKeys.get(key).columns.push(String(row.columnName || ""));
    foreignKeys.get(key).referencedColumns.push(String(row.referencedColumn || ""));
  });

  foreignKeys.forEach(foreignKey => {
    const table = tables.get(tableKey(foreignKey.schemaName, foreignKey.tableName));
    if (!table || !tables.has(tableKey(foreignKey.referencedSchema, foreignKey.referencedTable))) return;
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
}

function createEntity(table) {
  const fontSize = 12;
  const rowHeight = Math.max(23, fontSize * 1.45);
  const headerHeight = Math.max(28, fontSize * 1.85);
  const width = compactEntityWidth(table, fontSize);
  const height = headerHeight + (table.fields.length * rowHeight);
  return {
    id: `entity-${safeId(table.schema)}-${safeId(table.name)}`,
    type: "entity",
    name: `${table.schema}.${table.name}`,
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

function createSourceText(table) {
  const lines = table.fields.map(field => {
    const identity = field.identity ? ` ${field.identity}` : "";
    const primaryKey = field.isPrimaryKey ? " PRIMARY KEY" : "";
    return `    ${sqlIdentifier(field.name)} ${field.dataType}${identity} ${field.nullable ? "NULL" : "NOT NULL"}${primaryKey}`;
  });
  table.foreignKeys.forEach(foreignKey => {
    lines.push(`    CONSTRAINT ${sqlIdentifier(foreignKey.name)} FOREIGN KEY (${foreignKey.columns.map(sqlIdentifier).join(", ")}) REFERENCES ${sqlIdentifier(foreignKey.referencedSchema)}.${sqlIdentifier(foreignKey.referencedTable)} (${foreignKey.referencedColumns.map(sqlIdentifier).join(", ")})`);
  });
  return `CREATE TABLE ${sqlIdentifier(table.schema)}.${sqlIdentifier(table.name)} (\n${lines.join(",\n")}\n);`;
}

function formatDataType(column) {
  const type = String(column.typeName || "").toUpperCase();
  const maxLength = Number(column.maxLength);
  if (["CHAR", "VARCHAR", "BINARY", "VARBINARY"].includes(type)) {
    return `${type}(${maxLength === -1 ? "MAX" : maxLength})`;
  }
  if (["NCHAR", "NVARCHAR"].includes(type)) {
    return `${type}(${maxLength === -1 ? "MAX" : maxLength / 2})`;
  }
  if (["DECIMAL", "NUMERIC"].includes(type)) return `${type}(${column.precision},${column.scale})`;
  if (["DATETIME2", "DATETIMEOFFSET", "TIME"].includes(type)) return `${type}(${column.scale})`;
  return type;
}

function tableKey(schemaName, tableName) {
  return `${String(schemaName).toLowerCase()}.${String(tableName).toLowerCase()}`;
}

function safeId(value) {
  return String(value || "entity").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sqlIdentifier(value) {
  const text = String(value || "");
  const escaped = text.replaceAll("]", "]]");
  return /\s/.test(text) ? `[${escaped}]` : text;
}
