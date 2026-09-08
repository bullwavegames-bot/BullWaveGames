import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir(".docx-work/game-tests", { recursive: true });
await build({
  entryPoints: ["tests/collection.test.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".docx-work/game-tests/collection.mjs",
  loader: { ".css": "empty" },
  jsx: "automatic",
});
await import("../.docx-work/game-tests/collection.mjs");
await build({
  entryPoints: ["tests/controls.test.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".docx-work/game-tests/controls.mjs",
  loader: { ".css": "empty" },
  jsx: "automatic",
});
await import("../.docx-work/game-tests/controls.mjs");
