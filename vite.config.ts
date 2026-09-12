import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { roomPlugin } from "./server/rooms.mjs";

function allowedProxyHosts(apiUrl: string): string[] {
  const hosts = new Set(["bullwavegames.onrender.com", ".onrender.com"]);
  try {
    const { hostname } = new URL(apiUrl);
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") hosts.add(hostname);
  } catch {
    /* invalid VITE_API_URL is handled by the proxy error page */
  }
  return [...hosts];
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
  const allowedHosts = allowedProxyHosts(apiTarget);
  return {
    plugins: [react(), roomPlugin()],
    preview: {
      host: true,
      allowedHosts,
    },
    server: {
    port: 5173,
    host: true,
    allowedHosts,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("headersSent" in res && res.headersSent) return;
            if ("writeHead" in res) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "The Bullwave API could not be reached. Check VITE_API_URL and the backend health status.",
                  code: "API_DOWN",
                }),
              );
            }
          });
        },
      },
    },
    },
  };
});
