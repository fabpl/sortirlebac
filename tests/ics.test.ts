import { describe, expect, it } from "vitest";

import donnees from "../public/secteurs.json";
import { genererIcs } from "../lib/ics";
import { collectes } from "../lib/moteur";
import type { Paquet } from "../lib/types";

const paquet = donnees as unknown as Paquet;

// Place de Verdun : hypercentre, tournées de nuit sept jours sur sept.
const VERDUN = { lat: 46.16295, lon: -1.15359 };

const liste = collectes(paquet, VERDUN.lat, VERDUN.lon, "2026-09-22", "2026-12-31");
const flux = genererIcs(liste, { nom: "Test", genereLe: new Date("2026-09-22T12:00:00Z") });
const lignes = flux.split("\r\n");

describe("flux iCalendar", () => {
  it("produit des événements", () => {
    expect(liste.length).toBeGreaterThan(50);
  });

  it("n'utilise que des fins de ligne CRLF", () => {
    expect(flux.split("\n").length).toBe(flux.split("\r\n").length);
  });

  it("replie toutes les lignes à 75 octets", () => {
    const encodeur = new TextEncoder();
    const trop = lignes.filter((l) => encodeur.encode(l).length > 75);
    expect(trop).toEqual([]);
  });

  it("équilibre les blocs", () => {
    const compte = (motif: string) =>
      lignes.filter((l) => l === motif).length;
    expect(compte("BEGIN:VEVENT")).toBe(compte("END:VEVENT"));
    expect(compte("BEGIN:VALARM")).toBe(compte("END:VALARM"));
    expect(compte("BEGIN:VEVENT")).toBe(liste.length);
  });

  it("porte les propriétés obligatoires", () => {
    for (const requis of ["BEGIN:VCALENDAR", "VERSION:2.0", "END:VCALENDAR"]) {
      expect(lignes).toContain(requis);
    }
    expect(flux).toContain("PRODID:");
  });

  it("émet tous les horodatages en UTC", () => {
    const dates = lignes.filter((l) => /^(DTSTART|DTEND|DTSTAMP):/.test(l));
    expect(dates.length).toBeGreaterThan(0);
    for (const ligne of dates) {
      expect(ligne.split(":")[1]).toMatch(/^\d{8}T\d{6}Z$/);
    }
  });

  it("donne un UID unique à chaque événement", () => {
    const uids = lignes.filter((l) => l.startsWith("UID:"));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("garde les UID stables d'une génération à l'autre", () => {
    const second = genererIcs(liste, { nom: "Test", genereLe: new Date() });
    const uids = (texte: string) =>
      texte.split("\r\n").filter((l) => l.startsWith("UID:"));
    expect(uids(second)).toEqual(uids(flux));
  });

  it("signale les jours fériés sans déplacer la date", () => {
    const noel = liste.find((c) => c.jour === "2026-12-25");
    expect(noel?.ferie).toBe("Noël");
    expect(flux).toContain("Noël");
  });
});
