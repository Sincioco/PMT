import * as THREE from "../../vendor/three/three.module.min.js";
import { appUrl } from "../../shared/app-urls.js";

export const DEV_CHART_GRID_WIDTH = 31.2;
export const DEV_CHART_GRID_HEIGHT = 15.2;
export const DEV_CHART_GRID_Z = -23;
const GALLERY_ROOM_HALF_WIDTH = 20.5;
const DEV_GRID_LEFT_X = -GALLERY_ROOM_HALF_WIDTH;
const DEV_GRID_RIGHT_X = GALLERY_ROOM_HALF_WIDTH;

const PANEL_HEIGHT = 7.2;
const PANEL_GAP = 0.8;
const DEV_PANEL_WIDTH = 15.2;
const TEAM_CARD_WIDTH = 6.8;
const TEAM_CARD_HEIGHT = 3.7;
const TEAM_CARD_GAP = 0.72;
const TEAM_GRID_BOTTOM_Y = -4.15;
const BASE_TEXTURE_WIDTH = 2048;
const BASE_TEXTURE_HEIGHT = 1024;

export function createAboutChartGallery({ users, devCharts, bugCharts, resources, maxAnisotropy = 1 }) {
  const refreshers = [];
  const glassMaterials = [];
  const devGrid = new THREE.Group();
  devGrid.name = "PMT Dev Task Charts 2x2";
  devGrid.position.set(0, 3.15, DEV_CHART_GRID_Z);

  const devPanels = [
    { chart: devCharts.workload, draw: drawWorkloadChart },
    { chart: devCharts.status, draw: drawHorizontalChart },
    { chart: devCharts.mix, draw: drawDonutChart },
    { chart: devCharts.completed, draw: drawColumnChart }
  ];
  const devPanelTargets = addGridPanels({
    group: devGrid,
    panels: devPanels,
    leftWidth: DEV_PANEL_WIDTH,
    rightWidth: DEV_PANEL_WIDTH,
    resources,
    refreshers,
    glassMaterials,
    maxAnisotropy
  });

  const teamRows = Math.min(2, Math.max(1, users.length));
  const teamColumns = Math.max(1, Math.ceil(users.length / teamRows));
  const teamGridWidth = teamColumns * TEAM_CARD_WIDTH + (teamColumns - 1) * TEAM_CARD_GAP;
  const teamGridHeight = teamRows * TEAM_CARD_HEIGHT + (teamRows - 1) * TEAM_CARD_GAP;
  const teamGridX = DEV_GRID_LEFT_X;
  const teamGridY = TEAM_GRID_BOTTOM_Y + teamGridHeight / 2;
  const teamGrid = new THREE.Group();
  teamGrid.name = "PMT Dev Team User Cards";
  teamGrid.position.set(
    teamGridX,
    teamGridY,
    DEV_CHART_GRID_Z + teamGridWidth / 2
  );
  teamGrid.rotation.y = Math.PI / 2;
  users.forEach((user, index) => {
    const column = Math.floor(index / teamRows);
    const row = index % teamRows;
    const card = createGlassChartPanel({
      chart: { title: displayUserName(user), user },
      draw: drawUserCard,
      width: TEAM_CARD_WIDTH,
      height: TEAM_CARD_HEIGHT,
      textureWidth: 1536,
      resources,
      refreshers,
      glassMaterials,
      maxAnisotropy
    });
    card.position.set(
      teamGridWidth / 2 - TEAM_CARD_WIDTH / 2 - column * (TEAM_CARD_WIDTH + TEAM_CARD_GAP),
      teamGridHeight / 2 - TEAM_CARD_HEIGHT / 2 - row * (TEAM_CARD_HEIGHT + TEAM_CARD_GAP),
      0
    );
    teamGrid.add(card);
  });

  // Historical charts expand with their Sprint count instead of clipping or
  // scrolling, but each data point only needs a compact slice of 3D space.
  const bugHistoryWidth = Math.max(18.2, 12 + bugCharts.trend.rows.length * 0.38);
  const bugLeftWidth = 15.2;
  const bugGridWidth = bugLeftWidth + PANEL_GAP + bugHistoryWidth;
  const bugGridStartX = DEV_GRID_RIGHT_X;
  const bugGridX = DEV_GRID_RIGHT_X;
  const bugGrid = new THREE.Group();
  bugGrid.name = "PMT Bug Tracking Charts 2x2";
  bugGrid.position.set(
    bugGridX,
    3.15,
    DEV_CHART_GRID_Z + bugGridWidth / 2
  );
  bugGrid.rotation.y = -Math.PI / 2;
  const bugPanelTargets = addGridPanels({
    group: bugGrid,
    panels: [
      { chart: bugCharts.severity, draw: drawDonutChart },
      { chart: bugCharts.trend, draw: drawLineChart, textureWidth: historyTextureWidth(bugCharts.trend.rows.length) },
      { chart: bugCharts.mix, draw: drawDonutChart },
      { chart: bugCharts.reportedResolved, draw: drawColumnChart, textureWidth: historyTextureWidth(bugCharts.reportedResolved.rows.length) }
    ],
    leftWidth: bugLeftWidth,
    rightWidth: bugHistoryWidth,
    resources,
    refreshers,
    glassMaterials,
    maxAnisotropy
  });

  const group = new THREE.Group();
  group.name = "PMT 3D Chart Gallery";
  group.add(teamGrid, devGrid, bugGrid);
  group.updateMatrixWorld(true);

  const devTargets = devPanelTargets.map(target => devGrid.localToWorld(target.clone()));
  const bugTargets = bugPanelTargets.map(target => bugGrid.localToWorld(target.clone()));
  const bugTarget = bugGrid.localToWorld(new THREE.Vector3(
    -bugGridWidth / 2 + bugLeftWidth / 2,
    0,
    0
  ));

  const themeObserver = new MutationObserver(() => {
    refreshers.forEach(refresh => refresh());
    glassMaterials.forEach(updateGlassMaterial);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  return {
    group,
    devTarget: devGrid.position.clone(),
    devTargets,
    teamTarget: teamGrid.position.clone(),
    bugTarget,
    bugTargets,
    devGridX: devGrid.position.x,
    devGridWidth: DEV_CHART_GRID_WIDTH,
    devGridHeight: DEV_CHART_GRID_HEIGHT,
    bugGridWidth,
    bugGridHeight: DEV_CHART_GRID_HEIGHT,
    bugGridX,
    bugGridStartX,
    bugGridIntersectionX: DEV_GRID_RIGHT_X,
    bugGridIntersectionZ: DEV_CHART_GRID_Z,
    bugGridRotationDegrees: -90,
    bugGrowthDirection: "away-from-dev-wall",
    roomHalfWidth: GALLERY_ROOM_HALF_WIDTH,
    roomBackZ: DEV_CHART_GRID_Z,
    teamColumns,
    teamRows,
    teamGridWidth,
    teamGridHeight,
    teamGridX,
    teamGridY,
    teamGridZ: teamGrid.position.z,
    teamGridIntersectionX: DEV_GRID_LEFT_X,
    teamGridIntersectionZ: DEV_CHART_GRID_Z,
    teamGridRotationDegrees: 90,
    teamGrowthDirection: "away-from-dev-wall",
    dispose() {
      themeObserver.disconnect();
    }
  };
}

function addGridPanels({
  group,
  panels,
  leftWidth,
  rightWidth,
  resources,
  refreshers,
  glassMaterials,
  maxAnisotropy
}) {
  const targets = [];
  const totalWidth = leftWidth + PANEL_GAP + rightWidth;
  const leftX = -totalWidth / 2 + leftWidth / 2;
  const rightX = totalWidth / 2 - rightWidth / 2;
  const topY = PANEL_HEIGHT / 2 + PANEL_GAP / 2;
  const bottomY = -topY;
  const positions = [
    [leftX, topY, leftWidth],
    [rightX, topY, rightWidth],
    [leftX, bottomY, leftWidth],
    [rightX, bottomY, rightWidth]
  ];

  panels.forEach((definition, index) => {
    const [x, y, width] = positions[index];
    const panel = createGlassChartPanel({
      ...definition,
      width,
      height: PANEL_HEIGHT,
      resources,
      refreshers,
      glassMaterials,
      maxAnisotropy
    });
    panel.position.set(x, y, 0);
    group.add(panel);
    targets.push(new THREE.Vector3(x, y, 0));
  });
  return targets;
}

function createGlassChartPanel({
  chart,
  draw,
  width,
  height,
  textureWidth = BASE_TEXTURE_WIDTH,
  resources,
  refreshers,
  glassMaterials,
  maxAnisotropy
}) {
  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = BASE_TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  const avatarImages = new Map();
  const refresh = () => draw(context, chart, avatarImages);
  refresh();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(16, maxAnisotropy);
  texture.needsUpdate = true;
  const redraw = () => {
    refresh();
    texture.needsUpdate = true;
  };
  refreshers.push(redraw);

  if (draw === drawWorkloadChart) {
    void loadWorkloadAvatars(chart.rows, avatarImages).then(redraw);
  } else if (draw === drawUserCard) {
    void loadUserAvatar(chart.user, avatarImages).then(redraw).catch(redraw);
  }

  const panelGeometry = new THREE.PlaneGeometry(width, height);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x10263b,
    emissive: 0x06111d,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.54,
    transmission: 0.52,
    thickness: 0.42,
    ior: 1.42,
    metalness: 0.02,
    roughness: 0.16,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  updateGlassMaterial(glassMaterial);
  glassMaterials.push(glassMaterial);
  const glassSurface = new THREE.Mesh(panelGeometry, glassMaterial);
  glassSurface.renderOrder = 0;

  const chartGeometry = new THREE.PlaneGeometry(width, height);
  const chartMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    alphaTest: 0.012,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    depthWrite: false
  });
  const chartSurface = new THREE.Mesh(chartGeometry, chartMaterial);
  chartSurface.position.z = 0.018;
  chartSurface.renderOrder = 2;

  const panel = new THREE.Group();
  panel.name = chart.title;
  panel.add(glassSurface, chartSurface);
  resources.add(texture);
  resources.add(panelGeometry);
  resources.add(glassMaterial);
  resources.add(chartGeometry);
  resources.add(chartMaterial);
  return panel;
}

