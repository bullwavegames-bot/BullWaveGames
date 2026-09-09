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
      },
    },
  },
});
