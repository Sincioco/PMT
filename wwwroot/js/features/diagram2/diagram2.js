import { sectionHead } from "../../components/sections.js?v=20260725-diagram2-day1-v1";

export function createDiagram2Feature({ app }) {
  let active = false;

  function render() {
    active = true;
    app.innerHTML = `
      <section class="diagram2-screen" data-diagram2-screen>
        ${sectionHead("Diagram 2", `<span class="diagram2-status">Isolated beta shell</span>`)}
        <div class="diagram2-workspace" role="region" aria-label="Diagram 2 workspace">
          <div class="diagram2-canvas-preview" aria-hidden="true">
            <div class="diagram2-node diagram2-node-primary"></div>
            <div class="diagram2-node diagram2-node-secondary"></div>
            <div class="diagram2-relationship"></div>
          </div>
          <div class="diagram2-empty">
            <h2>Workspace</h2>
            <p>No diagram loaded.</p>
          </div>
        </div>
      </section>
    `;
  }

  function deactivate() {
    active = false;
  }

  return {
    render,
    deactivate,
    isActive: () => active
  };
}
