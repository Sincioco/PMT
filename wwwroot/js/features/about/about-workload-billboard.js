import * as THREE from "../../vendor/three/three.module.min.js";
import { appUrl } from "../../shared/app-urls.js";

export const DEV_CHART_GRID_WIDTH = 31.2;
export const DEV_CHART_GRID_HEIGHT = 15.2;
export const DEV_CHART_GRID_Z = -32;
export const DOCUMENTATION_GRID_Z = 40;
const GALLERY_ROOM_HALF_WIDTH = 36;
const DEV_GRID_LEFT_X = -GALLERY_ROOM_HALF_WIDTH;
const DEV_GRID_RIGHT_X = GALLERY_ROOM_HALF_WIDTH;

const PANEL_HEIGHT = 7.2;
const PANEL_GAP = 0.8;
const DEV_PANEL_WIDTH = 15.2;
const TEAM_CARD_WIDTH = 6.8;
const TEAM_CARD_HEIGHT = 3.7;
const TEAM_CARD_GAP = 0.72;
const TEAM_GRID_BOTTOM_Y = -4.15;
const KANBAN_COLUMN_WIDTH = 5.6;
const KANBAN_COLUMN_HEIGHT = 13.8;
const KANBAN_COLUMN_GAP = 0.55;
const KANBAN_TEAM_GAP = 5.5;
const KANBAN_MAX_VISIBLE_TASKS = 4;
const DOCUMENTATION_CARD_WIDTH = 5.8;
const DOCUMENTATION_CARD_HEIGHT = 3.25;
const DOCUMENTATION_CARD_GAP = 0.55;
const DOCUMENTATION_MAX_COLUMNS = 5;
const DOCUMENTATION_LIMIT = 20;
const SECTION_LABEL_HEIGHT = 1.9;
const SECTION_LABEL_GAP = 0.75;
const BASE_TEXTURE_WIDTH = 2048;
const BASE_TEXTURE_HEIGHT = 1024;
const DARK_CHART_VARIABLES = Object.freeze({
  "--color-primary": "#35c7bd",
  "--color-success": "#74c476",
  "--color-warning": "#e4a53a",
  "--color-danger": "#ee6b70",
  "--chart-1": "#35c7bd",
  "--chart-2": "#76a9ff",
  "--chart-3": "#74c476",
  "--chart-4": "#e4a53a",
  "--chart-5": "#ee6b70",
  "--chart-6": "#9f9cff",
  "--chart-7": "#58b6d6",
  "--chart-8": "#c5d35c",
  "--status-1": "#6b7680",
  "--status-2": "#76a9ff",
  "--status-3": "#35c7bd",
  "--status-4": "#8ad17c",
  "--status-5": "#e4c63a",
  "--status-6": "#e4a53a",
  "--status-7": "#ee6b70",
  "--status-8": "#74c476",
  "--status-9": "#58b6d6",
  "--status-10": "#9f9cff",
  "--green": "#74c476",
  "--amber": "#e4a53a",
  "--rose": "#ee6b70"
});

