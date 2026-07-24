import { appUrl } from "../shared/app-urls.js";

export async function api(path, options = {}) {
  const headers = {};
  const bodyIsForm = options.body instanceof FormData;

  if (!bodyIsForm && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(appUrl(path), {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });

  if (!response.ok) {
    throw await normalizeApiError(response);
  }

  if (response.status === 204) return null;
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error("PMT returned a page instead of API data. Rebuild/restart the .NET app so the Public Link endpoint is active.");
  }
  return response.json();
}

async function normalizeApiError(response) {
  const problem = await response.json().catch(() => null);
  const error = new Error(problem?.error || response.statusText || "Request failed.");
  error.code = problem?.code || "";
  error.status = response.status;
  return error;
}
