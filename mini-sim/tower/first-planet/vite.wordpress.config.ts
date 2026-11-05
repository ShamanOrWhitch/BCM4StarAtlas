import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "wp-dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./src/first-planet-embed.tsx", import.meta.url)),
      name: "BCMFirstPlanet",
      formats: ["iife"],
      fileName: () => "first-planet.js",
      cssFileName: "first-planet",
    },
    rollupOptions: {
      // WordPress has no React/Three globals. Ship one self-contained file,
      // and make the IIFE global the default export (so .mount is real).
      external: [],
      output: {
        exports: "default",
        inlineDynamicImports: true,
      },
    },
  },
});