export function createAboutChartGallery({
  users,
  projects = [],
  blogs = [],
  tasks = [],
  statuses = [],
  omitEmptyKanbanColumns = false,
  getStatusColor = () => "#76a9ff",
  devCharts,
  bugCharts,
  resources,
  maxAnisotropy = 1
}) {
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
  const devLabel = createGallerySectionLabel({
    text: "Development Tasks",
    width: 18,
    resources,
    maxAnisotropy
  });
  devLabel.position.set(0, DEV_CHART_GRID_HEIGHT / 2 + SECTION_LABEL_GAP + SECTION_LABEL_HEIGHT / 2, 0.04);
  devGrid.add(devLabel);

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
  const teamLabel = createGallerySectionLabel({
    text: "Development Team",
    width: Math.max(10.5, Math.min(18, teamGridWidth)),
    resources,
    maxAnisotropy
  });
  teamLabel.position.set(0, teamGridHeight / 2 + SECTION_LABEL_GAP + SECTION_LABEL_HEIGHT / 2, 0.04);
  teamGrid.add(teamLabel);

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
  const bugPanels = [
    { chart: bugCharts.severity, draw: drawDonutChart },
    { chart: bugCharts.trend, draw: drawLineChart, textureWidth: historyTextureWidth(bugCharts.trend.rows.length) },
    { chart: bugCharts.mix, draw: drawDonutChart },
    { chart: bugCharts.reportedResolved, draw: drawColumnChart, textureWidth: historyTextureWidth(bugCharts.reportedResolved.rows.length) }
  ];
  const bugPanelTargets = addGridPanels({
    group: bugGrid,
    panels: bugPanels,
    leftWidth: bugLeftWidth,
    rightWidth: bugHistoryWidth,
    resources,
    refreshers,
    glassMaterials,
    maxAnisotropy
  });
  const bugLabel = createGallerySectionLabel({
    text: "Bug Tracking",
    width: Math.max(14, Math.min(20, bugGridWidth * 0.62)),
    resources,
    maxAnisotropy
  });
  bugLabel.position.set(0, DEV_CHART_GRID_HEIGHT / 2 + SECTION_LABEL_GAP + SECTION_LABEL_HEIGHT / 2, 0.04);
  bugGrid.add(bugLabel);

  const documentationCards = latestDocumentationCards(blogs);
  const documentationColumns = Math.min(
    DOCUMENTATION_MAX_COLUMNS,
    Math.max(1, documentationCards.length)
  );
  const documentationRows = Math.max(1, Math.ceil(documentationCards.length / documentationColumns));
  const documentationGridWidth = documentationColumns * DOCUMENTATION_CARD_WIDTH
    + Math.max(0, documentationColumns - 1) * DOCUMENTATION_CARD_GAP;
  const documentationGridHeight = documentationRows * DOCUMENTATION_CARD_HEIGHT
    + Math.max(0, documentationRows - 1) * DOCUMENTATION_CARD_GAP;
  const documentationGrid = new THREE.Group();
  documentationGrid.name = "PMT Documentation Cards";
  documentationGrid.position.set(0, 3.15, DOCUMENTATION_GRID_Z);
  documentationGrid.rotation.y = Math.PI;
  const documentationCardTargets = [];
  const usersById = new Map(users.map(user => [Number(user.id), user]));
  const projectsById = new Map(projects.map(project => [Number(project.id), project]));

  documentationCards.forEach((blog, index) => {
    const column = index % documentationColumns;
    const row = Math.floor(index / documentationColumns);
    const card = createGlassChartPanel({
      chart: documentationCardModel(blog, usersById, projectsById),
      draw: drawDocumentationCard,
      width: DOCUMENTATION_CARD_WIDTH,
      height: DOCUMENTATION_CARD_HEIGHT,
      textureWidth: 1024,
      textureHeight: 640,
      resources,
      refreshers,
      glassMaterials,
      maxAnisotropy
    });
    card.position.set(
      -documentationGridWidth / 2 + DOCUMENTATION_CARD_WIDTH / 2
        + column * (DOCUMENTATION_CARD_WIDTH + DOCUMENTATION_CARD_GAP),
      documentationGridHeight / 2 - DOCUMENTATION_CARD_HEIGHT / 2
        - row * (DOCUMENTATION_CARD_HEIGHT + DOCUMENTATION_CARD_GAP),
      0
    );
    documentationCardTargets.push(card.position.clone());
    documentationGrid.add(card);
  });
  const documentationLabel = createGallerySectionLabel({
    text: "Documentation",
    width: 17,
    resources,
    maxAnisotropy
  });
  documentationLabel.position.set(
    0,
    documentationGridHeight / 2 + SECTION_LABEL_GAP + SECTION_LABEL_HEIGHT / 2,
    0.04
  );
  documentationGrid.add(documentationLabel);

  const kanbanTaskModels = tasks.map(task => ({
    ...task,
    assignees: Array.isArray(task.assignees) && task.assignees.length
      ? task.assignees
      : (task.assigneeIds || [])
        .map(userId => usersById.get(Number(userId)))
        .filter(Boolean)
  }));
  const kanbanColumns = buildKanbanColumns(
    kanbanTaskModels,
    statuses,
    getStatusColor,
    { omitEmptyColumns: omitEmptyKanbanColumns }
  );
  const kanbanColumnCount = Math.max(1, kanbanColumns.length);
  const kanbanGridWidth = kanbanColumnCount * KANBAN_COLUMN_WIDTH
    + Math.max(0, kanbanColumnCount - 1) * KANBAN_COLUMN_GAP;
  const teamFrontZ = DEV_CHART_GRID_Z + teamGridWidth;
  const kanbanGridStartZ = teamFrontZ + KANBAN_TEAM_GAP;
  const kanbanGrid = new THREE.Group();
  kanbanGrid.name = "PMT Dynamic Kanban Board";
  kanbanGrid.position.set(
    DEV_GRID_LEFT_X,
    TEAM_GRID_BOTTOM_Y + KANBAN_COLUMN_HEIGHT / 2,
    kanbanGridStartZ + kanbanGridWidth / 2
  );
  kanbanGrid.rotation.y = Math.PI / 2;

  const displayedKanbanColumns = kanbanColumns.length
    ? kanbanColumns
    : [{ status: "No active columns", color: "#6b7680", tasks: [] }];
  displayedKanbanColumns.forEach((column, index) => {
    const panel = createGlassChartPanel({
      chart: column,
      draw: drawKanbanColumn,
      width: KANBAN_COLUMN_WIDTH,
      height: KANBAN_COLUMN_HEIGHT,
      textureWidth: 1024,
      textureHeight: 2048,
      resources,
      refreshers,
      glassMaterials,
      maxAnisotropy
    });
    panel.position.set(
      kanbanGridWidth / 2 - KANBAN_COLUMN_WIDTH / 2
        - index * (KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP),
      0,
      0
    );
    kanbanGrid.add(panel);
  });
  const kanbanLabel = createGallerySectionLabel({
    text: "Kanban Board",
    width: Math.max(12, Math.min(22, kanbanGridWidth)),
    resources,
    maxAnisotropy
  });
  kanbanLabel.position.set(
    0,
    KANBAN_COLUMN_HEIGHT / 2 + SECTION_LABEL_GAP + SECTION_LABEL_HEIGHT / 2,
    0.04
  );
  kanbanGrid.add(kanbanLabel);

  const group = new THREE.Group();
  group.name = "PMT 3D Chart Gallery";
  group.add(teamGrid, devGrid, bugGrid, documentationGrid, kanbanGrid);
  group.updateMatrixWorld(true);

  const devTargets = devPanelTargets.map(target => devGrid.localToWorld(target.clone()));
  const bugTargets = bugPanelTargets.map(target => bugGrid.localToWorld(target.clone()));
  const documentationTargets = documentationCardTargets
    .map(target => documentationGrid.localToWorld(target.clone()));
  const bugTarget = bugGrid.localToWorld(new THREE.Vector3(
    -bugGridWidth / 2 + bugLeftWidth / 2,
    0,
    0
  ));

  return {
    group,
    devTarget: devGrid.position.clone(),
    devTargets,
    devLabels: devPanels.map(({ chart }) => chart.title || "Dev Task chart"),
    devWidths: devPanels.map(() => DEV_PANEL_WIDTH),
    teamTarget: teamGrid.position.clone(),
    bugTarget,
    bugTargets,
    bugLabels: bugPanels.map(({ chart }) => chart.title || "Bug Tracking chart"),
    bugWidths: [bugLeftWidth, bugHistoryWidth, bugLeftWidth, bugHistoryWidth],
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
    kanbanColumnCount: kanbanColumns.length,
    kanbanTaskCount: kanbanColumns.reduce((total, column) => total + column.tasks.length, 0),
    kanbanGridWidth,
    kanbanGridHeight: KANBAN_COLUMN_HEIGHT,
    kanbanGridX: kanbanGrid.position.x,
    kanbanGridY: kanbanGrid.position.y,
    kanbanGridZ: kanbanGrid.position.z,
    kanbanGridStartZ,
    kanbanGridEndZ: kanbanGridStartZ + kanbanGridWidth,
    kanbanGridRotationDegrees: 90,
    kanbanGrowthDirection: "away-from-development-team",
    kanbanTarget: kanbanGrid.position.clone(),
    documentationCardCount: documentationCards.length,
    documentationCardLimit: DOCUMENTATION_LIMIT,
    documentationColumns,
    documentationRows,
    documentationGridWidth,
    documentationGridHeight,
    documentationGridX: documentationGrid.position.x,
    documentationGridY: documentationGrid.position.y,
    documentationGridZ: documentationGrid.position.z,
    documentationGridRotationDegrees: 180,
    documentationFacingTarget: "pmt-logo",
    documentationTarget: documentationGrid.position.clone(),
    documentationTargets,
    documentationLabels: documentationCards.map(blog => String(blog?.title || "Documentation")),
    documentationCardWidth: DOCUMENTATION_CARD_WIDTH,
    documentationCardHeight: DOCUMENTATION_CARD_HEIGHT,
    dispose() {}
  };
}

