/**
 * Moteur de règles : (position, plage de dates) → collectes.
 *
 * La règle, déduite du jeu `dechet_-_secteur_de_collecte` puis validée contre
 * les dates réellement publiées par l'Agglo (cf. tests/moteur.test.ts) :
 *
 *   collecte le JOUR indiqué, si la date tombe dans la PÉRIODE de la ligne,
 *   et si la parité du numéro de semaine ISO correspond.
 *
 * La plage horaire peut franchir minuit : « Mardi 19:00-05:00 » veut dire que
 * le camion passe du mardi 19 h au mercredi 5 h, donc que le bac se sort le
 * mardi soir.
 */

import { emprisesContenant } from "./geo";
import { feriesSurPlage } from "./feries";
import { ajouterJours, jourDeSemaine, parisVersInstant, semaineISO } from "./temps";
import type { Collecte, Paquet, RegleCompacte } from "./types";

export function reglesPour(paquet: Paquet, lat: number, lon: number): RegleCompacte[] {
  const emprises = emprisesContenant(lat, lon, paquet.emprises);
  return paquet.regles.filter((regle) => emprises.has(regle.e));
}

function sApplique(regle: RegleCompacte, jour: string): boolean {
  if (jourDeSemaine(jour) !== regle.j) return false;
  if (jour < regle.d || jour > regle.f) return false;
  if (regle.q === 0) return true;
  const paire = semaineISO(jour) % 2 === 0;
  return regle.q === 2 ? paire : !paire;
}

export function collectesPourRegles(
  regles: RegleCompacte[], debut: string, fin: string,
): Collecte[] {
  if (regles.length === 0) return [];
  const jourFerie = feriesSurPlage(debut, fin);
  const sorties: Collecte[] = [];
  const vues = new Set<string>();

  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    for (const regle of regles) {
      if (!sApplique(regle, jour)) continue;

      // Deux lignes peuvent décrire la même tournée via deux périodes qui se
      // recouvrent (cas de Châtelaillon-Plage). Une seule collecte en sortie.
      const identite = `${jour}|${regle.t}|${regle.s}|${regle.h}`;
      if (vues.has(identite)) continue;
      vues.add(identite);

      const departDeLaTournee = parisVersInstant(jour, regle.h);
      let finDeLaTournee = parisVersInstant(jour, regle.i);
      const deNuit = finDeLaTournee <= departDeLaTournee;
      if (deNuit) finDeLaTournee = parisVersInstant(ajouterJours(jour, 1), regle.i);

      sorties.push({
        jour,
        debut: departDeLaTournee,
        fin: finDeLaTournee,
        type: regle.t,
        secteurId: regle.s,
        secteurNom: regle.n,
        periode: regle.p,
        deNuit,
        ferie: jourFerie.get(jour) ?? null,
      });
    }
  }

  sorties.sort((a, b) =>
    a.debut.getTime() - b.debut.getTime() || a.type.localeCompare(b.type));
  return sorties;
}

export function collectes(
  paquet: Paquet, lat: number, lon: number, debut: string, fin: string,
): Collecte[] {
  return collectesPourRegles(reglesPour(paquet, lat, lon), debut, fin);
}

/** Plage de dates couverte par les règles applicables à ce point. */
export function couvertureLocale(
  paquet: Paquet, lat: number, lon: number,
): { debut: string; fin: string } | null {
  const regles = reglesPour(paquet, lat, lon);
  if (regles.length === 0) return null;
  return {
    debut: regles.reduce((min, r) => (r.d < min ? r.d : min), regles[0].d),
    fin: regles.reduce((max, r) => (r.f > max ? r.f : max), regles[0].f),
  };
}