function updateGlassMaterial(material) {
  const darkTheme = document.documentElement.dataset.theme === "dark";
  material.color.set(darkTheme ? 0x10263b : 0xbddcf2);
  material.emissive.set(darkTheme ? 0x06111d : 0x102437);
  material.emissiveIntensity = darkTheme ? 0.16 : 0.08;
  material.opacity = darkTheme ? 0.54 : 0.62;
  material.transmission = darkTheme ? 0.52 : 0.38;
  material.needsUpdate = true;
}

function drawWorkloadChart(context, chart, avatarImages) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  drawHeader(context, chart, palette);
  const rows = chart.rows;

  if (!rows.length) {
    drawEmpty(context, "No assigned Dev Tasks were found for this Project / Sprint filter.");
    drawLegend(context, chart.categories, palette, height - 80);
    return;
  }

  const chartTop = 218;
  const chartBottom = height - 180;
  const rowHeight = Math.min(104, (chartBottom - chartTop) / rows.length);
  const avatarX = 112;
  const nameX = 172;
  const totalX = Math.round(width * 0.235);
  const stackX = Math.round(width * 0.265);
  const stackWidth = width - stackX - 88;

  rows.forEach((row, index) => {
    const centerY = chartTop + rowHeight * index + rowHeight / 2;
    const avatarRadius = Math.max(19, Math.min(34, rowHeight * 0.34));
    const barHeight = Math.max(38, Math.min(64, rowHeight * 0.62));
    drawAvatar(context, row, avatarImages, avatarX, centerY, avatarRadius, palette);
    drawText(context, row.user.nickname || "Developer", nameX, centerY, {
      color: palette.textPrimary,
      font: `500 ${Math.max(25, Math.min(34, rowHeight * 0.34))}px 'Segoe UI', Arial, sans-serif`,
      baseline: "middle",
      maxWidth: totalX - nameX - 26
    });
    drawText(context, String(row.total), totalX, centerY, {
      color: palette.textPrimary,
      font: `700 ${Math.max(25, Math.min(34, rowHeight * 0.34))}px 'Segoe UI', Arial, sans-serif`,
      align: "right",
      baseline: "middle"
    });

    context.save();
    roundedRect(context, stackX, centerY - barHeight / 2, stackWidth, barHeight, 8);
    context.clip();
    context.fillStyle = palette.pageMuted;
    context.fillRect(stackX, centerY - barHeight / 2, stackWidth, barHeight);
    const segmentWeights = row.categories.map(category => Math.max(0.08, category.value / row.total));
    const segmentTotal = segmentWeights.reduce((total, value) => total + value, 0);
    let segmentX = stackX;
    row.categories.forEach((category, categoryIndex) => {
      const segmentWidth = categoryIndex === row.categories.length - 1
        ? stackX + stackWidth - segmentX
        : Math.round(stackWidth * segmentWeights[categoryIndex] / segmentTotal);
      context.fillStyle = resolveColor(category.color || category.fallbackColor);
      context.fillRect(segmentX, centerY - barHeight / 2, segmentWidth, barHeight);
      if (categoryIndex > 0) {
        context.fillStyle = palette.surfaceDivider;
        context.fillRect(segmentX, centerY - barHeight / 2, 2, barHeight);
      }
      drawText(context, String(category.value), segmentX + segmentWidth / 2, centerY + 1, {
        color: palette.chartMarkText,
        font: `700 ${Math.max(22, Math.min(30, barHeight * 0.48))}px 'Segoe UI', Arial, sans-serif`,
        align: "center",
        baseline: "middle"
      });
      segmentX += segmentWidth;
    });
    context.restore();
  });
  const usedLabels = new Set(rows.flatMap(row => row.categories.map(category => category.label)));
  drawLegend(context, chart.categories.filter(category => usedLabels.has(category.label)), palette, height - 72);
}

