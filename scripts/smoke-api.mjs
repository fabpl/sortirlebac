/**
 * Charge et invoque la fonction serverless comme le fait la plateforme.
 *
 * Vercel ne bundle pas les fonctions : il transpile chaque `.ts` en `.js`
 * voisin, puis laisse Node résoudre les imports. Les spécificateurs relatifs
 * doivent donc s'écrire en `.js` — convention TypeScript ESM — et un import
 * JSON exige `with { type: "json" }`, le paquet étant en `"type": "module"`.
 *
 * Ni Vitest ni Vite ne voient ces contraintes : ils résolvent les imports
 * eux-mêmes. Le premier déploiement est tombé en FUNCTION_INVOCATION_FAILED
 * avec 25 tests au vert. Ce script reproduit la chaîne réelle : transpilation
 * sans bundle dans un dossier temporaire, puis import sous Node.
 */

import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { glob } from "node:fs/promises";

import * as esbuild from "esbuild";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = mkdtempSync(join(tmpdir(), "sortirlebac-smoke-"));

const CAS = [
  { nom: "point couvert", requete: "lat=46.16295&lon=-1.15359",
    attendu: 200, type: "text/calendar" },
  { nom: "sans coordonnées", requete: "", attendu: 400 },
  { nom: "hors territoire", requete: "lat=48.8566&lon=2.3522", attendu: 404 },
];

try {
  const sources = [];
  for (const dossier of ["api", "lib"]) {
    for await (const fichier of glob(`${dossier}/**/*.ts`, { cwd: RACINE })) {
      sources.push(join(RACINE, fichier));
    }
  }

  await esbuild.build({
    entryPoints: sources,
    outdir: SORTIE,
    outbase: RACINE,
    bundle: false,          // comme Vercel : transpilation seule
    format: "esm",
    platform: "node",
    target: "node22",
  });

  // Le JSON n'est pas transpilé : la plateforme le trace et le recopie.
  mkdirSync(join(SORTIE, "public"), { recursive: true });
  cpSync(join(RACINE, "public", "secteurs.json"),
         join(SORTIE, "public", "secteurs.json"));

  const { GET } = await import(
    pathToFileURL(join(SORTIE, "api", "calendrier.js")).href);

  let echecs = 0;
  for (const { nom, requete, attendu, type } of CAS) {
    const reponse = await GET(
      new Request(`https://exemple.test/calendrier.ics?${requete}`));
    const ok = reponse.status === attendu &&
      (!type || (reponse.headers.get("Content-Type") ?? "").includes(type));

    if (ok) {
      console.log(`  ✓ ${nom} → ${reponse.status}`);
    } else {
      echecs++;
      console.error(`  ✗ ${nom} → ${reponse.status} ` +
                    `(attendu ${attendu}${type ? `, ${type}` : ""})`);
    }
  }

  const corps = await (await GET(
    new Request("https://exemple.test/calendrier.ics?lat=46.16295&lon=-1.15359"))
  ).text();
  const evenements = corps.split("BEGIN:VEVENT").length - 1;

  if (corps.startsWith("BEGIN:VCALENDAR") && evenements > 50) {
    console.log(`  ✓ flux iCalendar complet (${evenements} événements)`);
  } else {
    echecs++;
    console.error(`  ✗ flux inattendu (${evenements} événements)`);
  }

  if (echecs > 0) {
    console.error(`\n✗ ${echecs} échec(s) dans les conditions de la plateforme`);
    process.exit(1);
  }
  console.log("\nLa fonction se charge et répond, transpilée sans bundle.");
} finally {
  rmSync(SORTIE, { recursive: true, force: true });
}
