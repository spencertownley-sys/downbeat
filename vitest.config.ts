import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next resolves server-only to an empty module on the server; tests run
      // server code too, so give them the same empty module.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Booting PGlite and running every migration takes several seconds, close
    // to the 10s default; a slow machine would otherwise skip the whole file.
    hookTimeout: 30_000,
  },
});
