import { useMemo } from "react";

import { genererIcs } from "../lib/ics.ts";
import type { Collecte } from "../lib/types.ts";
import type { Adresse } from "./geocodage.ts";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris",
});
const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

const estOrdures = (type: string) => type.startsWith("Ordures");

interface Props {
  adresse: Adresse;
  collectes: Collecte[];
  couverture: { debut: string; fin: string } | null;
}

export function Resultat({ adresse, collectes, couverture }: Props) {
  const parametres = new URLSearchParams({
    lat: adresse.lat.toFixed(6),
    lon: adresse.lon.toFixed(6),
    nom: `Collecte — ${adresse.libelle}`,
  });
  const urlIcs = `${location.origin}/calendrier.ics?${parametres}`;

  const fichier = useMemo(() => {
    if (collectes.length === 0) return null;
    const flux = genererIcs(collectes, { nom: `Collecte — ${adresse.libelle}` });
    return URL.createObjectURL(new Blob([flux], { type: "text/calendar" }));
  }, [collectes, adresse.libelle]);

  if (collectes.length === 0) {
    return (
      <section className="bloc">
        <p className="vide">
          Aucun secteur de collecte ne couvre cette adresse dans les données
          publiées par l'Agglo.
          {couverture && ` Les règles de ce secteur couvrent ${couverture.debut} → ${couverture.fin}.`}
        </p>
      </section>
    );
  }

  const secteurs = [...new Set(collectes.map((c) => `${c.secteurNom} (n°${c.secteurId})`))];
  const prochaines = collectes.slice(0, 14);

  return (
    <section className="bloc">
      <h2>Secteur{secteurs.length > 1 ? "s" : ""} : {secteurs.join(" · ")}</h2>

      <ol className="collectes">
        {prochaines.map((collecte) => (
          <li key={`${collecte.jour}-${collecte.type}-${collecte.secteurId}`}>
            <span className="quand">{dateLongue.format(collecte.debut)}</span>
            <span className={`quoi ${estOrdures(collecte.type) ? "om" : "tri"}`}>
              {collecte.type}
              {collecte.ferie && (
                <em className="ferie">
                  ⚠ {collecte.ferie} — l'Agglo décale en principe la tournée
                </em>
              )}
            </span>
            <span className="horaire">
              {heure.format(collecte.debut)}–{heure.format(collecte.fin)}
              {collecte.deNuit && " (J+1)"}
            </span>
          </li>
        ))}
      </ol>

      <div className="actions">
        <a className="bouton" href={urlIcs.replace(/^https?:/, "webcal:")}>
          S'abonner au calendrier
        </a>
        {fichier && (
          <a className="bouton creux" href={fichier} download="collecte.ics">
            Télécharger le .ics
          </a>
        )}
      </div>

      <p className="aparte">
        L'abonnement se met à jour tout seul. Le téléchargement fige les dates
        d'aujourd'hui{couverture && ` jusqu'au ${couverture.fin}`}.
      </p>
    </section>
  );
}
