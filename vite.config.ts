import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "validate-env",
        buildStart() {
          const missing: string[] = [];
          if (!env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
          if (!env.VITE_SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
          if (missing.length > 0) {
            this.error(
              `Missing required environment variables: ${missing.join(", ")}.\n` +
              "Configure them in Cloudflare Pages Dashboard → Settings → Environment Variables → Production.\n" +
              "For local dev, create .env.local with these values."
            );
          }
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "Nancy OS",
          short_name: "NancyOS",
          description: "Personal AI Life Operating System",
          theme_color: "#FAF8F5",
          background_color: "#FAF8F5",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
