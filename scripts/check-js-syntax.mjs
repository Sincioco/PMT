import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const roots = ["wwwroot/js", "tests/js", "tests/browser", "scripts"];
const files = [];

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectJavaScriptFiles(path);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      files.push(path);
    }
  }
}

for (const root of roots) {
  await collectJavaScriptFiles(root);
}

for (const file of files.sort()) {
  await execFileAsync(process.execPath, ["--check", file]);
}

console.log(`Syntax checked ${files.length} JavaScript modules.`);
