/**
 * Le moteur est validé contre les dates réellement publiées par l'Agglo.
 *
 * Le portail diffuse deux jeux indépendants : les règles de secteur, et une
 * fenêtre glissante d'environ 30 jours de dates effectives. Reconstruire la
 * seconde à partir de la première est le meilleur test disponible — et il se
 * rejoue à chaque rafraîchissement hebdomadaire des données.
 */

import { describe, expect, it } from "vitest";

import donnees from "../public/secteurs.json";
import reference from "../data/reference-dates.json";
import { collectesPourRegles } from "../lib/moteur";
import { parisVersInstant, semaineISO } from "../lib/temps";
import type { Paquet, RegleCompacte } from "../lib/types";

const paquet = donnees as unknown as Paquet;
const datesPubliees = reference as { s: number; t: string; j: string }[];

const cle = (secteur: number, type: string) => `${secteur}|${type}`;

const attendu = new Map<string, Set<string>>();
for (const ligne of datesPubliees) {
  const k = cle(ligne.s, ligne.t);
  if (!attendu.has(k)) attendu.set(k, new Set());
  attendu.get(k)!.add(ligne.j);
}

const parSecteur = new Map<string, RegleCompacte[]>();
for (const regle of paquet.regles) {
  const k = cle(regle.s, regle.t);
  if (!parSecteur.has(k)) parSecteur.set(k, []);
  parSecteur.get(k)!.push(regle);
}

const toutes = datesPubliees.map((d) => d.j).sort();
const debut = toutes[0];
const fin = toutes[toutes.length - 1];

describe("moteur de règles contre les dates publiées", () => {
  it("dispose d'une fenêtre de référence exploitable", () => {
    expect(attendu.size).toBeGreaterThan(40);
    expect(datesPubliees.length).toBeGreaterThan(200);
  });

  it("reproduit exactement chaque couple (secteur, type)", () => {
    const ecarts: string[] = [];

    for (const [k, publiees] of [...attendu].sort()) {
      const regles = parSecteur.get(k);
      if (!regles) {
        ecarts.push(`${k} : aucune règle de secteur correspondante`);
        continue;
      }
      const calcule = new Set(
        collectesPourRegles(regles, debut, fin).map((c) => c.jour));

      const manquantes = [...publiees].filter((j) => !calcule.has(j)).sort();
      const enTrop = [...calcule].filter((j) => !publiees.has(j)).sort();
      if (manquantes.length || enTrop.length) {
        ecarts.push(`${k} : manquantes=${manquantes} en_trop=${enTrop}`);
      }
    }

    expect(ecarts).toEqual([]);
  });

  it("n'omet aucune des dates publiées", () => {
    const reproduites = [...attendu].reduce((total, [k, publiees]) => {
      const regles = parSecteur.get(k) ?? [];
      const calcule = new Set(
        collectesPourRegles(regles, debut, fin).map((c) => c.jour));
      return total + [...publiees].filter((j) => calcule.has(j)).length;
    }, 0);

    expect(reproduites).toBe(datesPubliees.length);
  });
});

describe("plages horaires", () => {
  const regles = [...parSecteur.values()].flat();

  it("produit toujours une fin postérieure au début", () => {
    for (const collecte of collectesPourRegles(regles, debut, fin)) {
      expect(collecte.fin.getTime()).toBeGreaterThan(collecte.debut.getTime());
      expect(collecte.fin.getTime() - collecte.debut.getTime())
        .toBeLessThanOrEqual(14 * 3600_000);
    }
  });

  it("fait franchir minuit aux tournées de nuit", () => {
    const nuit = collectesPourRegles(regles, debut, fin).filter((c) => c.deNuit);
    expect(nuit.length).toBeGreaterThan(0);
    for (const collecte of nuit) {
      expect(collecte.fin.toISOString().slice(0, 10))
        .not.toBe(collecte.debut.toISOString().slice(0, 10));
    }
  });
});

describe("conversion horaire", () => {
  it("place 19:00 Paris à 17:00 UTC en heure d'été", () => {
    expect(parisVersInstant("2026-07-15", "19:00").toISOString())
      .toBe("2026-07-15T17:00:00.000Z");
  });

  it("place 19:00 Paris à 18:00 UTC en heure d'hiver", () => {
    expect(parisVersInstant("2026-12-15", "19:00").toISOString())
      .toBe("2026-12-15T18:00:00.000Z");
  });

  it("calcule les semaines ISO", () => {
    expect(semaineISO("2026-01-01")).toBe(1);
    expect(semaineISO("2026-09-22")).toBe(39);
    expect(semaineISO("2026-10-13")).toBe(42);
  });
});
