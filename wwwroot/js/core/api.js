import { appUrl } from "../shared/app-urls.js";

let currentUserIdProvider = () => 0;

export function setCurrentUserIdProvider(provider) {
  currentUserIdProvider = typeof provider === "function" ? provider : () => 0;
}

export async function api(path, options = {}) {
  const headers = { "X-PMT-UserId": String(currentUserIdProvider() || 0) };
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
  return response.json();
}

async function normalizeApiError(response) {
  const problem = await response.json().catch(() => null);
  const error = new Error(problem?.error || response.statusText || "Request failed.");
  error.code = problem?.code || "";
  return error;
}
