/**
 * Fonction serverless Vercel : flux iCalendar à mettre en abonnement.
 *
 * Le front sait déjà tout calculer — mais un agenda qui s'abonne a besoin
 * d'une URL stable qui renvoie du `text/calendar`, ce qu'un fichier statique
 * ne peut pas faire par adresse. D'où cette unique fonction.
 *
 * Les données de secteurs sont importées à la construction : aucun appel au
 * portail à l'exécution, donc une réponse rapide et pas de dépendance à la
 * disponibilité du portail au moment où un agenda se rafraîchit.
 */

// L'attribut `with { type: "json" }` n'est pas décoratif : le paquet est en
// `"type": "module"`, donc Node exécute cette fonction en ESM et refuse un
// import JSON sans lui (ERR_IMPORT_ATTRIBUTE_MISSING). Vitest transforme les
// imports et ne voit pas la différence — d'où scripts/smoke-api.mjs, qui
// charge la fonction sous le vrai Node.
import paquetBrut from "../public/secteurs.json" with { type: "json" };
import { genererIcs, RAPPEL_PAR_DEFAUT } from "../lib/ics.ts";
import { collectes } from "../lib/moteur.ts";
import { ajouterJours, aujourdhuiAParis } from "../lib/temps.ts";
import type { Paquet } from "../lib/types.ts";

const paquet = paquetBrut as unknown as Paquet;

const HORIZON_MAX = 400;
// Un agenda se resynchronise typiquement toutes les quelques heures. Une heure
// de cache CDN suffit largement et évite de réveiller la fonction pour rien.
const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

/**
 * `Number(null)` vaut 0, pas NaN. Un paramètre absent doit donc être écarté
 * AVANT toute conversion, sinon il prend silencieusement la valeur 0 : un
 * `jours` manquant donnait un horizon d'un jour, et un `rappel` manquant
 * supprimait les alarmes — sur l'URL d'abonnement que l'application génère,
 * justement, sans ces deux paramètres.
 */
function nombre(valeur: string | null, defaut: number, mini: number, maxi: number) {
  if (valeur === null || valeur.trim() === "") return defaut;
  const lu = Number(valeur);
  if (!Number.isFinite(lu)) return defaut;
  return Math.min(maxi, Math.max(mini, Math.trunc(lu)));
}

/** Même piège, appliqué aux coordonnées : sans ce garde-fou, une requête sans
 * `lat`/`lon` viserait le point (0, 0) au large du golfe de Guinée et
 * répondrait « aucun secteur » au lieu de « paramètre manquant ». */
function coordonnee(valeur: string | null, amplitude: number): number | null {
  if (valeur === null || valeur.trim() === "") return null;
  const lu = Number(valeur);
  if (!Number.isFinite(lu) || Math.abs(lu) > amplitude) return null;
  return lu;
}

export function GET(requete: Request): Response {
  const parametres = new URL(requete.url).searchParams;
  const lat = coordonnee(parametres.get("lat"), 90);
  const lon = coordonnee(parametres.get("lon"), 180);

  if (lat === null || lon === null) {
    return Response.json(
      { erreur: "paramètres `lat` et `lon` requis, en degrés décimaux" },
      { status: 400 });
  }

  const debut = aujourdhuiAParis();
  const jours = nombre(parametres.get("jours"), HORIZON_MAX, 1, HORIZON_MAX);
  const liste = collectes(paquet, lat, lon, debut, ajouterJours(debut, jours));

  if (liste.length === 0) {
    return Response.json(
      { erreur: "aucun secteur de collecte ne couvre ce point" }, { status: 404 });
  }

  const flux = genererIcs(liste, {
    nom: parametres.get("nom") ?? "Collecte des déchets",
    rappelHeures: nombre(parametres.get("rappel"), RAPPEL_PAR_DEFAUT, 0, 72),
  });

  return new Response(flux, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="collecte.ics"',
      "Cache-Control": CACHE,
    },
  });
}
