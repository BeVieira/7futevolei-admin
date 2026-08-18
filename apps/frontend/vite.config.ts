import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (sub: string) => new URL(`./src/${sub}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@components": src("components"),
      "@domain": src("domain"),
      "@pages": src("pages"),
      "@utils": src("utils"),
      "@assets": src("assets"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://backend:3333",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://backend:3333",
        changeOrigin: true,
      },
    },
  },
});
