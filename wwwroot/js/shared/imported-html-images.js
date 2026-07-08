import { api } from "../core/api.js";
import { appUrl } from "./app-urls.js";

export async function externalizeImportedHtmlImagesInPayload(payload, fields, options = {}) {
  const uploadsBySource = options.uploadsBySource || new Map();
  let uploaded = 0;
  let failed = 0;

  for (const field of fields) {
    const result = await externalizeImportedHtmlImages(payload[field], {
      ...options,
      uploadsBySource
    });
    payload[field] = result.html;
    uploaded += result.uploaded;
    failed += result.failed;
  }

  return { uploaded, failed };
}

export async function externalizeImportedHtmlImages(html, options = {}) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  const images = [...container.querySelectorAll("img[src^='data:image/']")];
  const uploadsBySource = options.uploadsBySource || new Map();
  let uploaded = 0;
  let failed = 0;

  for (const image of images) {
    const source = image.getAttribute("src") || "";
    const upload = await uploadedImageForSource(source, {
      ...options,
      uploadsBySource
    });
    if (upload?.url) {
      image.setAttribute("src", appUrl(upload.url));
      if (!image.getAttribute("alt")) image.setAttribute("alt", upload.fileName || "Imported image");
      uploaded += 1;
    } else {
      failed += 1;
    }
  }

  return {
    html: container.innerHTML,
    uploaded,
    failed
  };
}

async function uploadedImageForSource(source, options) {
  const uploadsBySource = options.uploadsBySource || new Map();
  if (!uploadsBySource.has(source)) {
    uploadsBySource.set(source, uploadDataUrlImage(source, options.kind || "richtext").catch(() => null));
  }
  return uploadsBySource.get(source);
}

async function uploadDataUrlImage(source, kind) {
  const parsed = dataUrlImage(source);
  if (!parsed) return null;

  const body = new FormData();
  body.append("file", parsed.blob, `imported-image-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionForContentType(parsed.contentType)}`);
  return api(`/api/uploads/${kind}`, { method: "POST", body });
}

function dataUrlImage(source) {
  const match = /^data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.*)$/i.exec(source || "");
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const binary = atob(match[2].replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    contentType,
    blob: new Blob([bytes], { type: contentType })
  };
}

function extensionForContentType(contentType) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/svg+xml") return "svg";
  return contentType.split("/").pop()?.replace(/[^a-z0-9]+/gi, "") || "png";
}
