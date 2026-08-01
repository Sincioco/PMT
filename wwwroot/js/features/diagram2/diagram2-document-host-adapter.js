export function createDiagram2DocumentHostAdapter(options = {}) {
  const security = normalizeDiagram2DocumentSecurity(options);
  return {
    kind: "diagram-document",
    mode: "diagram-document",
    canEdit: security.canUpdate === true,
    canExport: security.canExport !== false,
    security,
    document: options.document || null,
    async save(payload) {
      if (security.canUpdate !== true) {
        throw new Error("You do not have permission to update this Diagram.");
      }
      if (typeof options.saveDiagramDocument !== "function") {
        throw new Error("Diagram 2 save is not available.");
      }
      if (!options.document) throw new Error("Select a Diagram before saving.");
      return options.saveDiagramDocument(options.document, payload);
    }
  };
}

export function nextAvailableDiagram2SaveTitle(title, documents = []) {
  const currentTitle = String(title || "Diagram").trim() || "Diagram";
  const numbered = currentTitle.match(/^(.*\S)\s+(\d+)$/);
  const baseTitle = String(numbered?.[1] || currentTitle).trim() || "Diagram";
  const titles = new Set((documents || [])
    .map(document => String(document?.title || "").trim().toLocaleLowerCase())
    .filter(Boolean));
  let index = numbered ? Math.max(2, Number(numbered[2]) + 1) : 2;
  while (titles.has(`${baseTitle} ${index}`.toLocaleLowerCase())) index += 1;
  return `${baseTitle} ${index}`;
}

function normalizeDiagram2DocumentSecurity(options = {}) {
  const provided = options.security && typeof options.security === "object" ? options.security : {};
  const canUpdate = Object.hasOwn(provided, "canUpdate")
    ? provided.canUpdate === true
    : options.canEdit === true;
  return Object.freeze({
    resource: String(provided.resource || "Documentation"),
    canRead: provided.canRead !== false,
    canCreate: provided.canCreate === true,
    canUpdate,
    canDelete: provided.canDelete === true,
    canImport: provided.canImport === true,
    canExport: Object.hasOwn(provided, "canExport") ? provided.canExport === true : options.canExport !== false
  });
}
