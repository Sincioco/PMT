import { sectionHead } from "../../components/sections.js?v=20260725-diagram2-day4-v1";

export function createDiagram2Feature({ app }) {
  let active = false;
  let routedDocumentId = 0;

  function render() {
    active = true;
    routedDocumentId = currentRouteDocumentId();
    app.innerHTML = `
      <section class="diagram2-screen" data-diagram2-screen>
        ${sectionHead("Diagram 2", `<span class="diagram2-status">Isolated beta shell</span>`)}
        <div class="diagram2-workspace" role="region" aria-label="Diagram 2 workspace">
          <div class="diagram2-canvas-preview" aria-hidden="true">
            <div class="diagram2-node diagram2-node-primary"></div>
            <div class="diagram2-node diagram2-node-secondary"></div>
            <div class="diagram2-relationship"></div>
          </div>
          <div class="diagram2-development-panel">
            <h2>High-performance Diagram renderer under development.</h2>
            <p>Diagram 1 remains available.</p>
            ${routedDocumentId ? `<p class="diagram2-route-note">Reserved Diagram document route: ${routedDocumentId}</p>` : ""}
          </div>
        </div>
      </section>
    `;
  }

  function deactivate() {
    active = false;
    routedDocumentId = 0;
  }

  function handleAction() {
    return false;
  }

  function view(id) {
    routedDocumentId = positiveRouteId(id);
    if (active) render();
    return true;
  }

  return {
    render,
    deactivate,
    handleAction,
    view,
    isActive: () => active
  };
}

function currentRouteDocumentId() {
  const match = String(window.location.hash || "").match(/^#\/(?:diagram-2|diagram2)\/(\d+)(?:$|[/?#])/i);
  return positiveRouteId(match?.[1]);
}

function positiveRouteId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}
