import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: backendDir, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}.`)));
  });
}

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await findTests(target));
    else if (entry.name.endsWith(".test.js")) results.push(target);
  }
  return results;
}

await import("./build.mjs");
const tests = await findTests(path.join(backendDir, "dist/backend/src"));
if (!tests.length) throw new Error("No compiled backend tests were found.");
await run(process.execPath, ["--test", ...tests]);
