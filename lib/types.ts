/** Formes échangées entre le build, le front et la fonction serverless. */

/** Une règle telle que compactée par scripts/build-data.mjs. */
export interface RegleCompacte {
  /** index dans `emprises` */ e: number;
  /** secteur_id */ s: number;
  /** secteur_nom */ n: string;
  /** collecte_type */ t: string;
  /** periode_nom */ p: string;
  /** periode_debut (AAAA-MM-JJ) */ d: string;
  /** periode_fin (AAAA-MM-JJ) */ f: string;
  /** jour de la semaine, 0 = dimanche */ j: number;
  /** parité : 0 les deux, 1 impaire, 2 paire */ q: 0 | 1 | 2;
  /** heure de début HH:MM */ h: string;
  /** heure de fin HH:MM */ i: string;
}

/** [emprise][anneau][sommet] = [lon, lat] */
export type Emprises = [number, number][][][];

export interface Paquet {
  genere: string;
  source: string;
  licence: string;
  emprises: Emprises;
  regles: RegleCompacte[];
}

export interface Collecte {
  /** AAAA-MM-JJ, jour de présentation du bac */
  jour: string;
  debut: Date;
  fin: Date;
  type: string;
  secteurId: number;
  secteurNom: string;
  periode: string;
  /** la tournée se termine le lendemain */
  deNuit: boolean;
  /** nom du jour férié, si la collecte tombe dessus */
  ferie: string | null;
}
