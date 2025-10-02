import { auth } from "../firebase/auth";

const DEFAULT_LOCAL_BASE_URL = "http://localhost:7000/api";
const DEFAULT_PROD_BASE_URL =
  "https://us-central1-test-chat-app-888.cloudfunctions.net/api";

function detectNetworkBaseUrl() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const hostname = window.location.hostname;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return null;
  }

  const protocol = window.location.protocol || "http:";
  const port = (import.meta.env.VITE_BACKEND_PORT ?? "7000").toString().trim();
  const formattedHost = hostname.includes(":") ? `[${hostname}]` : hostname;

  return port ? `${protocol}//${formattedHost}:${port}` : `${protocol}//${formattedHost}`;
}

const runtimeDetectedBaseUrl = detectNetworkBaseUrl();

const resolvedBaseUrl =
  import.meta.env.VITE_BACKEND_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  runtimeDetectedBaseUrl ??
  (import.meta.env.DEV ? DEFAULT_LOCAL_BASE_URL : DEFAULT_PROD_BASE_URL);

const API_BASE_URL = normalizeBaseUrl(sanitizeBaseUrl(resolvedBaseUrl));

function sanitizeBaseUrl(value) {
  if (!value || typeof value !== "string") {
    return import.meta.env.DEV ? DEFAULT_LOCAL_BASE_URL : DEFAULT_PROD_BASE_URL;
  }

  const trimmed = value.trim();
  // 避免在正式環境仍指向本機端點。
  if (
    !import.meta.env.DEV &&
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(trimmed)
  ) {
    return DEFAULT_PROD_BASE_URL;
  }

  return trimmed;
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") {
    return DEFAULT_LOCAL_BASE_URL;
  }

  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

export async function apiRequest(path, options = {}) {
  if (typeof path !== "string" || !path.length) {
    throw new Error("API request path must be a non-empty string");
  }

  const isAbsoluteUrl = path.startsWith("http");
  const normalizedPath = isAbsoluteUrl
    ? path
    : path.startsWith("/")
    ? path
    : `/${path}`;
  const url = isAbsoluteUrl
    ? normalizedPath
    : `${API_BASE_URL}${normalizedPath}`;
  const requestInit = { ...options };
  requestInit.method = requestInit.method ?? "GET";

  const headers = new Headers(requestInit.headers || {});

  const user = auth.currentUser;
  if (!user) {
    throw new Error("尚未登入，請重新登入後再試");
  }

  const token = await user.getIdToken();
  headers.set("Authorization", `Bearer ${token}`);

  if (requestInit.body && !(requestInit.body instanceof FormData)) {
    if (typeof requestInit.body === "object") {
      headers.set(
        "Content-Type",
        headers.get("Content-Type") ?? "application/json"
      );
      requestInit.body = JSON.stringify(requestInit.body);
    }
  }

  requestInit.headers = headers;

  const response = await fetch(url, requestInit);

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    error.url = url;
    throw error;
  }

  return payload;
}

