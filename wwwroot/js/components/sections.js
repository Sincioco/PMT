export function sectionHead(title, actionsHtml) {
  return `
    <div class="section-head">
      <h1>${title}</h1>
      <div class="toolbar">${actionsHtml || ""}</div>
    </div>
  `;
}