function drawUserCard(context, chart, avatarImages) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  const user = chart.user;
  const avatarRadius = 132;
  const avatarX = 205;
  const avatarY = 300;
  const image = avatarImages.get(String(user.id));
  context.save();
  context.beginPath();
  context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  context.clip();
  if (image) {
    const scale = Math.max((avatarRadius * 2) / image.naturalWidth, (avatarRadius * 2) / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    context.drawImage(image, avatarX - imageWidth / 2, avatarY - imageHeight / 2, imageWidth, imageHeight);
  } else {
    context.fillStyle = avatarColor(user.id);
    context.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    drawText(context, userInitials(user), avatarX, avatarY, {
      color: "#ffffff",
      font: "800 92px 'Segoe UI', Arial, sans-serif",
      align: "center",
      baseline: "middle"
    });
  }
  context.restore();
  context.beginPath();
  context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  context.strokeStyle = resolveColor("var(--color-primary)");
  context.lineWidth = 8;
  context.stroke();

  const textX = 405;
  drawText(context, displayUserName(user), textX, 190, {
    color: palette.textPrimary,
    font: "800 58px 'Segoe UI', Arial, sans-serif",
    baseline: "middle",
    maxWidth: width - textX - 70
  });
  const nickname = String(user.nickname || "").trim();
  if (nickname && nickname.toLowerCase() !== displayUserName(user).toLowerCase()) {
    drawText(context, `(${nickname})`, textX, 260, {
      color: palette.textSecondary,
      font: "600 34px 'Segoe UI', Arial, sans-serif",
      baseline: "middle",
      maxWidth: width - textX - 70
    });
  }
  const role = user.role || (user.isAdmin ? "Admin" : "Developer");
  roundedFill(context, textX, 310, Math.min(330, 74 + textWidth(context, role, "700 31px 'Segoe UI', Arial, sans-serif")), 58, 29, resolveColor("var(--color-primary)"));
  drawText(context, role, textX + 30, 339, {
    color: "#ffffff",
    font: "700 31px 'Segoe UI', Arial, sans-serif",
    baseline: "middle"
  });
  drawText(context, user.email || "No email address", textX, 430, {
    color: palette.textSecondary,
    font: "500 31px 'Segoe UI', Arial, sans-serif",
    baseline: "middle",
    maxWidth: width - textX - 70
  });

  context.beginPath();
  context.moveTo(72, 520);
  context.lineTo(width - 72, 520);
  context.strokeStyle = palette.gridLine;
  context.lineWidth = 3;
  context.stroke();
  drawWrappedText(context, user.bio || "PMT team member", 82, 610, width - 164, 52, 4, {
    color: palette.textPrimary,
    font: "500 34px 'Segoe UI', Arial, sans-serif"
  });
  if (user.isActive === false) {
    roundedFill(context, width - 275, height - 105, 205, 58, 29, resolveColor("var(--color-warning)"));
    drawText(context, "INACTIVE", width - 172, height - 76, {
      color: "#ffffff",
      font: "800 27px 'Segoe UI', Arial, sans-serif",
      align: "center",
      baseline: "middle"
    });
  }
}

