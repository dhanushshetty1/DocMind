import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/swagger-ui": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/v3/api-docs": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
      "/webjars": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
});
