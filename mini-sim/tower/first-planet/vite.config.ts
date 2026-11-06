import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}


/**
 * First Planet models are stored once under mini-sim/assets.
 * The Grok preview reads that directory in dev/build; WordPress reads it from
 * its existing asset scanner via BCMFirstPlanetConfig.meshBase.
 */
const FIRST_PLANET_DESERT_MESH_FILES = [
  "desert_pack01/cactus_tall.glb",
  "desert_pack01/cactus_cluster.glb",
  "desert_pack01/barrel_cactus_flower.glb",
  "desert_pack01/sandstone_boulders.glb",
  "desert_pack01/sandstone_arch.glb",
  "desert_pack01/stepped_desert_temple.glb",
  "desert_pack01/desert_market_awning.glb",
  "desert_pack01/dead_desert_tree.glb",
  "desert_pack01/small_oasis.glb",
  "desert_pack01/sandstone_column.glb",
  "desert_pack01/desert_race_banner.glb",
  "desert_details/shrub_dry.glb",
  "desert_details/shrub_green.glb",
  "desert_details/shrub_sage.glb",
  "desert_details/cairn_wide.glb",
  "desert_details/cairn_tall.glb",
  "desert_details/cactus_branching.glb",
  "desert_details/rocks_gray.glb",
  "desert_oasis_pack/desert_oasis_pack/oasis_orchid_palms.glb",
  "desert_oasis_pack/desert_oasis_pack/oasis_flower_garden.glb",
  "desert_oasis_pack/desert_oasis_pack/rare_turquoise_bloom.glb",
  "desert_oasis_pack/desert_oasis_pack/orchid_pink.glb",
  "desert_oasis_pack/desert_oasis_pack/orchid_white.glb",
];

/**
 * First Planet keeps its original flat mesh folder and also reads the shared
 * Mini-Sim asset library. The library route accepts safe nested GLB paths.
 */
function firstPlanetMeshPlugin(): Plugin {
  const assetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../assets");
  const legacyMeshRoot = join(assetRoot, "first-planet", "mesh");
  const libraryMeshRoot = join(assetRoot, "mesh");

  return {
    name: "bcm-first-planet-shared-mesh",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawPath = (req.url ?? "").split("?", 1)[0] ?? "";
        const legacyMatch = rawPath.match(/(?:^|\/)mesh\/([^/]+)$/);
        const libraryMatch = rawPath.match(/(?:^|\/)mesh-library\/(.+)$/);
        if (!legacyMatch && !libraryMatch) {
          next();
          return;
        }

        const relativeName = (libraryMatch?.[1] ?? legacyMatch?.[1] ?? "");
        let segments: string[];
        try {
          segments = relativeName.split("/").map((part) => decodeURIComponent(part));
        } catch {
          res.statusCode = 400;
          res.end("Bad mesh path");
          return;
        }
        const validSegments = segments.length > 0 &&
          segments.every((part, index) =>
            index === segments.length - 1
              ? /^[a-z0-9_-]+\.glb$/i.test(part)
              : /^[a-z0-9_-]+$/i.test(part),
          );
        if (
          !validSegments ||
          (!libraryMatch && segments.length !== 1) ||
          (libraryMatch && (segments.length < 2 || segments.length > 4))
        ) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        const root = libraryMatch ? libraryMeshRoot : legacyMeshRoot;
        const file = resolve(root, ...segments);
        const relativeFile = relative(root, file);
        if (!relativeFile || relativeFile.startsWith("..") || isAbsolute(relativeFile)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        try {
          const stat = statSync(file);
          if (!stat.isFile()) {
            next();
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "model/gltf-binary");
          res.setHeader("Content-Length", String(stat.size));
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          createReadStream(file).pipe(res);
        } catch {
          res.statusCode = 404;
          res.end("Not found");
        }
      });
    },
    generateBundle() {
      for (const name of readdirSync(legacyMeshRoot)) {
        if (!/^[a-z0-9_-]+\.glb$/i.test(name)) continue;
        const file = join(legacyMeshRoot, name);
        try {
          if (!statSync(file).isFile()) continue;
          this.emitFile({
            type: "asset",
            fileName: "mesh/" + name,
            source: readFileSync(file),
          });
        } catch {
          // One optional legacy model must not abort the world build.
        }
      }

      for (const name of FIRST_PLANET_DESERT_MESH_FILES) {
        const file = join(libraryMeshRoot, ...name.split("/"));
        try {
          if (!statSync(file).isFile()) continue;
          this.emitFile({
            type: "asset",
            fileName: "mesh-library/" + name,
            source: readFileSync(file),
          });
        } catch {
          // Missing optional scenery stays absent rather than breaking First Planet.
        }
      }
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    firstPlanetMeshPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