function drawHorizontalChart(context, chart) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  drawHeader(context, chart, palette);
  if (!chart.items.length) return drawEmpty(context, chart.emptyText);

  const maxValue = Math.max(1, ...chart.items.map(item => item.value));
  const axisMax = chartAxisMax(maxValue);
  const top = 230;
  const bottom = height - 118;
  const rowHeight = Math.min(115, (bottom - top) / chart.items.length);
  const labelX = 82;
  const trackX = Math.round(width * 0.31);
  const trackWidth = width - trackX - 150;
  chart.items.forEach((item, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    drawText(context, item.label, labelX, y, {
      color: palette.textPrimary,
      font: "600 31px 'Segoe UI', Arial, sans-serif",
      baseline: "middle",
      maxWidth: trackX - labelX - 28
    });
    roundedFill(context, trackX, y - 26, trackWidth, 52, 10, palette.pageMuted);
    const barWidth = Math.max(item.value ? 8 : 0, trackWidth * item.value / axisMax);
    roundedFill(context, trackX, y - 26, barWidth, 52, 10, resolveColor(item.color));
    drawText(context, String(item.value), width - 82, y, {
      color: palette.textPrimary,
      font: "700 32px 'Segoe UI', Arial, sans-serif",
      align: "right",
      baseline: "middle"
    });
  });
  drawText(context, `0${" ".repeat(3)}Number of Tasks${" ".repeat(3)}${axisMax}`, width / 2, height - 62, {
    color: palette.textSecondary,
    font: "500 25px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle"
  });
}

