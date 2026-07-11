import * as THREE from "../../vendor/three/three.module.min.js";
import { appUrl } from "../../shared/app-urls.js";

export const WORKLOAD_BILLBOARD_WIDTH = 21.5;
export const WORKLOAD_BILLBOARD_HEIGHT = 10.5;
export const WORKLOAD_BILLBOARD_Z = -15;

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
export function createAboutWorkloadBillboard({ workload, resources, maxAnisotropy = 1 }) {
  const group = new THREE.Group();
  group.name = "PMT Developer Workload LED Screen";
  group.position.set(0, 1.15, WORKLOAD_BILLBOARD_Z);

  const workloadTexture = createWorkloadTexture(workload);
  const chartTexture = workloadTexture.texture;
  chartTexture.anisotropy = Math.min(16, maxAnisotropy);
  const panelWidth = WORKLOAD_BILLBOARD_WIDTH - 1.15;
  const panelHeight = WORKLOAD_BILLBOARD_HEIGHT - 1.05;
  const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
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
  const glassSurface = new THREE.Mesh(panelGeometry, glassMaterial);
  glassSurface.renderOrder = 0;
  group.add(glassSurface);

  const chartGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
  // Keep the chart texture unlit so status colors and text remain identical to
  // the Dev Tasks card. Transparent texture pixels reveal only the glass plane.
  const chartMaterial = new THREE.MeshBasicMaterial({
    map: chartTexture,
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
  group.add(chartSurface);

  resources.add(chartTexture);
  resources.add(panelGeometry);
  resources.add(glassMaterial);
  resources.add(chartGeometry);
  resources.add(chartMaterial);

  const themeObserver = new MutationObserver(() => {
    workloadTexture.refresh();
    updateGlassMaterial(glassMaterial);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  return {
    group,
    target: group.position.clone().add(new THREE.Vector3(0, 0.35, 0)),
    dispose() {
      themeObserver.disconnect();
    }
  };
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

function createWorkloadTexture(workload) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  const avatarImages = new Map();
  drawWorkloadChart(context, workload, avatarImages);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  void loadWorkloadAvatars(workload.rows, avatarImages).then(() => {
    drawWorkloadChart(context, workload, avatarImages);
    texture.needsUpdate = true;
  });
  return {
    texture,
    refresh() {
      drawWorkloadChart(context, workload, avatarImages);
      texture.needsUpdate = true;
    }
  };
}

function drawWorkloadChart(context, workload, avatarImages) {
  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const palette = workloadChartPalette();

  context.fillStyle = palette.textSecondary;
  context.font = "700 52px 'Segoe UI', Arial, sans-serif";
  context.textBaseline = "top";
  context.fillText(workload.title, 86, 66);
  context.fillStyle = palette.textSecondary;
  context.font = "500 30px 'Segoe UI', Arial, sans-serif";
  context.fillText(workload.subtitle, 86, 132);

  const rows = workload.rows;
  if (!rows.length) {
    context.fillStyle = palette.textSecondary;
    context.font = "600 42px 'Segoe UI', Arial, sans-serif";
    context.fillText("No assigned Dev Tasks were found for this Project / Sprint filter.", 120, 430);
    drawLegend(context, workload, palette, 880);
    return;
  }

  const chartTop = 218;
  const chartBottom = 832;
  const rowHeight = Math.min(104, (chartBottom - chartTop) / rows.length);
  const avatarX = 112;
  const nameX = 172;
  const totalX = 474;
  const stackX = 532;
  const stackWidth = TEXTURE_WIDTH - stackX - 88;

  rows.forEach((row, index) => {
    const centerY = chartTop + rowHeight * index + rowHeight / 2;
    const avatarRadius = Math.max(19, Math.min(34, rowHeight * 0.34));
    const barHeight = Math.max(38, Math.min(64, rowHeight * 0.62));
    drawAvatar(context, row, avatarImages, avatarX, centerY, avatarRadius, palette);

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = palette.textPrimary;
    context.font = `500 ${Math.max(25, Math.min(34, rowHeight * 0.34))}px 'Segoe UI', Arial, sans-serif`;
    context.fillText(truncateText(context, row.user.nickname || "Developer", totalX - nameX - 26), nameX, centerY);

    context.textAlign = "right";
    context.fillStyle = palette.textPrimary;
    context.font = `700 ${Math.max(25, Math.min(34, rowHeight * 0.34))}px 'Segoe UI', Arial, sans-serif`;
    context.fillText(String(row.total), totalX, centerY);

    context.save();
    roundedRect(context, stackX, centerY - barHeight / 2, stackWidth, barHeight, 8);
    context.clip();
    context.fillStyle = palette.pageMuted;
    context.fillRect(stackX, centerY - barHeight / 2, stackWidth, barHeight);

    const segmentWeights = row.categories.map(category => Math.max(0.08, category.value / row.total));
    const segmentWeightTotal = segmentWeights.reduce((total, value) => total + value, 0);
    let segmentX = stackX;
    row.categories.forEach((category, categoryIndex) => {
      const isLast = categoryIndex === row.categories.length - 1;
      const segmentWidth = isLast
        ? stackX + stackWidth - segmentX
        : Math.round(stackWidth * segmentWeights[categoryIndex] / segmentWeightTotal);
      context.fillStyle = categoryColor(category);
      context.fillRect(segmentX, centerY - barHeight / 2, segmentWidth, barHeight);
      if (categoryIndex > 0) {
        context.fillStyle = palette.surfaceDivider;
        context.fillRect(segmentX, centerY - barHeight / 2, 2, barHeight);
      }
      context.fillStyle = palette.chartMarkText;
      context.font = `700 ${Math.max(22, Math.min(30, barHeight * 0.48))}px 'Segoe UI', Arial, sans-serif`;
      context.textAlign = "center";
      context.fillText(String(category.value), segmentX + segmentWidth / 2, centerY + 1);
      segmentX += segmentWidth;
    });
    context.restore();
  });

  drawLegend(context, workload, palette, 902);
}

function drawLegend(context, workload, palette, y) {
  const usedLabels = new Set(workload.rows.flatMap(row => row.categories.map(category => category.label)));
  const activeCategories = workload.categories.filter(category => usedLabels.has(category.label));
  const legend = activeCategories.length ? activeCategories : workload.categories;
  const itemWidths = legend.map(category => 44 + textWidth(context, category.label, "500 28px 'Segoe UI', Arial, sans-serif") + 52);
  const totalWidth = itemWidths.reduce((total, width) => total + width, 0);
  let x = Math.max(90, (TEXTURE_WIDTH - totalWidth) / 2);
  let rowY = y;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.font = "500 28px 'Segoe UI', Arial, sans-serif";

  legend.forEach((category, index) => {
    const itemWidth = itemWidths[index];
    if (x > 90 && x + itemWidth > TEXTURE_WIDTH - 90) {
      x = 90;
      rowY += 42;
    }
    context.globalAlpha = 0.16;
    context.fillStyle = categoryColor(category);
    context.beginPath();
    context.arc(x + 10, rowY, 18, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.beginPath();
    context.arc(x + 10, rowY, 9, 0, Math.PI * 2);
    context.fill();
    x += 36;
    context.fillStyle = palette.textSecondary;
    context.fillText(category.label, x, rowY);
    x += context.measureText(category.label).width + 52;
  });
}

function workloadChartPalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    pageMuted: color("--color-page-muted", "#eef4fb"),
    textPrimary: color("--color-text-primary", "#0f172a"),
    textSecondary: color("--color-text-secondary", "#475569"),
    border: color("--color-border", "rgba(15, 23, 42, 0.12)"),
    chartMarkText: color("--color-chart-mark-text", "#ffffff"),
    surfaceDivider: color("--color-surface", "#ffffff"),
    avatarOutline: color("--color-border", "rgba(15, 23, 42, 0.12)")
  };
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
    context.fillStyle = "#ffffff";
    context.font = `700 ${Math.round(radius * 0.82)}px 'Segoe UI', Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(userInitials(row.user), x, y + 1);
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

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Avatar could not be loaded."));
    image.src = source;
  });
}

function textWidth(context, text, font) {
  context.font = font;
  return context.measureText(text).width;
}

function categoryColor(category) {
  return category.color || category.fallbackColor || "#2686fe";
}

function avatarColor(userId) {
  const palette = ["#126bff", "#7c3aed", "#0891b2", "#db2777", "#d97706", "#2f9e44"];
  const index = Math.abs(Number(userId) || 0) % palette.length;
  return palette[index];
}

function userInitials(user) {
  const values = [user.firstName, user.lastName].filter(Boolean);
  if (!values.length && user.nickname) values.push(user.nickname);
  return values.map(value => String(value).trim().charAt(0)).join("").slice(0, 2).toUpperCase() || "?";
}

function truncateText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
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
