/** Jours fériés français. Date de Pâques par l'algorithme de Butcher. */

function paques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

const cle = (date: Date) => date.toISOString().slice(0, 10);

const decale = (depuis: Date, jours: number) =>
  new Date(depuis.getTime() + jours * 86_400_000);

export function feries(annee: number): Map<string, string> {
  const dimanchePaques = paques(annee);
  const jours: [Date, string][] = [
    [new Date(Date.UTC(annee, 0, 1)), "Jour de l'an"],
    [decale(dimanchePaques, 1), "Lundi de Pâques"],
    [new Date(Date.UTC(annee, 4, 1)), "Fête du Travail"],
    [new Date(Date.UTC(annee, 4, 8)), "Victoire 1945"],
    [decale(dimanchePaques, 39), "Ascension"],
    [decale(dimanchePaques, 50), "Lundi de Pentecôte"],
    [new Date(Date.UTC(annee, 6, 14)), "Fête nationale"],
    [new Date(Date.UTC(annee, 7, 15)), "Assomption"],
    [new Date(Date.UTC(annee, 10, 1)), "Toussaint"],
    [new Date(Date.UTC(annee, 10, 11)), "Armistice 1918"],
    [new Date(Date.UTC(annee, 11, 25)), "Noël"],
  ];
  return new Map(jours.map(([date, nom]) => [cle(date), nom]));
}

export function feriesSurPlage(debut: string, fin: string): Map<string, string> {
  const tous = new Map<string, string>();
  const premier = Number(debut.slice(0, 4));
  const dernier = Number(fin.slice(0, 4));
  for (let annee = premier; annee <= dernier; annee++) {
    for (const [jour, nom] of feries(annee)) tous.set(jour, nom);
  }
  return tous;
}
