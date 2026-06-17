// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));
const entitiesDir = path.resolve(process.cwd(), "node_modules/entities");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: path.join(entitiesDir, "lib/decode.js") },
        { find: /^entities\/lib\/encode\.js$/, replacement: path.join(entitiesDir, "lib/encode.js") },
        { find: /^entities$/, replacement: entitiesDir },
      ],
    },
  },
});
