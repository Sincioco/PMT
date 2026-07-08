export const appPathBase = normalizePathBase(
  globalThis.document?.querySelector?.('meta[name="pmt-path-base"]')?.getAttribute("content") || ""
);

export function appUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (isExternalUrl(text) || text.startsWith("#") || text.startsWith("./") || text.startsWith("../")) return text;
  if (!text.startsWith("/")) return text;
  if (!appPathBase) return text;
  if (text === appPathBase || text.startsWith(`${appPathBase}/`)) return text;
  return `${appPathBase}${text}`;
}

export function appAbsoluteUrl(value) {
  const text = appUrl(value);
  if (!text) return "";

  try {
    return new URL(text, currentHref()).href;
  } catch {
    return text;
  }
}

export function storageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const absoluteStorageUrl = storageUrlFromAbsolute(text);
  if (absoluteStorageUrl) return absoluteStorageUrl;

  if (appPathBase && (text === appPathBase || text.startsWith(`${appPathBase}/`))) {
    const withoutBase = text.slice(appPathBase.length);
    return withoutBase || "/";
  }

  return text;
}

function storageUrlFromAbsolute(value) {
  if (!appPathBase || !isExternalUrl(value)) return "";

  try {
    const url = new URL(value, currentHref());
    if (url.origin !== currentOrigin()) return "";
    if (url.pathname !== appPathBase && !url.pathname.startsWith(`${appPathBase}/`)) return "";

    const withoutBase = url.pathname.slice(appPathBase.length) || "/";
    return `${withoutBase}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

function isExternalUrl(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//");
}

function currentHref() {
  return globalThis.window?.location?.href || "http://localhost/";
}

function currentOrigin() {
  try {
    return globalThis.window?.location?.origin || new URL(currentHref()).origin;
  } catch {
    return "http://localhost";
  }
}

function normalizePathBase(value) {
  let pathBase = String(value || "").trim().replaceAll("\\", "/");
  if (!pathBase || pathBase === "/") return "";
  if (!pathBase.startsWith("/")) pathBase = `/${pathBase}`;
  return pathBase.replace(/\/+$/g, "");
}
