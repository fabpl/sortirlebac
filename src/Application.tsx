import { useEffect, useState } from "react";

import { collectes as calculer, couvertureLocale } from "../lib/moteur.js";
import { ajouterJours, aujourdhuiAParis } from "../lib/temps.js";
import type { Collecte, Paquet } from "../lib/types.js";
import { chargerPaquet } from "./donnees.js";
import { RechercheAdresse } from "./RechercheAdresse.js";
import { Resultat } from "./Resultat.js";
import type { Adresse } from "./geocodage.js";

const HORIZON_JOURS = 400;
const MEMOIRE = "sortirlebac.adresse";

interface Etat {
  adresse: Adresse;
  collectes: Collecte[];
  couverture: { debut: string; fin: string } | null;
}

function lireMemoire(): Adresse | null {
  try {
    const brut = localStorage.getItem(MEMOIRE);
    return brut ? (JSON.parse(brut) as Adresse) : null;
  } catch {
    return null; // navigation privée, stockage bloqué : sans conséquence
  }
}

export function Application() {
  const [paquet, setPaquet] = useState<Paquet | null>(null);
  const [panne, setPanne] = useState(false);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [memorisee] = useState(lireMemoire);

  useEffect(() => {
    chargerPaquet().then(setPaquet).catch(() => setPanne(true));
  }, []);

  function resoudre(adresse: Adresse, donnees: Paquet) {
    const debut = aujourdhuiAParis();
    setEtat({
      adresse,
      collectes: calculer(donnees, adresse.lat, adresse.lon, debut,
                          ajouterJours(debut, HORIZON_JOURS)),
      couverture: couvertureLocale(donnees, adresse.lat, adresse.lon),
    });
    try {
      localStorage.setItem(MEMOIRE, JSON.stringify(adresse));
    } catch {
      // sans conséquence : l'adresse ne sera simplement pas reproposée
    }
  }

  // Une adresse mémorisée est recalculée dès que les données sont là.
  useEffect(() => {
    if (paquet && memorisee && !etat) resoudre(memorisee, paquet);
  }, [paquet, memorisee, etat]);

  return (
    <main className="page">
      <header>
        <h1>Quand sortir le bac&nbsp;?</h1>
        <p className="sous">
          Calendrier de collecte des 28 communes de l'Agglomération de
          La Rochelle, reconstruit depuis les données ouvertes du territoire.
        </p>
      </header>

      <RechercheAdresse
        valeurInitiale={memorisee?.libelle ?? ""}
        onChoix={(adresse) => {
          if (paquet) resoudre(adresse, paquet);
        }}
      />

      {panne && (
        <section className="bloc">
          <p className="erreur">
            Les données de secteurs n'ont pas pu être chargées. Réessayez plus
            tard — ou consultez le calendrier officiel de l'Agglo.
          </p>
        </section>
      )}

      {!paquet && !panne && <p className="attente">Chargement des secteurs…</p>}

      {etat && (
        <Resultat
          adresse={etat.adresse}
          collectes={etat.collectes}
          couverture={etat.couverture}
        />
      )}

      <footer>
        <p>
          Données&nbsp;: <a href="https://opendata.agglo-larochelle.fr/">Ville et
          Communauté d'agglomération de La Rochelle</a>, Licence Ouverte.
          Géocodage&nbsp;: <a href="https://adresse.data.gouv.fr/">Base Adresse
          Nationale</a>.
        </p>
        <p>
          Les dates sont <strong>calculées</strong> à partir des règles
          publiées, pas officielles. En cas de doute, la communication de
          l'Agglo fait foi. <a href="https://github.com/fabpl/sortirlebac">Code
          source</a>.
        </p>
      </footer>
    </main>
  );
}