function drawDonutChart(context, chart) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  drawHeader(context, chart, palette);
  const total = chart.items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return drawEmpty(context, "No chart data is available for the selected filters.");

  const centerX = Math.round(width * 0.35);
  const centerY = Math.round(height * 0.57);
  const outerRadius = Math.min(250, height * 0.27);
  const innerRadius = outerRadius * 0.56;
  let angle = -Math.PI / 2;
  chart.items.forEach(item => {
    const sweep = item.value / total * Math.PI * 2;
    context.beginPath();
    context.arc(centerX, centerY, outerRadius, angle, angle + sweep);
    context.arc(centerX, centerY, innerRadius, angle + sweep, angle, true);
    context.closePath();
    context.fillStyle = resolveColor(item.color);
    context.fill();
    angle += sweep;
  });
  drawText(context, String(chart.total ?? total), centerX, centerY - 12, {
    color: palette.textPrimary,
    font: "800 58px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle"
  });
  drawText(context, "Total", centerX, centerY + 45, {
    color: palette.textSecondary,
    font: "600 27px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle"
  });

  const legendX = Math.round(width * 0.61);
  const legendTop = centerY - chart.items.length * 58;
  chart.items.forEach((item, index) => {
    const y = legendTop + index * 116;
    context.beginPath();
    context.arc(legendX, y, 15, 0, Math.PI * 2);
    context.fillStyle = resolveColor(item.color);
    context.fill();
    drawText(context, item.label, legendX + 36, y - 13, {
      color: palette.textPrimary,
      font: "600 31px 'Segoe UI', Arial, sans-serif",
      baseline: "middle"
    });
    drawText(context, `${item.value}  (${Math.round(item.value / total * 100)}%)`, legendX + 36, y + 28, {
      color: palette.textSecondary,
      font: "500 27px 'Segoe UI', Arial, sans-serif",
      baseline: "middle"
    });
  });
  if (Number.isFinite(chart.completedPercent)) {
    drawText(context, `Completed ${chart.completedPercent}%   |   Still Open ${chart.openPercent}%`, width / 2, height - 70, {
      color: palette.textSecondary,
      font: "700 28px 'Segoe UI', Arial, sans-serif",
      align: "center",
      baseline: "middle"
    });
  }
}

