import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "client/public",
  build: {
    outDir: "dist/client",
    emptyOutDir: false,
    sourcemap: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true
      },
      "/tray": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  }
});
