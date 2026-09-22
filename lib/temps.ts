/**
 * Conversion heure locale de Paris → instant absolu.
 *
 * Aucune dépendance : on demande son décalage à l'`Intl` du moteur, puis on
 * corrige une fois — la première estimation peut tomber du mauvais côté d'un
 * changement d'heure. Les tournées ont lieu à 05:00, 13:00 ou 19:00, donc
 * jamais dans l'heure ambiguë de fin octobre, mais autant que le calcul soit
 * juste partout.
 */

const FUSEAU = "Europe/Paris";

function decalageMinutes(instant: Date): number {
  const rendu = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSEAU, timeZoneName: "longOffset",
  }).format(instant);
  const trouve = rendu.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!trouve) return 0;
  const signe = trouve[1] === "-" ? -1 : 1;
  return signe * (Number(trouve[2]) * 60 + Number(trouve[3]));
}

/** `parisVersInstant("2026-09-22", "19:00")` → Date absolue. */
export function parisVersInstant(jour: string, heure: string): Date {
  const commeUTC = Date.parse(`${jour}T${heure}:00Z`);
  let instant = new Date(commeUTC - decalageMinutes(new Date(commeUTC)) * 60_000);
  instant = new Date(commeUTC - decalageMinutes(instant) * 60_000);
  return instant;
}

export function ajouterJours(jour: string, nombre: number): string {
  const date = new Date(`${jour}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + nombre);
  return date.toISOString().slice(0, 10);
}

export function aujourdhuiAParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU }).format(new Date());
}

/** Jour de la semaine, 0 = dimanche. */
export function jourDeSemaine(jour: string): number {
  return new Date(`${jour}T12:00:00Z`).getUTCDay();
}

/** Numéro de semaine ISO 8601. */
export function semaineISO(jour: string): number {
  const date = new Date(`${jour}T12:00:00Z`);
  const jeudi = new Date(date);
  jeudi.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const premierJanvier = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 1));
  return Math.ceil(((jeudi.getTime() - premierJanvier.getTime()) / 86_400_000 + 1) / 7);
}