export function buildKanbanColumns(
  tasks = [],
  statuses = [],
  getStatusColor = () => "#76a9ff",
  { omitEmptyColumns = false } = {}
) {
  const tasksByStatus = new Map();
  for (const task of tasks) {
    const status = String(task?.status || "Unassigned").trim() || "Unassigned";
    if (!tasksByStatus.has(status)) tasksByStatus.set(status, []);
    tasksByStatus.get(status).push(task);
  }
  const configuredStatuses = [...new Set(statuses.map(value => String(value || "").trim()).filter(Boolean))];
  const orderedStatuses = configuredStatuses.filter(status => tasksByStatus.has(status));
  for (const status of tasksByStatus.keys()) {
    if (!orderedStatuses.includes(status)) orderedStatuses.push(status);
  }
  const visibleStatuses = orderedStatuses.length || tasks.length || omitEmptyColumns
    ? orderedStatuses
    : configuredStatuses;
  return visibleStatuses.map(status => ({
    status,
    color: getStatusColor(status) || "#76a9ff",
    tasks: [...(tasksByStatus.get(status) || [])]
  }));
}

export function latestDocumentationCards(blogs = [], limit = DOCUMENTATION_LIMIT) {
  const safeLimit = Math.max(0, Math.trunc(Number(limit) || 0));
  return [...blogs]
    .sort((left, right) => {
      const leftTime = Date.parse(left?.updatedAt || left?.createdAt || "") || 0;
      const rightTime = Date.parse(right?.updatedAt || right?.createdAt || "") || 0;
      return rightTime - leftTime || Number(right?.id || 0) - Number(left?.id || 0);
    })
    .slice(0, safeLimit);
}

