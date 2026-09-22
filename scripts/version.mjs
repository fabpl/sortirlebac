/**
 * Écrit l'empreinte du commit déployé dans public/version.txt.
 *
 * Sert à savoir quelle version un domaine sert réellement — question qui s'est
 * posée pour de bon pendant la mise en ligne, faute de pouvoir dater un
 * déploiement autrement. Généré à chaque build, donc jamais périmé, et pas
 * versionné.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

function empreinte() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "inconnue";
  }
}

writeFileSync(join(RACINE, "public", "version.txt"),
              `${empreinte()}\n${new Date().toISOString()}\n`);
