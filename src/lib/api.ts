import { supabase } from "./supabaseClient";

const configuredApi = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

function isLoopbackApi(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

/** Same-origin `/api` only when the API is local. Remote APIs are called directly so the Bearer token is not dropped by the proxy. */
export const API_URL = import.meta.env.DEV && isLoopbackApi(configuredApi || "http://127.0.0.1:8787") ? "" : configuredApi;

type ApiErrorBody = {
  ok?: boolean;
  error?: string | { description?: string; message?: string };
  message?: string;
  code?: string;
};

function apiErrorMessage(body: ApiErrorBody, status: number): string {
  if (typeof body.message === "string" && body.message && body.message !== "Unauthorized") return body.message;
  if (typeof body.error === "string" && body.error !== "Unauthorized") return body.error;
  if (body.error?.description) return body.error.description;
  if (body.error?.message) return body.error.message;
  if (body.code === "IDENTITY_LINK_REQUIRED") {
    return "This email already has a Bullwave account. Log in with that account, or use a different email.";
  }
  if (status === 401) return "Sign in to continue.";
  return `Request failed (${status})`;
}

export function newIdempotencyKey(): string {
  return `bw:${crypto.randomUUID()}`;
}

function jwtExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" && json.exp * 1000 < Date.now() + 10_000;
  } catch {
    return true;
  }
}

async function accessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  const current = data.session?.access_token;
  if (current && !jwtExpired(current)) return current;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? current ?? undefined;
}

function requiresSession(path: string): boolean {
  return path === "/api/me" || path.startsWith("/api/me/") || path.startsWith("/api/billing/subscribe") || path.startsWith("/api/billing/verify");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  if (!token && requiresSession(path)) {
    throw new Error("Sign in to continue.");
  }
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "POST" && path === "/api/billing/subscribe" && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", newIdempotencyKey());
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok || json.ok === false) {
    throw new Error(apiErrorMessage(json, response.status));
  }
  return json;
}

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay."));
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description?: string;
      order_id: string;
      prefill?: { email?: string; name?: string };
      theme?: { color?: string };
      modal?: { ondismiss?: () => void };
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}