function documentationCardModel(blog, usersById, projectsById) {
  const latestEdit = (blog.history || []).find(item => item.action === "Updated") || null;
  const author = usersById.get(Number(latestEdit?.userId || blog.createdByUserId));
  const project = projectsById.get(Number(blog.projectId || 0));
  return {
    title: blog.title || "Untitled Documentation",
    bodyText: documentationPlainText(blog.bodyHtml),
    imageUrl: documentationFirstImageUrl(blog.bodyHtml),
    projectCode: project?.code || "General",
    visibility: blog.isPrivate !== false ? "Private" : "Public",
    isPinned: Boolean(blog.isPinned),
    metaLabel: latestEdit ? "Last Edited by" : "Created by",
    authorName: documentationUserName(author),
    metaDate: documentationCardDate(latestEdit?.createdAt || blog.updatedAt || blog.createdAt),
    attachmentCount: (blog.attachments || []).length
  };
}

function documentationPlainText(bodyHtml) {
  const template = document.createElement("template");
  template.innerHTML = String(bodyHtml || "");
  return String(template.content.textContent || "")
    .replace(/\s+/g, " ")
    .trim() || "No document preview is available.";
}

function documentationFirstImageUrl(bodyHtml) {
  const template = document.createElement("template");
  template.innerHTML = String(bodyHtml || "");
  return appUrl(template.content.querySelector("img")?.getAttribute("src") || "");
}

