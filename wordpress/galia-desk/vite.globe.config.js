import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src-globe/main.js", import.meta.url)),
      formats: ["iife"],
      name: "GaliaGlobe",
      fileName: () => "globe.js",
    },
    outDir: fileURLToPath(new URL("./assets", import.meta.url)),
    emptyOutDir: false,
    minify: true,
  },
});