function drawColumnChart(context, chart) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  drawHeader(context, chart, palette);
  if (!chart.rows.length) return drawEmpty(context, "No Sprint history data is available.");
  const plot = { left: 110, right: width - 54, top: 220, bottom: height - 145 };
  const maxValue = Math.max(1, ...chart.rows.flatMap(row => chart.series.map(series => row[series.key] || 0)));
  const axisMax = chartAxisMax(maxValue);
  drawGrid(context, plot, axisMax, palette);
  const groupWidth = (plot.right - plot.left) / chart.rows.length;
  const barGap = Math.max(4, groupWidth * 0.045);
  const barWidth = Math.max(5, Math.min(58, (groupWidth * 0.76 - barGap * (chart.series.length - 1)) / chart.series.length));
  chart.rows.forEach((row, rowIndex) => {
    const centerX = plot.left + groupWidth * (rowIndex + 0.5);
    const totalBarsWidth = chart.series.length * barWidth + (chart.series.length - 1) * barGap;
    chart.series.forEach((series, seriesIndex) => {
      const value = row[series.key] || 0;
      const barHeight = (plot.bottom - plot.top) * value / axisMax;
      const x = centerX - totalBarsWidth / 2 + seriesIndex * (barWidth + barGap);
      context.fillStyle = resolveColor(series.color);
      context.fillRect(x, plot.bottom - barHeight, barWidth, barHeight);
      if (value) drawText(context, String(value), x + barWidth / 2, plot.bottom - barHeight - 15, {
        color: palette.textPrimary,
        font: "700 20px 'Segoe UI', Arial, sans-serif",
        align: "center",
        baseline: "bottom"
      });
    });
    drawText(context, row.label, centerX, plot.bottom + 38, {
      color: palette.textSecondary,
      font: "500 21px 'Segoe UI', Arial, sans-serif",
      align: "center",
      baseline: "middle",
      maxWidth: groupWidth - 8
    });
  });
  drawLegend(context, chart.series, palette, height - 54);
}

