import { supabase } from "./supabaseClient";

function localApiBase(url: string) {
  try {
    const parsed = new URL(url);
    const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    return localHost && (parsed.port === "8787" || parsed.port === "");
  } catch {
    return false;
  }
}

const configuredApi = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

/** In Vite dev, call `/api` same-origin so the proxy forwards to Fastify and CORS is not involved. */
export const API_URL = import.meta.env.DEV && localApiBase(configuredApi) ? "" : configuredApi;

type ApiErrorBody = {
  ok?: boolean;
  error?: string | { description?: string; message?: string };
  message?: string;
};

function apiErrorMessage(body: ApiErrorBody, status: number): string {
  if (typeof body.error === "string") return body.error;
  if (body.error?.description) return body.error.description;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  return `Request failed (${status})`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
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
