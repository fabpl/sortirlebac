import type { Emprises } from "./types.ts";

/**
 * Lancer de rayon horizontal (règle pair-impair).
 *
 * Les emprises sont mono-anneau dans les données de l'Agglo, mais on traite
 * quand même les anneaux suivants comme des trous : si le producteur en ajoute
 * un jour, le calcul restera juste au lieu de devenir faux en silence.
 */
function dansAnneau(lon: number, lat: number, anneau: [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dedans = !dedans;
    }
  }
  return dedans;
}

export function dansEmprise(
  lon: number, lat: number, anneaux: [number, number][][],
): boolean {
  if (!dansAnneau(lon, lat, anneaux[0])) return false;
  return !anneaux.slice(1).some((trou) => dansAnneau(lon, lat, trou));
}

/** Index des emprises contenant le point. */
export function emprisesContenant(
  lat: number, lon: number, emprises: Emprises,
): Set<number> {
  const trouvees = new Set<number>();
  emprises.forEach((anneaux, index) => {
    if (dansEmprise(lon, lat, anneaux)) trouvees.add(index);
  });
  return trouvees;
}
