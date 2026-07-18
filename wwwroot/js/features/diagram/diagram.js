import { buttonContent } from "../../components/buttons.js";
import { openImageAnnotationDialog } from "../../components/image-annotation.js?v=20260718-diagram-entity-v22";
import { sectionHead } from "../../components/sections.js?v=20260718-diagram-entity-v22";

const blankDiagramSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <rect width="1600" height="900" fill="#ffffff"/>
  </svg>
`)}`;

export function createDiagramFeature({
  app,
  askForColor,
  askForText,
  confirm,
  notify,
  loadTemplateLibrary,
  loadDefaultTemplateLibrary,
  saveTemplateLibrary,
  saveDiagram
}) {
  let currentDiagram = null;
  let previewUrl = "";
  let annotationUrl = "";
  let active = false;
  let opening = false;
  let saving = false;
  let autoOpenScheduled = false;

  function renderDiagram() {
    active = true;
    releasePreviewUrl();

    const actions = `
      <button type="button" class="secondary text-icon-button" data-action="new-diagram" ${saving ? "disabled" : ""}>
        ${buttonContent("&#10010;", "New Diagram")}
      </button>
      ${currentDiagram ? `<button type="button" class="secondary text-icon-button" data-action="edit-diagram" ${saving ? "disabled" : ""}>
        ${buttonContent("&#9998;", "Edit Diagram")}
      </button>
      <button type="button" class="primary text-icon-button" data-action="save-diagram" ${saving ? "disabled" : ""}>
        ${buttonContent("&#128190;", saving ? "Saving..." : "Save")}
      </button>` : ""}
    `;

    app.innerHTML = `
      <section class="diagram-screen">
        ${sectionHead("Diagram", actions)}
        <div class="panel diagram-panel">
          ${currentDiagram ? `
            <div class="diagram-preview">
              <img data-diagram-preview alt="Current diagram preview">
            </div>
            <p class="diagram-note">Use Edit Diagram to continue working with the same editor used by the RTE. Save creates a private global Document containing the editable diagram.</p>
          ` : `
            <div class="diagram-empty">
              <span class="diagram-empty-icon" aria-hidden="true">&#128208;</span>
              <h2>Create a diagram</h2>
              <p>Start with a blank canvas and use the existing annotation tools, templates, object tree, undo, and redo.</p>
              <button type="button" class="primary text-icon-button" data-action="new-diagram">
                ${buttonContent("&#10010;", "Open Diagram Editor")}
              </button>
            </div>
          `}
        </div>
      </section>
    `;

    if (currentDiagram) {
      previewUrl = URL.createObjectURL(new Blob([currentDiagram.svg], { type: "image/svg+xml" }));
      const preview = app.querySelector("[data-diagram-preview]");
      if (preview) preview.src = previewUrl;
    } else if (!opening && !autoOpenScheduled) {
      autoOpenScheduled = true;
      window.requestAnimationFrame(() => {
        if (active && !currentDiagram && !opening) openDiagram(false);
      });
    }
  }

  async function handleAction(action) {
    if (action === "new-diagram") {
      if (saving) return true;
      await openDiagram(false);
      return true;
    }
    if (action === "edit-diagram") {
      if (saving) return true;
      await openDiagram(true);
      return true;
    }
    if (action === "save-diagram") {
      if (!currentDiagram || saving) return true;
      saving = true;
      renderDiagram();
      try {
        await saveDiagram?.(currentDiagram);
        saving = false;
      } catch (error) {
        saving = false;
        if (active) {
          notify?.(error?.message || "The diagram could not be saved.");
          renderDiagram();
        }
      }
      return true;
    }
    return false;
  }

  async function openDiagram(editExisting) {
    if (opening || saving) return;
    opening = true;
    releaseAnnotationUrl();

    try {
      if (editExisting && currentDiagram) {
        annotationUrl = URL.createObjectURL(new Blob([currentDiagram.svg], { type: "image/svg+xml" }));
      }

      const result = await openImageAnnotationDialog({
        originalReference: blankDiagramSource,
        originalUrl: blankDiagramSource,
        annotationUrl,
        originalFileName: "diagram.svg",
        title: "Diagram",
        subtitle: "Editable vector diagram",
        applyLabel: "Done",
        applyingMessage: "Preparing the diagram...",
        initialSelection: "none",
        includeOriginalImage: false,
        askForColor,
        askForText,
        confirm,
        notify,
        loadTemplateLibrary,
        loadDefaultTemplateLibrary,
        saveTemplateLibrary
      });

      if (!result) return;
      currentDiagram = result;
      if (active) {
        renderDiagram();
        notify?.("Diagram updated.");
      }
    } catch (error) {
      if (active) notify?.(error?.message || "The diagram could not be opened.");
    } finally {
      opening = false;
      releaseAnnotationUrl();
    }
  }

  function deactivate() {
    active = false;
    autoOpenScheduled = false;
    releasePreviewUrl();
    releaseAnnotationUrl();
  }

  function releasePreviewUrl() {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }

  function releaseAnnotationUrl() {
    if (!annotationUrl) return;
    URL.revokeObjectURL(annotationUrl);
    annotationUrl = "";
  }

  return {
    deactivate,
    handleAction,
    render: renderDiagram
  };
}
