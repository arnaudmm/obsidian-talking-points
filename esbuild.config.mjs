// Bundle src/main.ts into main.js, the file Obsidian loads.
// Usage: node esbuild.config.mjs [--dev]   (--dev adds an inline source map)
import { build } from "esbuild";
import { builtinModules } from "node:module";

const dev = process.argv.includes("--dev");

try {
  await build({
    entryPoints: ["src/main.ts"],
    outfile: "main.js",
    bundle: true,
    format: "cjs",
    target: "es2022",
    platform: "browser",
    sourcemap: dev ? "inline" : false,
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
    logLevel: "info",
  });
} catch {
  process.exit(1);
}