function documentationUserName(user) {
  if (!user) return "User";
  const fullName = [user.firstName, user.lastName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const nickname = String(user.nickname || "").trim();
  return fullName || nickname || "User";
}

function documentationCardDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function createGallerySectionLabel({ text, width, resources, maxAnisotropy }) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "rgba(5, 18, 35, 0.82)");
  gradient.addColorStop(0.5, "rgba(12, 40, 67, 0.96)");
  gradient.addColorStop(1, "rgba(5, 18, 35, 0.82)");
  roundedFill(context, 18, 18, canvas.width - 36, canvas.height - 36, 54, gradient);
  context.lineWidth = 7;
  context.strokeStyle = "rgba(95, 213, 255, 0.9)";
  roundedRect(context, 18, 18, canvas.width - 36, canvas.height - 36, 54);
  context.stroke();
  context.shadowColor = "rgba(95, 213, 255, 0.78)";
  context.shadowBlur = 24;
  drawText(context, text, canvas.width / 2, canvas.height / 2 + 3, {
    align: "center",
    baseline: "middle",
    color: "#f4fbff",
    font: "700 104px 'Segoe UI', Arial, sans-serif"
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(16, maxAnisotropy);
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(width, SECTION_LABEL_HEIGHT);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    depthWrite: false
  });
  const label = new THREE.Mesh(geometry, material);
  label.name = `${text} Gallery Label`;
  label.renderOrder = 4;
  resources.add(texture);
  resources.add(geometry);
  resources.add(material);
  return label;
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
  textureHeight = BASE_TEXTURE_HEIGHT,
  resources,
  refreshers,
  glassMaterials,
  maxAnisotropy
}) {
  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
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
  } else if (draw === drawDocumentationCard && chart.imageUrl) {
    void loadImage(chart.imageUrl)
      .then(image => {
        avatarImages.set("documentation-image", image);
        redraw();
      })
      .catch(redraw);
  } else if (draw === drawKanbanColumn) {
    void loadKanbanAssets(chart.tasks, avatarImages).then(redraw).catch(redraw);
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
  material.color.set(0x10263b);
  material.emissive.set(0x06111d);
  material.emissiveIntensity = 0.16;
  material.opacity = 0.54;
  material.transmission = 0.52;
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

function drawDocumentationCard(context, chart, images) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  const surfaceGradient = context.createLinearGradient(0, 0, width, height);
  surfaceGradient.addColorStop(0, "rgba(12, 25, 40, 0.98)");
  surfaceGradient.addColorStop(1, "rgba(5, 14, 25, 0.98)");
  roundedFill(context, 12, 12, width - 24, height - 24, 28, surfaceGradient);
  context.lineWidth = 3;
  context.strokeStyle = "rgba(126, 190, 255, 0.32)";
  roundedRect(context, 12, 12, width - 24, height - 24, 28);
  context.stroke();

  drawWrappedText(context, chart.title, 42, 38, width - 84, 51, 2, {
    color: palette.textPrimary,
    font: "700 43px 'Segoe UI', Arial, sans-serif"
  });

  const badgeY = 154;
  let badgeX = 42;
  badgeX += drawDocumentationBadge(context, chart.projectCode, badgeX, badgeY, "#35c7bd") + 14;
  badgeX += drawDocumentationBadge(
    context,
    chart.visibility,
    badgeX,
    badgeY,
    chart.visibility === "Private" ? "#9f9cff" : "#74c476"
  ) + 14;
  if (chart.isPinned) drawDocumentationBadge(context, "Pinned", badgeX, badgeY, "#e4a53a");

  drawText(context, `${chart.metaLabel}: ${chart.authorName}`, 42, 207, {
    color: palette.textSecondary,
    font: "600 24px 'Segoe UI', Arial, sans-serif",
    maxWidth: width * 0.64
  });
  drawText(context, chart.metaDate, width - 42, 207, {
    color: palette.textSecondary,
    font: "500 23px 'Segoe UI', Arial, sans-serif",
    align: "right"
  });

  const image = images.get("documentation-image");
  const previewTop = 238;
  const previewBottom = height - 76;
  let textX = 42;
  let textWidth = width - 84;
  if (image) {
    const imageWidth = Math.round(width * 0.31);
    drawDocumentationImage(context, image, 42, previewTop, imageWidth, previewBottom - previewTop);
    textX = 42 + imageWidth + 30;
    textWidth = width - textX - 42;
  }
  drawWrappedText(context, chart.bodyText, textX, previewTop + 4, textWidth, 37, 7, {
    color: "#d9e5e8",
    font: "500 27px 'Segoe UI', Arial, sans-serif"
  });

  context.fillStyle = "rgba(255, 255, 255, 0.1)";
  context.fillRect(42, height - 61, width - 84, 2);
  drawText(
    context,
    chart.attachmentCount
      ? `${chart.attachmentCount} attachment${chart.attachmentCount === 1 ? "" : "s"}`
      : "Documentation",
    42,
    height - 29,
    {
      color: palette.textSecondary,
      font: "600 22px 'Segoe UI', Arial, sans-serif"
    }
  );
}

