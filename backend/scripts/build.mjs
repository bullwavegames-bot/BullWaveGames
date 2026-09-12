import { cp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(backendDir, "dist");

await rm(outputDir, { recursive: true, force: true });

await new Promise((resolve, reject) => {
  const compiler = spawn(process.execPath, [path.join(backendDir, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"], {
    cwd: backendDir,
    stdio: "inherit",
  });
  compiler.once("error", reject);
  compiler.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`TypeScript build failed with exit code ${code}.`)));
});

await cp(path.join(backendDir, "shared"), path.join(outputDir, "backend/shared"), { recursive: true });
await cp(path.join(backendDir, "migrations"), path.join(outputDir, "backend/migrations"), { recursive: true });
