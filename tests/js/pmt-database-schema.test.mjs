import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPmtDatabaseSchemaDiagram } from "../../wwwroot/js/features/diagram/pmt-database-schema.js";

const imageAnnotationEndpoints = readFileSync(
  new URL("../../Endpoints/ImageAnnotationEndpoints.cs", import.meta.url),
  "utf8"
);

test("live PMT schema metadata requires Documentation create permission", () => {
  const routeStart = imageAnnotationEndpoints.indexOf('app.MapGet("/api/diagram/pmt-database-schema"');
  const routeEnd = imageAnnotationEndpoints.indexOf("        });", routeStart);
  const route = imageAnnotationEndpoints.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.match(route, /var currentUserId = ExplicitCurrentUserId\(context\)/);
  assert.match(route, /RequirePermissionAsync\(currentUserId, "Documentation", "Create", cancellationToken\)/);
  assert.ok(route.indexOf("RequirePermissionAsync") < route.indexOf("GetPmtDatabaseSchemaAsync"));
});

test("PMT database metadata becomes a new editable ERD Diagram", () => {
  const diagram = buildPmtDatabaseSchemaDiagram({
    columns: [
      column("Projects", "ProjectId", { primaryKey: true, identity: true }),
      column("Projects", "Title", { typeName: "nvarchar", maxLength: 440 }),
      column("WorkTasks", "TaskId", { primaryKey: true, identity: true }),
      column("WorkTasks", "ProjectId", { foreignKey: true }),
      column("Odd Table", "Key Field", { primaryKey: true })
    ],
    foreignKeys: [{
      schemaName: "pmt",
      tableName: "WorkTasks",
      foreignKeyName: "FK_pmt_WorkTasks_Project",
      columnOrder: 1,
      columnName: "ProjectId",
      referencedSchema: "pmt",
      referencedTable: "Projects",
      referencedColumn: "ProjectId"
    }]
  });

  assert.equal(diagram.title, "PMT's Database Schema");
  assert.equal(diagram.state.objects.filter(object => object.type === "entity").length, 3);
  assert.equal(diagram.state.objects.filter(object => object.type === "textbox").length, 1);

  const workTasks = diagram.state.objects.find(object => object.entityName === "WorkTasks");
  const projects = diagram.state.objects.find(object => object.entityName === "Projects");
  const oddTable = diagram.state.objects.find(object => object.entityName === "Odd Table");
  assert.ok(workTasks);
  assert.ok(projects);
  assert.ok(oddTable);
  assert.match(workTasks.sourceText, /^CREATE TABLE pmt\.WorkTasks/);
  assert.doesNotMatch(workTasks.sourceText, /\[WorkTasks\]|\[ProjectId\]/);
  assert.match(oddTable.sourceText, /CREATE TABLE pmt\.\[Odd Table\]/);
  assert.match(oddTable.sourceText, /\[Key Field\] INT/);
  assert.equal(workTasks.foreignKeys[0].relationshipType, "one-to-many");
  assert.deepEqual(workTasks.foreignKeys[0].columns, ["ProjectId"]);
  assert.deepEqual(workTasks.foreignKeys[0].referencedColumns, ["ProjectId"]);
  assert.equal(diagram.state.relationshipStyle.showSymbols, false);
  assert.ok(workTasks.y <= projects.y, "The preferred WorkTasks root should be at the highest hierarchy level.");
  assert.match(diagram.svg, /data-pmt-image-annotation-state="true"/);
  assert.match(diagram.svg, /PMT's Diagram Tool by Sin/);
  assert.doesNotMatch(diagram.svg, /image-annotation-entity-relationship-marker|<polygon\b/);
});

function column(tableName, columnName, options = {}) {
  return {
    schemaName: "pmt",
    tableName,
    columnOrder: 1,
    columnName,
    typeName: options.typeName || "int",
    maxLength: options.maxLength ?? 4,
    precision: options.precision ?? 10,
    scale: options.scale ?? 0,
    nullable: options.nullable === true,
    isIdentity: options.identity === true,
    identitySeed: options.identity ? "1" : null,
    identityIncrement: options.identity ? "1" : null,
    isPrimaryKey: options.primaryKey === true,
    isForeignKey: options.foreignKey === true
  };
}
