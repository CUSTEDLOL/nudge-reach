import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Local linked worktrees can contain their own generated `.next` output.
    // They are separate checkouts and must be linted from their own roots.
    ".worktrees/**",
    ".claude/worktrees/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