function drawDocumentationBadge(context, text, x, y, color) {
  context.font = "700 21px 'Segoe UI', Arial, sans-serif";
  const width = Math.ceil(context.measureText(text).width) + 30;
  roundedFill(context, x, y - 26, width, 38, 18, `${color}33`);
  context.lineWidth = 2;
  context.strokeStyle = `${color}aa`;
  roundedRect(context, x, y - 26, width, 38, 18);
  context.stroke();
  drawText(context, text, x + width / 2, y - 6, {
    color,
    font: "700 21px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle"
  });
  return width;
}

function drawDocumentationImage(context, image, x, y, width, height) {
  context.save();
  roundedRect(context, x, y, width, height, 18);
  context.clip();
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderWidth = image.naturalWidth * scale;
  const renderHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - renderWidth) / 2,
    y + (height - renderHeight) / 2,
    renderWidth,
    renderHeight
  );
  context.restore();
}

function drawKanbanColumn(context, column, avatarImages) {
  clearTexture(context);
  const { width, height } = context.canvas;
  const palette = chartPalette();
  const primary = resolveColor("var(--color-primary)");
  roundedFill(context, 10, 10, width - 20, height - 20, 32, "#171c1f");
  context.lineWidth = 3;
  context.strokeStyle = "rgba(255, 255, 255, 0.14)";
  roundedRect(context, 10, 10, width - 20, height - 20, 32);
  context.stroke();

  drawText(context, column.status, 46, 96, {
    color: palette.textPrimary,
    font: "750 43px 'Segoe UI', Arial, sans-serif",
    baseline: "middle",
    maxWidth: width - 215
  });
  drawKanbanPill(context, String(column.tasks.length), width - 152, 64, {
    background: "#22292d",
    border: "rgba(255, 255, 255, 0.16)",
    color: palette.textPrimary,
    minWidth: 104
  });
  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  context.fillRect(38, 154, width - 76, 2);

  const visibleTasks = column.tasks.slice(0, KANBAN_MAX_VISIBLE_TASKS);
  const taskTop = 184;
  const taskGap = 20;
  const footerHeight = column.tasks.length > KANBAN_MAX_VISIBLE_TASKS ? 98 : 38;
  const cardHeight = Math.min(
    410,
    Math.floor((height - taskTop - footerHeight - taskGap * Math.max(0, visibleTasks.length - 1) - 34)
      / Math.max(1, visibleTasks.length))
  );

  if (!visibleTasks.length) {
    drawText(context, "No tasks.", width / 2, 260, {
      color: palette.textSecondary,
      font: "600 30px 'Segoe UI', Arial, sans-serif",
      align: "center"
    });
  }

  visibleTasks.forEach((task, index) => {
    const y = taskTop + index * (cardHeight + taskGap);
    drawKanbanTaskCard(context, task, avatarImages, 38, y, width - 76, cardHeight, primary, palette);
  });

  if (column.tasks.length > KANBAN_MAX_VISIBLE_TASKS) {
    drawText(
      context,
      `+${column.tasks.length - KANBAN_MAX_VISIBLE_TASKS} more task${column.tasks.length - KANBAN_MAX_VISIBLE_TASKS === 1 ? "" : "s"}`,
      width / 2,
      height - 50,
      {
        color: palette.textSecondary,
        font: "700 28px 'Segoe UI', Arial, sans-serif",
        align: "center"
      }
    );
  }
}

