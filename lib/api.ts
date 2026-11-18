import { CONFIG } from "./config";
import { clearTokens, getAccessToken } from "./auth";

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

// Join the base URL and the endpoint with exactly one slash, so "//orders" can never happen
const buildUrl = (endpoint: string) =>
  `${CONFIG.API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requiresAuth = false, headers, ...restOptions } = options;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    const token = getAccessToken();
    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(buildUrl(endpoint), {
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...restOptions,
  });

  if (response.status === 401 && requiresAuth) {
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = CONFIG.ROUTES.LOGIN;
    }
    throw new Error("Session expired. Please log in again.");
  }

  const text = await response.text();

  // A server error page (HTML) isn't JSON, so don't let JSON.parse crash with a confusing message
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    const errorMessage = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "An unexpected error occurred.";
    throw new Error(errorMessage);
  }

  return data as T;
}