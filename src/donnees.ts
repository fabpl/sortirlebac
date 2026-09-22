import type { Paquet } from "../lib/types.js";

let enCours: Promise<Paquet> | null = null;

/**
 * Charge le paquet de secteurs (80 Ko gzip) une seule fois par session.
 *
 * Il n'est pas importé statiquement : la page s'affiche immédiatement, et les
 * données arrivent pendant que l'utilisateur tape son adresse.
 */
export function chargerPaquet(): Promise<Paquet> {
  if (!enCours) {
    enCours = fetch("/secteurs.json").then((reponse) => {
      if (!reponse.ok) throw new Error(`secteurs.json : HTTP ${reponse.status}`);
      return reponse.json() as Promise<Paquet>;
    });
  }
  return enCours;
}