function drawKanbanTaskCard(context, task, avatarImages, x, y, width, height, primary, palette) {
  const isBug = String(task.taskType || "").toLowerCase() === "bug";
  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.34)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 7;
  roundedFill(context, x, y, width, height, 24, "#22292d");
  context.restore();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  roundedRect(context, x, y, width, height, 24);
  context.stroke();

  const avatarAreaWidth = 210;
  drawKanbanAvatarStack(
    context,
    task.assignees || [],
    avatarImages,
    x + 78,
    y + 99,
    57,
    palette
  );
  const summaryX = x + avatarAreaWidth;
  const summaryWidth = width - avatarAreaWidth - 34;
  drawText(context, task.code || `TASK-${task.id || ""}`, summaryX, y + 54, {
    color: primary,
    font: "800 27px 'Segoe UI', Arial, sans-serif",
    maxWidth: summaryWidth * 0.56
  });

  if (isBug) {
    const bugImage = avatarImages.get("kanban-bug-icon");
    if (bugImage) {
      context.drawImage(bugImage, x + width - 76, y + 28, 44, 44);
    } else {
      drawKanbanPill(context, "BUG", x + width - 106, y + 25, {
        background: "rgba(238, 107, 112, 0.18)",
        border: "rgba(238, 107, 112, 0.6)",
        color: "#ff9aa0",
        font: "800 19px 'Segoe UI', Arial, sans-serif"
      });
    }
  } else {
    drawKanbanPill(context, task.taskType || "Dev", x + width - 150, y + 24, {
      background: "#171c1f",
      border: "rgba(255, 255, 255, 0.14)",
      color: palette.textPrimary,
      font: "700 20px 'Segoe UI', Arial, sans-serif"
    });
  }

  drawWrappedText(context, task.title || "Untitled task", summaryX, y + 86, summaryWidth, 38, 3, {
    color: palette.textPrimary,
    font: "600 29px 'Segoe UI', Arial, sans-serif"
  });

  let tagX = summaryX;
  const tagY = y + Math.min(height - 154, 218);
  if (task.priority) {
    tagX += drawKanbanPill(context, task.priority, tagX, tagY, kanbanBadgeStyle("priority", task.priority)) + 12;
  }
  if (isBug && task.severity) {
    drawKanbanPill(context, task.severity, tagX, tagY, kanbanBadgeStyle("severity", task.severity));
  }

  const percent = kanbanTaskPercent(task);
  const progressLabelY = y + height - 79;
  drawText(context, `${percent}%`, x + width / 2, progressLabelY, {
    color: palette.textSecondary,
    font: "650 23px 'Segoe UI', Arial, sans-serif",
    align: "center",
    baseline: "middle"
  });
  const progressX = x + 34;
  const progressY = y + height - 48;
  const progressWidth = width - 68;
  roundedFill(context, progressX, progressY, progressWidth, 16, 8, "#171c1f");
  if (percent > 0) {
    roundedFill(
      context,
      progressX,
      progressY,
      progressWidth * percent / 100,
      16,
      8,
      kanbanProgressColor(percent)
    );
  }
}

function drawKanbanAvatarStack(context, users, avatarImages, x, y, radius, palette) {
  const visibleUsers = users.slice(0, 3);
  visibleUsers.forEach((user, index) => {
    const avatarX = x + index * radius * 0.62;
    const image = avatarImages.get(String(user.id));
    context.save();
    context.beginPath();
    context.arc(avatarX, y, radius, 0, Math.PI * 2);
    context.clip();
    if (image) {
      const scale = Math.max((radius * 2) / image.naturalWidth, (radius * 2) / image.naturalHeight);
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        avatarX - imageWidth / 2,
        y - imageHeight / 2,
        imageWidth,
        imageHeight
      );
    } else {
      context.fillStyle = avatarColor(user.id);
      context.fillRect(avatarX - radius, y - radius, radius * 2, radius * 2);
      drawText(context, userInitials(user), avatarX, y + 1, {
        color: "#ffffff",
        font: `800 ${Math.round(radius * 0.72)}px 'Segoe UI', Arial, sans-serif`,
        align: "center",
        baseline: "middle"
      });
    }
    context.restore();
    context.beginPath();
    context.arc(avatarX, y, radius, 0, Math.PI * 2);
    context.lineWidth = 5;
    context.strokeStyle = "#22292d";
    context.stroke();
  });

  if (users.length > visibleUsers.length) {
    const extraX = x + visibleUsers.length * radius * 0.62;
    context.beginPath();
    context.arc(extraX, y, radius, 0, Math.PI * 2);
    context.fillStyle = "#171c1f";
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = "#22292d";
    context.stroke();
    drawText(context, `+${users.length - visibleUsers.length}`, extraX, y + 1, {
      color: palette.textPrimary,
      font: `800 ${Math.round(radius * 0.52)}px 'Segoe UI', Arial, sans-serif`,
      align: "center",
      baseline: "middle"
    });
  }
}