function drawLineChart(context, chart) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  drawHeader(context, chart, palette);
  if (!chart.rows.length) return drawEmpty(context, "No Sprint trend data is available.");
  const plot = { left: 110, right: width - 58, top: 220, bottom: height - 145 };
  const maxValue = Math.max(1, ...chart.rows.flatMap(row => chart.series.map(series => row[series.key] || 0)));
  const axisMax = chartAxisMax(maxValue);
  drawGrid(context, plot, axisMax, palette);
  const xFor = index => chart.rows.length > 1
    ? plot.left + (plot.right - plot.left) * index / (chart.rows.length - 1)
    : (plot.left + plot.right) / 2;
  const yFor = value => plot.bottom - (plot.bottom - plot.top) * value / axisMax;
  chart.series.forEach(series => {
    context.beginPath();
    chart.rows.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(row[series.key] || 0);
      if (!index) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = resolveColor(series.color);
    context.lineWidth = 7;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
    chart.rows.forEach((row, index) => {
      const value = row[series.key] || 0;
      const x = xFor(index);
      const y = yFor(value);
      context.beginPath();
      context.arc(x, y, 10, 0, Math.PI * 2);
      context.fillStyle = resolveColor(series.color);
      context.fill();
      drawText(context, String(value), x, y - 18, {
        color: palette.textPrimary,
        font: "700 19px 'Segoe UI', Arial, sans-serif",
        align: "center",
        baseline: "bottom"
      });
    });
  });
  chart.rows.forEach((row, index) => drawText(context, row.label, xFor(index), plot.bottom + 40, {
    color: palette.textSecondary,
    font: "500 21px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle",
    maxWidth: Math.max(110, (plot.right - plot.left) / chart.rows.length - 8)
  }));
  drawLegend(context, chart.series, palette, height - 54);
}

function clearTexture(context) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalAlpha = 1;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

function drawHeader(context, chart, palette) {
  drawText(context, chart.title, 78, 65, {
    color: palette.textPrimary,
    font: "700 52px 'Segoe UI', Arial, sans-serif",
    baseline: "top"
  });
  drawText(context, chart.subtitle || "", 78, 132, {
    color: palette.textSecondary,
    font: "500 29px 'Segoe UI', Arial, sans-serif",
    baseline: "top"
  });
}

function drawEmpty(context, message) {
  const palette = chartPalette();
  drawText(context, message, context.canvas.width / 2, context.canvas.height / 2, {
    color: palette.textSecondary,
    font: "600 38px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle",
    maxWidth: context.canvas.width - 180
  });
}

function drawGrid(context, plot, axisMax, palette) {
  for (let index = 0; index <= 4; index += 1) {
    const value = Math.round(axisMax * index / 4);
    const y = plot.bottom - (plot.bottom - plot.top) * index / 4;
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
    context.strokeStyle = palette.gridLine;
    context.lineWidth = 2;
    context.stroke();
    drawText(context, String(value), plot.left - 24, y, {
      color: palette.textSecondary,
      font: "500 21px 'Segoe UI', Arial, sans-serif",
      align: "right",
      baseline: "middle"
    });
  }
}

function drawLegend(context, items, palette, y) {
  const visible = items.filter(item => item.value === undefined || item.value > 0);
  const itemWidths = visible.map(item => 58 + textWidth(context, item.label, "500 25px 'Segoe UI', Arial, sans-serif") + 46);
  const totalWidth = itemWidths.reduce((total, value) => total + value, 0);
  let x = Math.max(72, (context.canvas.width - totalWidth) / 2);
  visible.forEach((item, index) => {
    context.beginPath();
    context.arc(x + 10, y, 10, 0, Math.PI * 2);
    context.fillStyle = resolveColor(item.color || item.fallbackColor);
    context.fill();
    x += 32;
    drawText(context, item.label, x, y, {
      color: palette.textSecondary,
      font: "500 25px 'Segoe UI', Arial, sans-serif",
      baseline: "middle"
    });
    x += itemWidths[index] - 32;
  });
}

function drawAvatar(context, row, avatarImages, x, y, radius, palette) {
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  const image = avatarImages.get(String(row.user.id));
  if (image) {
    const scale = Math.max((radius * 2) / image.naturalWidth, (radius * 2) / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, x - width / 2, y - height / 2, width, height);
  } else {
    context.fillStyle = avatarColor(row.user.id);
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    drawText(context, userInitials(row.user), x, y + 1, {
      color: "#ffffff",
      font: `700 ${Math.round(radius * 0.82)}px 'Segoe UI', Arial, sans-serif`,
      align: "center",
      baseline: "middle"
    });
  }
  context.restore();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.lineWidth = 2;
  context.strokeStyle = palette.avatarOutline;
  context.stroke();
}

