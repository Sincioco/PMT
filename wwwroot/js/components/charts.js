import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export const VisualCharts = {
  panel(title, charts, options = {}) {
    const className = options.className ? ` ${escapeAttr(options.className)}` : "";

    return `
      <div class="panel chart-panel visual-chart-panel${className}">
        ${options.hideHeader ? "" : `<div class="chart-panel-head">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>Pie, line, column, and bar visuals using only HTML, CSS, and JavaScript.</p>
          </div>
        </div>`}
        <div class="chart-grid visual-chart-grid">
          ${charts.join("")}
        </div>
      </div>
    `;
  },

  card(chart) {
    const className = chart.className ? ` ${escapeAttr(chart.className)}` : "";

    return `
      <section class="chart-card visual-chart-card${className}">
        <div class="chart-card-head">
          <div>
            <h2>${escapeHtml(chart.title)}</h2>
            ${chart.subtitle ? `<p>${escapeHtml(chart.subtitle)}</p>` : ""}
          </div>
          <button class="icon-action chart-expand-button" type="button" data-action="expand-visual-chart" title="Expand chart" aria-label="Expand chart">&#10530;</button>
        </div>
        ${chart.body}
      </section>
    `;
  },

  pieChart(items, centerText, emptyText, options = {}) {
    if (!items.length) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const donut = options.donut !== false;
    const center = 90;
    const outerRadius = 82;
    const innerRadius = donut ? 46 : 0;
    const centerContent = options.centerValue !== undefined
      ? `
        <text class="pie-chart-center-value" x="${center}" y="${center - 7}">${escapeHtml(options.centerValue)}</text>
        <text class="pie-chart-center-label" x="${center}" y="${center + 15}">${escapeHtml(options.centerLabel || "")}</text>
      `
      : `<text class="pie-chart-center-text" x="${center}" y="${center}">${escapeHtml(centerText)}</text>`;
    let start = 0;
    const slices = items.map((item, index) => {
      const sweep = (item.value / total) * 360;
      const end = index === items.length - 1 ? 360 : start + sweep;
      const tooltip = item.tooltip || `${item.label}: ${item.value}`;
      const actionAttrs = this.chartActionAttributes(item);
      const interactiveClass = item.action ? " is-clickable" : "";
      const commonAttrs = `class="pie-chart-slice${interactiveClass}" style="--chart-color:${escapeAttr(item.color)}" data-chart-tooltip="${escapeAttr(tooltip)}" ${actionAttrs}`;
      const sliceHtml = !donut && end - start >= 359.99
        ? `<circle ${commonAttrs} cx="${center}" cy="${center}" r="${outerRadius}"><title>${escapeHtml(tooltip)}</title></circle>`
        : `<path ${commonAttrs} d="${this.pieSlicePath(center, center, outerRadius, innerRadius, start, Math.min(end, 359.99))}"><title>${escapeHtml(tooltip)}</title></path>`;
      start = end;
      return sliceHtml;
    }).join("");

    return `
      <div class="pie-chart-layout">
        <div class="pie-chart ${donut ? "is-donut" : "is-filled"}" data-chart-tooltip="${escapeAttr(centerText)}">
          <svg class="pie-chart-svg" viewBox="0 0 180 180" role="img" aria-label="${escapeAttr(centerText)}">
            ${slices}
            ${donut ? `<circle class="pie-chart-hole" cx="${center}" cy="${center}" r="${innerRadius - 2}"></circle>` : ""}
            ${centerContent}
          </svg>
        </div>
        <div class="chart-legend-list">
          ${items.map(item => this.legendItem(item, total)).join("")}
        </div>
      </div>
    `;
  },

  piePoint(cx, cy, radius, degrees) {
    const radians = (degrees - 90) * Math.PI / 180;
    return {
      x: this.chartNumber(cx + radius * Math.cos(radians)),
      y: this.chartNumber(cy + radius * Math.sin(radians))
    };
  },

  pieSlicePath(cx, cy, outerRadius, innerRadius, startDegrees, endDegrees) {
    const outerStart = this.piePoint(cx, cy, outerRadius, startDegrees);
    const outerEnd = this.piePoint(cx, cy, outerRadius, endDegrees);
    const largeArc = endDegrees - startDegrees > 180 ? 1 : 0;

    if (!innerRadius) {
      return `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`;
    }

    const innerStart = this.piePoint(cx, cy, innerRadius, startDegrees);
    const innerEnd = this.piePoint(cx, cy, innerRadius, endDegrees);
    return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
  },

  chartNumber(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, "");
  },

  chartActionAttributes(item) {
    if (!item.action) return "";

    const attrs = [
      `data-action="${escapeAttr(item.action)}"`,
      item.id ? `data-id="${escapeAttr(item.id)}"` : "",
      item.ids ? `data-ids="${escapeAttr(item.ids)}"` : "",
      item.chartTitle ? `data-chart-title="${escapeAttr(item.chartTitle)}"` : ""
    ].filter(Boolean);

    return attrs.join(" ");
  },

  lineChart(rows, series) {
    const chartWidth = Math.max(620, rows.length * 72);
    const chartHeight = 260;
    const padding = { left: 42, right: 28, top: 22, bottom: 56 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key] || 0)));
    const xStep = rows.length > 1 ? plotWidth / (rows.length - 1) : 0;
    const yFor = value => padding.top + plotHeight - ((value || 0) / maxValue) * plotHeight;
    const xFor = index => rows.length > 1 ? padding.left + (index * xStep) : padding.left + (plotWidth / 2);

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(step => {
      const y = padding.top + plotHeight - (plotHeight * step);
      const label = Math.round(maxValue * step);
      return `
        <line class="line-chart-gridline" x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}"></line>
        <text class="line-chart-axis-label" x="8" y="${y + 4}">${label}</text>
      `;
    }).join("");

    return `
      <div class="visual-chart-scroll">
        <svg class="line-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}" role="img" aria-label="Bug trend line graph">
          ${gridLines}
          ${series.map(item => {
            const points = rows.map((row, index) => `${xFor(index)},${yFor(row[item.key])}`).join(" ");
            return `<polyline class="line-chart-path" points="${points}" style="--chart-color:${escapeAttr(item.color)}"></polyline>`;
          }).join("")}
          ${rows.map((row, index) => {
            const label = rows.length > 12 && index % 2 ? "" : row.label;
            return label ? `<text class="line-chart-x-label" x="${xFor(index)}" y="${chartHeight - 18}" transform="rotate(-32 ${xFor(index)} ${chartHeight - 18})">${escapeHtml(label)}</text>` : "";
          }).join("")}
          ${series.flatMap(item => rows.map((row, index) => {
            const value = row[item.key] || 0;
            const tooltip = `${row.label}: ${value} ${item.label.toLowerCase()} bug report${value === 1 ? "" : "s"}`;
            return `
              <circle class="line-chart-point" cx="${xFor(index)}" cy="${yFor(value)}" r="5" style="--chart-color:${escapeAttr(item.color)}" data-chart-tooltip="${escapeAttr(tooltip)}" data-action="${row.sprintId ? "chart-open-sprint" : ""}" data-id="${escapeAttr(row.sprintId || "")}"></circle>
            `;
          })).join("")}
        </svg>
      </div>
      ${this.legend(series)}
    `;
  },

  columnChart(rows, series, options = {}) {
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key] || 0)));
    const itemLabel = options.itemLabel || "bug report";
    const axis = options.axisLabel ? this.chartAxis(maxValue) : null;
    const scaleMax = axis?.max || maxValue;
    const chart = `
      <div class="column-chart-scroll">
        <div class="column-chart ${axis ? "has-axis" : ""}" style="--column-count:${rows.length}">
          ${axis ? `
            <div class="column-chart-gridlines" aria-hidden="true">
              ${axis.ticks.map(tick => `<i style="--tick-position:${100 - ((tick / axis.max) * 100)}%"></i>`).join("")}
            </div>
          ` : ""}
          ${rows.map(row => `
            <div class="column-group">
              <div class="column-bars">
                ${series.map(item => {
                  const value = row[item.key] || 0;
                  const percent = Math.round((value / scaleMax) * 100);
                  const tooltip = `${row.label}: ${value} ${item.label.toLowerCase()} ${itemLabel}${value === 1 ? "" : "s"}`;
                  return `
                    <button type="button" class="visual-column" data-action="${row.sprintId ? "chart-open-sprint" : ""}" data-id="${escapeAttr(row.sprintId || "")}" data-chart-tooltip="${escapeAttr(tooltip)}" title="${escapeAttr(tooltip)}" style="--value:${percent}%; --chart-color:${escapeAttr(item.color)}">
                      <span>${value}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <div class="column-label" title="${escapeAttr(row.label)}">${escapeHtml(row.label)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    return `
      <div class="${axis ? "column-chart-axis-layout" : ""}">
        ${axis ? `<div class="column-chart-axis-title">${escapeHtml(options.axisLabel)}</div>` : ""}
        ${axis ? `
          <div class="column-chart-axis-labels" aria-hidden="true">
            ${axis.ticks.map(tick => `<span style="--tick-position:${100 - ((tick / axis.max) * 100)}%">${tick}</span>`).join("")}
          </div>
        ` : ""}
        <div class="column-chart-content">
          ${chart}
        </div>
      </div>
      ${this.legend(series)}
    `;
  },

  horizontalBarChart(items, emptyText, options = {}) {
    if (!items.length) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

    const maxValue = Math.max(1, ...items.map(item => item.value || 0));
    const axis = options.axisLabel ? this.chartAxis(maxValue) : null;
    const scaleMax = axis?.max || maxValue;

    return `
      <div class="horizontal-chart ${axis ? "has-axis" : ""}">
        ${items.map(item => {
          const percent = Math.round((item.value / scaleMax) * 100);
          const tag = item.action ? "button" : "div";
          const actionAttrs = item.action ? ` type="button" ${this.chartActionAttributes(item)}` : "";
          const tooltip = escapeAttr(item.tooltip || `${item.label}: ${item.value}`);
          return `
            <${tag}${actionAttrs} class="horizontal-chart-row ${item.action ? "is-clickable" : ""}" data-chart-tooltip="${tooltip}" title="${tooltip}">
              <span class="horizontal-chart-label">${escapeHtml(item.label)}</span>
              <span class="horizontal-chart-track">
                <span class="horizontal-chart-fill" style="--value:${percent}%; --chart-color:${escapeAttr(item.color)}"></span>
              </span>
              <b>${item.value}</b>
            </${tag}>
          `;
        }).join("")}
        ${axis ? `
          <div class="horizontal-chart-axis" aria-hidden="true">
            <span></span>
            <div>
              <div class="horizontal-chart-axis-scale">
                ${axis.ticks.map(tick => `<span style="--tick-position:${(tick / axis.max) * 100}%">${tick}</span>`).join("")}
              </div>
              <b>${escapeHtml(options.axisLabel)}</b>
            </div>
            <span></span>
          </div>
        ` : ""}
      </div>
    `;
  },

  chartAxis(maxValue) {
    const step = Math.max(1, Math.ceil(maxValue / 4));
    const max = Math.max(step * 2, (Math.ceil(maxValue / step) + 1) * step);
    const ticks = [];

    for (let value = 0; value <= max; value += step) ticks.push(value);

    return { max, ticks };
  },

  legend(items) {
    return `
      <div class="visual-chart-legend">
        ${items.map(item => `<span><i style="--chart-color:${escapeAttr(item.color)}"></i>${escapeHtml(item.label)}</span>`).join("")}
      </div>
    `;
  },

  legendItem(item, total) {
    const percent = Math.round((item.value / total) * 100);
    const tag = item.action ? "button" : "div";
    const actionAttrs = item.action ? ` type="button" ${this.chartActionAttributes(item)}` : "";
    const tooltip = escapeAttr(item.tooltip || `${item.label}: ${item.value}`);

    return `
      <${tag}${actionAttrs} class="chart-legend-row ${item.action ? "is-clickable" : ""}" data-chart-tooltip="${tooltip}" title="${tooltip}">
        <i style="--chart-color:${escapeAttr(item.color)}"></i>
        <span>${escapeHtml(item.label)}</span>
        <b>${item.value}</b>
        <em>${percent}%</em>
      </${tag}>
    `;
  }
};