function drawKanbanPill(context, text, x, y, options = {}) {
  const font = options.font || "700 22px 'Segoe UI', Arial, sans-serif";
  context.font = font;
  const width = Math.max(options.minWidth || 0, Math.ceil(context.measureText(String(text || "")).width) + 34);
  roundedFill(context, x, y, width, 52, 26, options.background || "#171c1f");
  context.lineWidth = 2;
  context.strokeStyle = options.border || "rgba(255, 255, 255, 0.14)";
  roundedRect(context, x, y, width, 52, 26);
  context.stroke();
  drawText(context, text, x + width / 2, y + 27, {
    color: options.color || "#edf3f2",
    font,
    align: "center",
    baseline: "middle"
  });
  return width;
}

function kanbanBadgeStyle(kind, value) {
  const normalized = String(value || "").toLowerCase();
  const family = kind === "severity"
    ? normalized === "critical" ? "danger" : normalized === "major" ? "warning" : normalized === "minor" ? "success" : "info"
    : ["highest", "high"].includes(normalized) ? "danger" : normalized === "medium" ? "warning" : normalized === "low" ? "success" : "info";
  const colors = {
    danger: { background: "rgba(238, 107, 112, 0.17)", border: "rgba(238, 107, 112, 0.55)", color: "#ff9aa0" },
    warning: { background: "rgba(228, 165, 58, 0.17)", border: "rgba(228, 165, 58, 0.55)", color: "#f0bd64" },
    success: { background: "rgba(116, 196, 118, 0.17)", border: "rgba(116, 196, 118, 0.55)", color: "#9bd89d" },
    info: { background: "rgba(118, 169, 255, 0.17)", border: "rgba(118, 169, 255, 0.55)", color: "#a6c6ff" }
  };
  return { ...colors[family], font: "700 20px 'Segoe UI', Arial, sans-serif" };
}

function kanbanTaskPercent(task) {
  const value = task.subTasks?.length
    ? task.subTaskAveragePercent ?? task.percentCompleted
    : task.percentCompleted;
  return Math.round(THREE.MathUtils.clamp(Number(value || 0), 0, 100));
}

function kanbanProgressColor(percent) {
  if (percent >= 80) return resolveColor("var(--color-success)");
  if (percent <= 30) return resolveColor("var(--color-danger)");
  return resolveColor("var(--color-warning)");
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

async function loadKanbanAssets(tasks, avatarImages) {
  const users = new Map();
  for (const task of tasks) {
    for (const user of task.assignees || []) {
      if (user?.id !== undefined) users.set(String(user.id), user);
    }
  }
  const loads = [...users.values()].map(async user => {
    const source = user.avatarUrl || "/assets/avatar-default.svg";
    const resolved = new URL(appUrl(source), window.location.href);
    if (resolved.protocol !== "data:" && resolved.origin !== window.location.origin) return;
    const image = await loadImage(resolved.href);
    avatarImages.set(String(user.id), image);
  });
  loads.push(
    loadImage(appUrl("/assets/bug.svg?v=20260629-kanban-gantt-bug-icon"))
      .then(image => avatarImages.set("kanban-bug-icon", image))
  );
  await Promise.allSettled(loads);
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
  return {
    pageMuted: "#171c1f",
    textPrimary: "#edf3f2",
    textSecondary: "#a0adb1",
    chartMarkText: "#ffffff",
    surfaceDivider: "#1c2225",
    avatarOutline: "rgba(255, 255, 255, 0.11)",
    gridLine: "rgba(255, 255, 255, 0.11)"
  };
}

function resolveColor(value) {
  const raw = String(value || "").trim();
  const variable = raw.match(/^var\((--[^)]+)\)$/)?.[1];
  if (!variable) return raw || "#2686fe";
  return DARK_CHART_VARIABLES[variable] || "#2686fe";
}

function normalizeHexColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
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
