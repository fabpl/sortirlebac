/**
 * Fabrique le jeu de données embarqué dans l'application.
 *
 * Le portail renvoie 5,8 Mo : 315 règles qui répètent 48 géométries, avec des
 * coordonnées à 9 décimales — soit un dixième de millimètre, absurde pour une
 * limite de tournée de collecte.
 *
 * On déduplique, on simplifie, on quantifie. Et on vérifie : les 23 979
 * adresses de la base adresse locale de l'Agglo sont passées dans la géométrie
 * d'origine puis dans la géométrie compactée. Si une seule change de secteur,
 * le build échoue. Ce n'est pas un contrôle de forme : à 5 décimales, 9
 * adresses réelles basculaient.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(RACINE, ".cache");

const API = "https://opendata.agglo-larochelle.fr/d4c/api/records/1.0/search/";
const JEU_SECTEURS = "dechet_-_secteur_de_collecte";
const JEU_DATES = "dechet_-_prochaines_dates_de_collecte";
const JEU_ADRESSES = "voie_et_adresse___base_adresse_locale_de_la_cda";

// 6 décimales ≈ 11 cm ; tolérance de simplification 1e-6 ° ≈ 11 cm.
// Réglage retenu après mesure : 77 Ko gzip, zéro adresse déplacée.
const DECIMALES = 6;
const TOLERANCE = 1e-6;

const JOURS = { Dimanche: 0, Lundi: 1, Mardi: 2, Mercredi: 3,
                Jeudi: 4, Vendredi: 5, Samedi: 6 };
const PARITE = { "Les deux": 0, Impaire: 1, Paire: 2 };

async function recuperer(jeu, lignes = 2000) {
  mkdirSync(CACHE, { recursive: true });
  const fichier = join(CACHE, `${jeu}.json`);
  const frais = existsSync(fichier) &&
    Date.now() - Number(readFileSync(`${fichier}.horodatage`, "utf8")) < 6 * 3600e3;

  if (!frais) {
    const reponse = await fetch(`${API}?dataset=${jeu}&rows=${lignes}`, {
      headers: { "User-Agent": "sortirlebac/build" },
    });
    if (!reponse.ok) throw new Error(`${jeu} : HTTP ${reponse.status}`);
    writeFileSync(fichier, JSON.stringify(await reponse.json()));
    writeFileSync(`${fichier}.horodatage`, String(Date.now()));
  }
  return JSON.parse(readFileSync(fichier, "utf8")).records.map((r) => r.fields);
}

/** Douglas-Peucker, distance perpendiculaire dans l'espace des degrés. */
function simplifier(points, tolerance) {
  if (tolerance <= 0 || points.length < 3) return points;

  const distance = (p, a, b) => {
    const [px, py] = p, [ax, ay] = a, [bx, by] = b;
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const u = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
  };

  const garder = new Uint8Array(points.length);
  garder[0] = garder[points.length - 1] = 1;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [debut, fin] = pile.pop();
    let pire = 0, index = -1;
    for (let i = debut + 1; i < fin; i++) {
      const d = distance(points[i], points[debut], points[fin]);
      if (d > pire) { pire = d; index = i; }
    }
    if (pire > tolerance && index > 0) {
      garder[index] = 1;
      pile.push([debut, index], [index, fin]);
    }
  }
  return points.filter((_, i) => garder[i]);
}

const arrondir = (points) =>
  points.map(([x, y]) => [+x.toFixed(DECIMALES), +y.toFixed(DECIMALES)]);

/** Supprime les sommets devenus identiques après arrondi, referme l'anneau. */
function degrouper(points) {
  const sortie = [points[0]];
  for (const point of points.slice(1)) {
    const dernier = sortie[sortie.length - 1];
    if (point[0] !== dernier[0] || point[1] !== dernier[1]) sortie.push(point);
  }
  if (sortie.length > 2) {
    const [premier, dernier] = [sortie[0], sortie[sortie.length - 1]];
    if (premier[0] !== dernier[0] || premier[1] !== dernier[1]) sortie.push(premier);
  }
  return sortie;
}

function anneauxDe(geojson) {
  const g = JSON.parse(geojson);
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates.flat();
  throw new Error(`géométrie non gérée : ${g.type}`);
}

