import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Override with BACKEND_URL when the API runs elsewhere than localhost:8000.
const backend = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": backend,
      "/health": backend,
    },
  },
});
