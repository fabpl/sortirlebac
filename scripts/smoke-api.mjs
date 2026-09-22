/**
 * Charge et invoque la fonction serverless sous le vrai Node, en ESM.
 *
 * Les tests Vitest ne peuvent pas attraper cette classe de bug : Vitest
 * transforme les imports, donc un `import` de JSON sans attribut y passe alors
 * qu'il fait exploser la fonction en production. C'est exactement ce qui est
 * arrivé au premier déploiement — 23 tests au vert, et un
 * FUNCTION_INVOCATION_FAILED à la première requête.
 *
 * Node 22.18+ / 24 exécutent le TypeScript directement (effacement de types).
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

const cas = [
  { nom: "point couvert", requete: "lat=46.16295&lon=-1.15359", attendu: 200,
    type: "text/calendar" },
  { nom: "sans coordonnées", requete: "", attendu: 400 },
  { nom: "hors territoire", requete: "lat=48.8566&lon=2.3522", attendu: 404 },
];

const { GET } = await import(join(RACINE, "api", "calendrier.ts"));

let echecs = 0;
for (const { nom, requete, attendu, type } of cas) {
  const reponse = await GET(new Request(`https://exemple.test/calendrier.ics?${requete}`));
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
  new Request("https://exemple.test/calendrier.ics?lat=46.16295&lon=-1.15359"),
)).text();
if (corps.startsWith("BEGIN:VCALENDAR") && corps.includes("BEGIN:VEVENT")) {
  console.log(`  ✓ flux iCalendar servi (${corps.split("BEGIN:VEVENT").length - 1} événements)`);
} else {
  echecs++;
  console.error("  ✗ le corps n'est pas un calendrier");
}

if (echecs > 0) {
  console.error(`\n✗ ${echecs} échec(s) sous Node`);
  process.exit(1);
}
console.log("\nLa fonction se charge et répond sous Node.");