function dansAnneau(lon, lat, anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i], [xj, yj] = anneau[j];
    if ((yi > lat) !== (yj > lat) &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Empreinte des emprises contenant un point, tous secteurs confondus. */
function empreinte(lon, lat, emprises) {
  let masque = 0n;
  for (let i = 0; i < emprises.length; i++) {
    if (dansAnneau(lon, lat, emprises[i][0])) masque |= 1n << BigInt(i);
  }
  return masque;
}

/**
 * Horodatage du fichier existant si son contenu est identique au nouveau,
 * `null` s'il a changé (ou s'il n'existe pas encore).
 */
function precedent(chemin, paquet) {
  if (!existsSync(chemin)) return null;
  try {
    const ancien = JSON.parse(readFileSync(chemin, "utf8"));
    const memeSubstance = ["emprises", "regles", "source", "licence"].every(
      (cle) => JSON.stringify(ancien[cle]) === JSON.stringify(paquet[cle]));
    return memeSubstance ? ancien.genere : null;
  } catch {
    return null;  // fichier illisible : on le réécrit
  }
}

async function principal() {
  console.log("Téléchargement du portail…");
  const [lignes, dates, adresses] = await Promise.all([
    recuperer(JEU_SECTEURS),
    recuperer(JEU_DATES),
    recuperer(JEU_ADRESSES, 30000),
  ]);
  console.log(`  ${lignes.length} règles · ${dates.length} dates de référence · ` +
              `${adresses.length} adresses de contrôle`);

  const index = new Map();
  const originales = [];
  for (const ligne of lignes) {
    if (!index.has(ligne.geojson)) {
      index.set(ligne.geojson, originales.length);
      originales.push(anneauxDe(ligne.geojson));
    }
  }
  const avant = originales.flat(2).length;

  const emprises = originales.map((anneaux) =>
    anneaux.map((anneau) => degrouper(arrondir(simplifier(anneau, TOLERANCE)))));
  const apres = emprises.flat(2).length;
  console.log(`  ${originales.length} emprises · ${avant} → ${apres} sommets ` +
              `(-${Math.round((1 - apres / avant) * 100)} %)`);

  const points = adresses
    .map((a) => [parseFloat(a.long), parseFloat(a.lat)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  let deplacees = 0;
  for (const [lon, lat] of points) {
    if (empreinte(lon, lat, originales) !== empreinte(lon, lat, emprises)) deplacees++;
  }
  console.log(`  contrôle : ${points.length} adresses réelles, ${deplacees} déplacée(s)`);
  if (deplacees > 0) {
    throw new Error(
      `${deplacees} adresse(s) changent de secteur après compactage. ` +
      `Augmenter DECIMALES (${DECIMALES}) ou baisser TOLERANCE (${TOLERANCE}).`);
  }

  const paquet = {
    genere: "",  // renseigné plus bas : date du dernier changement réel
    source: `${API}?dataset=${JEU_SECTEURS}`,
    licence: "Licence Ouverte — Ville et Communauté d'agglomération de La Rochelle",
    emprises,
    regles: lignes.map((ligne) => ({
      e: index.get(ligne.geojson),
      s: Number(ligne.secteur_id),
      n: ligne.secteur_nom,
      t: ligne.collecte_type,
      p: ligne.periode_nom,
      d: ligne.periode_debut,
      f: ligne.periode_fin,
      j: JOURS[ligne.jour],
      q: PARITE[ligne.semaine_parite],
      h: ligne.heure_debut.slice(0, 5),
      i: ligne.heure_fin.slice(0, 5),
    })),
  };

  // Le paquet vit dans public/ : servi tel quel au navigateur, importé par les
  // tests et par la fonction serverless. Un seul fichier, pas de copie à
  // maintenir synchrone.
  mkdirSync(join(RACINE, "public"), { recursive: true });
  mkdirSync(join(RACINE, "data"), { recursive: true });
  const destination = join(RACINE, "public", "secteurs.json");

  // `genere` doit dater le dernier changement réel, pas la dernière exécution.
  // Sinon le fichier diffère à chaque build et le rafraîchissement hebdomadaire
  // commite du bruit toutes les semaines, même quand le portail n'a rien changé.
  paquet.genere = precedent(destination, paquet) ?? new Date().toISOString();

  const json = JSON.stringify(paquet);
  writeFileSync(destination, json);
  writeFileSync(join(RACINE, "data", "reference-dates.json"), JSON.stringify(
    dates.map((d) => ({ s: Number(d.secteur_id), t: d.collecte_type, j: d.jour }))));

  const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;
  console.log(`\n  public/secteurs.json ${ko(json.length)} — ` +
              `${ko(gzipSync(json).length)} gzip · inchangé depuis ${paquet.genere}`);
}

principal().catch((erreur) => {
  console.error(`\n✗ ${erreur.message}`);
  process.exit(1);
});
