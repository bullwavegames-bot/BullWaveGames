import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { roomPlugin } from "./server/rooms.mjs";

export default defineConfig({
  plugins: [react(), roomPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("headersSent" in res && res.headersSent) return;
            if ("writeHead" in res) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "The Bullwave API is not running. Start the backend on port 8787 after Docker Postgres is up.",
                  code: "API_DOWN",
                }),
              );
            }
          });
        },
      },
    },
  },
});
