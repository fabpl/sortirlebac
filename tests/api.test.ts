/** La fonction serverless est testée comme une fonction pure Request → Response. */

import { describe, expect, it } from "vitest";

import { GET } from "../api/calendrier.ics";

const appeler = (requete: string) =>
  GET(new Request(`https://sortirlebac.vercel.app/api/calendrier.ics?${requete}`));

describe("GET /api/calendrier.ics", () => {
  it("sert un calendrier pour un point couvert", async () => {
    const reponse = appeler("lat=46.16295&lon=-1.15359");
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toContain("text/calendar");

    const corps = await reponse.text();
    expect(corps.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(corps.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(corps).toContain("BEGIN:VEVENT");
  });

  it("refuse une requête sans coordonnées", async () => {
    expect(appeler("").status).toBe(400);
    expect(appeler("lat=46.1").status).toBe(400);
    expect(appeler("lat=abc&lon=def").status).toBe(400);
  });

  it("répond 404 hors du territoire de l'Agglo", () => {
    expect(appeler("lat=48.8566&lon=2.3522").status).toBe(404); // Paris
  });

  it("borne l'horizon demandé", async () => {
    const court = await appeler("lat=46.16295&lon=-1.15359&jours=7").text();
    const long = await appeler("lat=46.16295&lon=-1.15359&jours=9999").text();
    const evenements = (texte: string) => texte.split("BEGIN:VEVENT").length - 1;
    expect(evenements(court)).toBeLessThan(evenements(long));
    expect(evenements(court)).toBeGreaterThan(0);
  });

  it("honore le paramètre de rappel", async () => {
    expect(await appeler("lat=46.16295&lon=-1.15359&rappel=3").text())
      .toContain("TRIGGER:-PT3H");
    expect(await appeler("lat=46.16295&lon=-1.15359&rappel=0").text())
      .not.toContain("BEGIN:VALARM");
  });

  it("reprend le nom de calendrier fourni", async () => {
    expect(await appeler("lat=46.16295&lon=-1.15359&nom=Chez+moi").text())
      .toContain("X-WR-CALNAME:Chez moi");
  });
});