async function loadWorkloadAvatars(rows, avatarImages) {
  await Promise.allSettled(rows.map(async row => {
    const source = row.user.avatarUrl || "/assets/avatar-default.svg";
    const resolved = new URL(appUrl(source), window.location.href);
    if (resolved.protocol !== "data:" && resolved.origin !== window.location.origin) return;
    const image = await loadImage(resolved.href);
    avatarImages.set(String(row.user.id), image);
  }));
}

async function loadUserAvatar(user, avatarImages) {
  const source = user.avatarUrl || "/assets/avatar-default.svg";
  const resolved = new URL(appUrl(source), window.location.href);
  if (resolved.protocol !== "data:" && resolved.origin !== window.location.origin) return;
  const image = await loadImage(resolved.href);
  avatarImages.set(String(user.id), image);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Avatar could not be loaded."));
    image.src = source;
  });
}

function chartPalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    pageMuted: color("--color-page-muted", "#eef4fb"),
    textPrimary: color("--color-text-primary", "#0f172a"),
    textSecondary: color("--color-text-secondary", "#475569"),
    chartMarkText: color("--color-chart-mark-text", "#ffffff"),
    surfaceDivider: color("--color-surface", "#ffffff"),
    avatarOutline: color("--color-border", "rgba(15, 23, 42, 0.12)"),
    gridLine: color("--color-border", "rgba(148, 163, 184, 0.34)")
  };
}

function resolveColor(value) {
  const raw = String(value || "").trim();
  const variable = raw.match(/^var\((--[^)]+)\)$/)?.[1];
  if (!variable) return raw || "#2686fe";
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "#2686fe";
}

function drawText(context, text, x, y, options = {}) {
  context.fillStyle = options.color || "#ffffff";
  context.font = options.font || "500 28px 'Segoe UI', Arial, sans-serif";
  context.textAlign = options.align || "left";
  context.textBaseline = options.baseline || "alphabetic";
  const value = options.maxWidth ? truncateText(context, String(text || ""), options.maxWidth) : String(text || "");
  if (options.maxWidth) context.fillText(value, x, y, options.maxWidth);
  else context.fillText(value, x, y);
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines, options = {}) {
  context.fillStyle = options.color || "#ffffff";
  context.font = options.font || "500 28px 'Segoe UI', Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "top";
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    visibleLines[visibleLines.length - 1] = truncateText(
      context,
      `${visibleLines[visibleLines.length - 1]}...`,
      maxWidth
    );
  }
  visibleLines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
}

function truncateText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function roundedFill(context, x, y, width, height, radius, color) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function textWidth(context, text, font) {
  context.font = font;
  return context.measureText(text).width;
}

function chartAxisMax(maxValue) {
  const step = Math.max(1, Math.ceil(maxValue / 4));
  return Math.max(step * 2, (Math.ceil(maxValue / step) + 1) * step);
}

function historyTextureWidth(rowCount) {
  return Math.min(8192, Math.max(BASE_TEXTURE_WIDTH, 1200 + rowCount * 125));
}

function avatarColor(userId) {
  const colors = ["#126bff", "#7c3aed", "#0891b2", "#db2777", "#d97706", "#2f9e44"];
  return colors[Math.abs(Number(userId) || 0) % colors.length];
}

function userInitials(user) {
  const values = [user.firstName, user.lastName].filter(Boolean);
  if (!values.length && user.nickname) values.push(user.nickname);
  return values.map(value => String(value).trim().charAt(0)).join("").slice(0, 2).toUpperCase() || "?";
}

function displayUserName(user) {
  return [user.firstName, user.lastName]
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .join(" ") || user.nickname || "User";
}
