import { watch } from "node:fs/promises";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const watchedDirs = ["src", "frontend/src", "contracts"].filter((d) =>
  existsSync(d),
);

if (watchedDirs.length === 0) {
  console.error("[openwiki] aucun dossier source à surveiller.");
  process.exit(1);
}

let timer = null;
let running = false;

function update() {
  if (running) return;
  running = true;
  console.log(`\n[openwiki] changement détecté — mise à jour de la doc...`);
  const started = Date.now();
  try {
    execSync("npx openwiki code --update --print --language fr", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    console.log(`[openwiki] doc à jour (${((Date.now() - started) / 1000).toFixed(1)}s).`);
  } catch (err) {
    console.error("[openwiki] échec de la mise à jour :", err.message);
  } finally {
    running = false;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(update, 8000);
}

for (const dir of watchedDirs) {
  watch(dir, { recursive: true }, (_event, filename) => {
    if (filename && filename.includes("openwiki/")) return;
    schedule();
  });
}

console.log(
  `[openwiki] surveillance de : ${watchedDirs.join(", ")} (debounce 8s) — Ctrl-C pour arrêter.`,
);
