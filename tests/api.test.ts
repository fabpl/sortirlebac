/**
 * La fonction serverless est testée comme une fonction pure Request → Response.
 *
 * Elle vit dans `api/calendrier.ts` et Vercel l'expose sur `/api/calendrier` ;
 * `vercel.json` la réécrit sur `/calendrier.ics`, l'URL que voient les agendas.
 *
 * Ces tests ne suffisent pas : Vitest transforme les imports, donc ils restent
 * verts même quand la fonction refuse de se charger sous Node. C'est le rôle
 * de `npm run smoke`.
 */

import { describe, expect, it } from "vitest";

import { GET } from "../api/calendrier.ts";

const appeler = (requete: string) =>
  GET(new Request(`https://sortirlebac.vercel.app/calendrier.ics?${requete}`));

const corpsDe = async (requete: string) => (await appeler(requete)).text();

const COUVERT = "lat=46.16295&lon=-1.15359";
const evenements = (texte: string) => texte.split("BEGIN:VEVENT").length - 1;

describe("GET /calendrier.ics", () => {
  it("sert un calendrier pour un point couvert", async () => {
    const reponse = await appeler(COUVERT);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toContain("text/calendar");

    const corps = await reponse.text();
    expect(corps.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(corps.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(corps).toContain("BEGIN:VEVENT");
  });

  it("refuse une requête sans coordonnées", async () => {
    expect((await appeler("")).status).toBe(400);
    expect((await appeler("lat=46.1")).status).toBe(400);
    expect((await appeler("lat=abc&lon=def")).status).toBe(400);
  });

  it("répond 404 hors du territoire de l'Agglo", async () => {
    expect((await appeler("lat=48.8566&lon=2.3522")).status).toBe(404); // Paris
  });

  it("applique l'horizon complet quand `jours` est absent", async () => {
    // L'URL d'abonnement produite par l'application ne passe ni `jours` ni
    // `rappel` : ces deux défauts sont le cas nominal, pas un cas limite.
    const defaut = evenements(await corpsDe(COUVERT));
    const explicite = evenements(await corpsDe(`${COUVERT}&jours=400`));

    expect(defaut).toBe(explicite);
    expect(defaut).toBeGreaterThan(50);
  });

  it("pose un rappel par défaut quand `rappel` est absent", async () => {
    expect(await corpsDe(COUVERT)).toContain("BEGIN:VALARM");
  });

  it("borne l'horizon demandé", async () => {
    const court = evenements(await corpsDe(`${COUVERT}&jours=7`));
    const long = evenements(await corpsDe(`${COUVERT}&jours=9999`));

    expect(court).toBeGreaterThan(0);
    expect(court).toBeLessThan(long);
  });

  it("honore le paramètre de rappel", async () => {
    expect(await corpsDe(`${COUVERT}&rappel=3`)).toContain("TRIGGER:-PT3H");
    expect(await corpsDe(`${COUVERT}&rappel=0`)).not.toContain("BEGIN:VALARM");
  });

  it("reprend le nom de calendrier fourni", async () => {
    expect(await corpsDe(`${COUVERT}&nom=Chez+moi`)).toContain("X-WR-CALNAME:Chez moi");
  });
});
