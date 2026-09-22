/**
 * Flux iCalendar (RFC 5545).
 *
 * Les horodatages sortent en UTC plutôt qu'avec un TZID : pas de bloc
 * VTIMEZONE à maintenir, et aucune ambiguïté au changement d'heure. Les
 * agendas réaffichent l'heure locale du lecteur.
 *
 * Les UID sont déterministes, donc un agenda déjà abonné met à jour les
 * événements existants plutôt que d'en créer des doublons à chaque
 * rafraîchissement.
 */

import type { Collecte } from "./types";

const DOMAINE = "sortirlebac";
const PRODID = "-//sortirlebac//Collecte des déchets La Rochelle//FR";

export const RAPPEL_PAR_DEFAUT = 12;

const horodatage = (instant: Date) =>
  instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const echapper = (texte: string) =>
  texte.replace(/\\/g, "\\\\").replace(/;/g, "\;")
       .replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Repli des lignes à 75 octets, comme l'exige la RFC 5545. */
function plier(ligne: string): string[] {
  const encodeur = new TextEncoder();
  if (encodeur.encode(ligne).length <= 75) return [ligne];

  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  for (const caractere of ligne) {
    const taille = encodeur.encode(caractere).length;
    const limite = morceaux.length === 0 ? 75 : 74;
    if (octets + taille > limite) {
      morceaux.push(courant);
      courant = "";
      octets = 0;
    }
    courant += caractere;
    octets += taille;
  }
  morceaux.push(courant);
  return morceaux.map((m, i) => (i === 0 ? m : ` ${m}`));
}

/** FNV-1a : court, stable, sans dépendance. Pas de besoin cryptographique. */
function empreinte(texte: string): string {
  let hachage = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    hachage ^= texte.charCodeAt(i);
    hachage = Math.imul(hachage, 0x01000193) >>> 0;
  }
  return hachage.toString(16).padStart(8, "0");
}

const uid = (collecte: Collecte) =>
  `${empreinte(`${collecte.jour}|${collecte.type}|${collecte.secteurId}|` +
               `${collecte.debut.toISOString()}`)}@${DOMAINE}`;

const heureParis = (instant: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit",
  }).format(instant);

const resume = (collecte: Collecte) =>
  `${collecte.type.startsWith("Ordures") ? "🗑️" : "♻️"} ${collecte.type}`;

function description(collecte: Collecte): string {
  const debut = heureParis(collecte.debut);
  const lignes = [
    `Secteur : ${collecte.secteurNom} (n°${collecte.secteurId})`,
    `Période : ${collecte.periode}`,
    `Tournée : ${debut} – ${heureParis(collecte.fin)}` +
      (collecte.deNuit ? " le lendemain" : ""),
    `Bac à sortir : avant ${debut}` +
      (collecte.debut.getUTCHours() >= 16 ? " ce soir" : " (la veille au soir)"),
  ];
  if (collecte.ferie) {
    lignes.push(
      `⚠ ${collecte.ferie} : l'Agglo décale en principe les tournées suivant ` +
      `un jour férié. Vérifiez les dates officielles.`);
  }
  lignes.push("Source : opendata.agglo-larochelle.fr — Licence Ouverte");
  return lignes.join("\n");
}

export function genererIcs(
  liste: Collecte[],
  options: { nom: string; rappelHeures?: number; genereLe?: Date } ,
): string {
  const rappel = options.rappelHeures ?? RAPPEL_PAR_DEFAUT;
  const genereLe = options.genereLe ?? new Date();

  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(options.nom)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
  ];

  for (const collecte of liste) {
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${uid(collecte)}`,
      `DTSTAMP:${horodatage(genereLe)}`,
      `DTSTART:${horodatage(collecte.debut)}`,
      `DTEND:${horodatage(collecte.fin)}`,
      `SUMMARY:${echapper(resume(collecte))}`,
      `DESCRIPTION:${echapper(description(collecte))}`,
      `CATEGORIES:${echapper(collecte.type)}`,
      "TRANSP:TRANSPARENT",
    );
    if (rappel > 0) {
      lignes.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:-PT${rappel}H`,
        `DESCRIPTION:${echapper(`Sortir le bac : ${collecte.type}`)}`,
        "END:VALARM",
      );
    }
    lignes.push("END:VEVENT");
  }
  lignes.push("END:VCALENDAR");

  return `${lignes.flatMap(plier).join("\r\n")}\r\n`;
}
