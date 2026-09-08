import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { roomPlugin } from "./server/rooms.mjs";

export default defineConfig({
  plugins: [react(), roomPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
