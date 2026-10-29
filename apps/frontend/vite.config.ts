import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const src = (sub: string) => new URL(`./src/${sub}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [
    react(),
    // Service worker escrito à mão (src/sw.ts) só pra push: sem precache e
    // sem handler de `fetch`, ele não intercepta nenhuma requisição — o site
    // carrega exatamente como antes (sempre da rede), inclusive pra quem não
    // instala nem ativa notificações. `injectionPoint: undefined` desliga a
    // injeção do manifesto de precache do Workbox.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "script",
      injectManifest: {
        injectionPoint: undefined,
      },
      manifest: {
        name: "7Futevôlei",
        short_name: "7Futevôlei",
        description: "Inscrição nas aulas de futevôlei da 7Futevôlei",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F4F8F8",
        theme_color: "#FFFFFF",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // Liga o service worker também no `pnpm dev`, pra dar pra testar push
      // em http://localhost:5173 (navegador só libera push em HTTPS ou localhost).
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
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
    // Libera os túneis HTTPS pra testar login/PWA/push no celular contra o
    // ambiente local — por IP da rede o navegador não libera push:
    // Tailscale Funnel (endereço fixo, `tailscale funnel 5173`) e o túnel
    // rápido do Cloudflare (`cloudflared tunnel --url http://localhost:5173`).
    allowedHosts: [".ts.net", ".trycloudflare.com"],
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
