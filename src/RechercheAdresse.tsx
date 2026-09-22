import { useEffect, useId, useRef, useState } from "react";

import { chercherAdresse, type Adresse } from "./geocodage.js";

interface Props {
  onChoix: (adresse: Adresse) => void;
  valeurInitiale?: string;
}

export function RechercheAdresse({ onChoix, valeurInitiale = "" }: Props) {
  const [saisie, setSaisie] = useState(valeurInitiale);
  const [suggestions, setSuggestions] = useState<Adresse[]>([]);
  const [surligne, setSurligne] = useState(-1);
  const [erreur, setErreur] = useState<string | null>(null);
  const choisiRef = useRef(false);
  const identifiant = useId();

  useEffect(() => {
    if (choisiRef.current) {
      choisiRef.current = false;
      return;
    }
    const texte = saisie.trim();
    if (texte.length < 3) {
      setSuggestions([]);
      return;
    }

    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      chercherAdresse(texte, controleur.signal)
        .then((resultats) => {
          setSuggestions(resultats);
          setSurligne(-1);
          setErreur(resultats.length === 0
            ? "Aucune adresse trouvée en Charente-Maritime."
            : null);
        })
        .catch((cause) => {
          if (cause.name !== "AbortError") setErreur("Service d'adresses injoignable.");
        });
    }, 250);

    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [saisie]);

  function choisir(adresse: Adresse) {
    choisiRef.current = true;
    setSaisie(adresse.libelle);
    setSuggestions([]);
    onChoix(adresse);
  }

  function auClavier(evenement: React.KeyboardEvent) {
    if (suggestions.length === 0) return;
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setSurligne((n) => (n + 1) % suggestions.length);
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setSurligne((n) => (n <= 0 ? suggestions.length - 1 : n - 1));
    } else if (evenement.key === "Enter") {
      evenement.preventDefault();
      choisir(suggestions[surligne >= 0 ? surligne : 0]);
    } else if (evenement.key === "Escape") {
      setSuggestions([]);
    }
  }

  return (
    <div className="champ">
      <label className="etiquette" htmlFor={identifiant}>Votre adresse</label>
      <input
        id={identifiant}
        type="search"
        value={saisie}
        placeholder="6 rue des Gentilshommes, La Rochelle"
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${identifiant}-liste`}
        aria-activedescendant={surligne >= 0 ? `${identifiant}-${surligne}` : undefined}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={auClavier}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions" id={`${identifiant}-liste`} role="listbox">
          {suggestions.map((adresse, index) => (
            <li
              key={`${adresse.lat}-${adresse.lon}-${index}`}
              id={`${identifiant}-${index}`}
              role="option"
              aria-selected={index === surligne}
              onMouseDown={(e) => { e.preventDefault(); choisir(adresse); }}
              onMouseEnter={() => setSurligne(index)}
            >
              {adresse.libelle}
            </li>
          ))}
        </ul>
      )}
      {erreur && <p className="erreur" role="status">{erreur}</p>}
    </div>
  );
}
