import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Modules under test import lib/env, which validates process.env at
      // module load; tests must not require a real environment.
      SKIP_ENV_VALIDATION: "1",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next aliases this sentinel by server/client graph. Unit tests run the
      // server module directly, so use Next's inert server-side target here.
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js"
      ),
    },
  },
});
