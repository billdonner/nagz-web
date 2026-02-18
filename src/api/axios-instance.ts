import Axios, { type AxiosRequestConfig } from "axios";
import { getStoredToken } from "../auth";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8001",
  timeout: 30_000,
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 — dispatch event for AuthProvider instead of hard redirect
let handlingUnauthorized = false;
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    if (Axios.isAxiosError(error) && error.response?.status === 401 && !handlingUnauthorized) {
      handlingUnauthorized = true;
      window.dispatchEvent(new Event("nagz:unauthorized"));
      setTimeout(() => { handlingUnauthorized = false; }, 100);
    }
    return Promise.reject(error);
  }
);

/**
 * Extract a user-friendly error message from an axios error.
 * Handles both the ErrorEnvelope format ({error: {message}}) and
 * FastAPI validation format ({detail: ...}).
 */
export function extractErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!Axios.isAxiosError(err)) return fallback;
  const data = err.response?.data;
  if (!data) {
    if (err.code === "ECONNABORTED") return "Request timed out. Please try again.";
    if (err.code === "ERR_NETWORK") return "Network error. Please check your connection.";
    return fallback;
  }
  // ErrorEnvelope format
  if (data.error?.message) return data.error.message;
  // FastAPI validation detail
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join("; ") || fallback;
  }
  return fallback;
}

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const controller = new AbortController();
  const promise = AXIOS_INSTANCE({
    ...config,
    signal: controller.signal,
  }).then(({ data }) => data);

  // @ts-expect-error — attach cancel for react-query
  promise.cancel = () => controller.abort();

  return promise;
};

export default customInstance;
