import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { roomPlugin } from "./server/rooms.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
  return {
    plugins: [react(), roomPlugin()],
    server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyRequest) => {
            // Local Vite is the server-side caller; do not forward the browser Origin to Render.
            proxyRequest.removeHeader("origin");
          });
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
