# Sortir le bac

Calendrier de collecte des déchets des 28 communes de l'Agglomération de
La Rochelle. Vous saisissez votre adresse, vous obtenez vos dates et un
calendrier auquel vous vous abonnez une fois.

**[sortirlebac.vercel.app](https://sortirlebac.vercel.app)**

L'Agglo publie ses règles de collecte en open data depuis 2026, mais ne
propose aux habitants qu'un calendrier PDF distribué en boîte aux lettres.
Ce projet transforme ces règles en un flux d'agenda qui reste juste tout seul.

## Comment ça marche

Deux jeux de données du [portail open data](https://opendata.agglo-larochelle.fr/) :

- **`dechet_-_secteur_de_collecte`** — 315 règles, 46 secteurs, 48 emprises
  distinctes. Chaque ligne associe un polygone, un type de déchet, une période
  de l'année, un jour de semaine, une parité de semaine ISO et une plage
  horaire.
- **`dechet_-_prochaines_dates_de_collecte`** — les dates effectives sur une
  fenêtre glissante d'environ 30 jours. Trop courte pour un abonnement, mais
  c'est la référence qui permet de valider le moteur.

La règle, déduite de la première puis vérifiée sur la seconde :

> collecte le **jour** indiqué, si la date tombe dans la **période** de la
> ligne, et si la parité du numéro de **semaine ISO** correspond.

Le parcours : adresse → [Base Adresse Nationale](https://adresse.data.gouv.fr/)
→ point dans polygone → règles applicables → dates → iCalendar.

Tout se calcule dans le navigateur. La seule fonction serveur est le flux
d'abonnement, parce qu'un agenda a besoin d'une URL qui renvoie du
`text/calendar` — ce qu'un fichier statique ne sait pas faire par adresse.

## Ce que les données cachaient

- **Les tournées de nuit.** « Mardi 19:00–05:00 » veut dire que le camion passe
  du mardi soir au mercredi matin, donc que le bac se sort le mardi soir. Les
  horodatages sortent en UTC, sans `VTIMEZONE` : pas d'ambiguïté au changement
  d'heure.
- **L'hypercentre.** Les secteurs L et M sont collectés sept jours sur sept.
  Une adresse y produit plus de cent événements par trimestre — ce n'est pas un
  bug, c'est la tournée réelle.
- **Châtelaillon-Plage** a ses propres découpages saisonniers (zone verte, zone
  violette) et une adresse peut relever de deux secteurs aux noms différents
  selon le flux.
- **Les jours fériés.** L'Agglo décale en principe les tournées qui suivent un
  jour férié, mais cette règle n'apparaît nulle part dans les données et la
  fenêtre de référence n'en contient aucun. Les événements concernés sont donc
  **signalés, pas déplacés** : déplacer silencieusement une date reviendrait à
  inventer de l'information dans un calendrier auquel les gens se fient.
- **L'horizon.** Les périodes publiées s'arrêtent au 31 décembre 2026 pour la
  plupart des secteurs. Au-delà, rien n'est calculé tant que l'Agglo n'a pas
  diffusé la suite.

## Deux validations qui gardent le projet honnête

**Le compactage ne déplace personne.** Le portail renvoie 5,8 Mo de polygones à
neuf décimales. `npm run donnees` déduplique, simplifie et quantifie — puis
passe les **23 979 adresses de la base adresse locale** de l'Agglo dans la
géométrie d'origine et dans la géométrie compactée. Si une seule change de
secteur, le build échoue. Ce n'est pas théorique : à cinq décimales, neuf
adresses réelles basculaient.

```
48 emprises · 14854 → 13036 sommets (-12 %)
contrôle : 23979 adresses réelles, 0 déplacée(s)
public/secteurs.json 326 Ko — 80 Ko gzip
```

**Le moteur reproduit les dates officielles.** `npm test` reconstruit la
fenêtre publiée par l'Agglo à partir des seules règles de secteur :

```
87 couples (secteur, type) · 341 dates publiées · 341 reproduites · 0 écart
```

Une action hebdomadaire rejoue les deux et n'intègre les nouvelles données que
si elles passent ; sinon elle ouvre une issue.

**Et la fonction se charge vraiment.** Vite et Vitest résolvent les imports
eux-mêmes ; la plateforme, non. Elle transpile chaque `.ts` en `.js` voisin
sans bundler, puis laisse Node résoudre — ce qui impose deux contraintes
invisibles en test : les spécificateurs relatifs s'écrivent en `.js`
(convention TypeScript ESM, `./ics.js` désigne `ics.ts`), et un import JSON
exige `with { type: "json" }` puisque le paquet est en `"type": "module"`.

Le premier déploiement est tombé en `FUNCTION_INVOCATION_FAILED` avec 25
tests au vert. `npm run smoke` reproduit la chaîne réelle — transpilation
sans bundle via esbuild, puis import sous Node — et échoue si l'une ou
l'autre contrainte est violée.

## Développer

```bash
npm install
npm run donnees   # reconstruit public/secteurs.json depuis le portail
npm run dev
npm test
```

| Chemin | |
|---|---|
| `lib/` | moteur partagé — géométrie, règles, iCalendar, fuseau |
| `src/` | interface React |
| `api/calendrier.ts` | fonction serverless, exposée sur `/calendrier.ics` |
| `scripts/build-data.mjs` | téléchargement, compactage, contrôle par adresses |
| `tests/` | validation contre le portail, conformité RFC 5545, API |
| `scripts/smoke-api.mjs` | charge la fonction sous le vrai Node (voir ci-dessous) |
| `contrib/` | source Home Assistant (Python) |

## Déploiement

Import du dépôt sur Vercel, sans rien saisir : `vercel.json` déclare le
framework, le build, le dossier de sortie et la réécriture du flux. Root
directory, build settings et variables d'environnement restent vides — il n'y a
aucune clé d'API à fournir, le portail et la BAN répondent tous les deux en
anonyme.

Le flux d'abonnement est servi sur `/calendrier.ics?lat=…&lon=…`, réécrit vers
la fonction `api/calendrier`. Passer par une réécriture plutôt que par un nom
de fichier à rallonge évite de dépendre de la façon dont la plateforme découpe
les extensions, et donne une URL que les agendas acceptent sans broncher.

## Home Assistant

`contrib/hacs_waste_collection_schedule/` contient une source prête pour
[mampfes/hacs_waste_collection_schedule](https://github.com/mampfes/hacs_waste_collection_schedule),
qui compte 17 sources françaises mais aucune pour La Rochelle. Les sources de
ce dépôt étant des fichiers Python autonomes, le moteur y est réimplémenté en
version courte.

## Sources

Données : Ville et Communauté d'agglomération de La Rochelle,
[Licence Ouverte](https://opendata.agglo-larochelle.fr/) — l'API `records/1.0`
du portail répond sans clé. Géocodage : Base Adresse Nationale.

Code sous licence MIT. Les dates affichées sont **calculées**, pas officielles :
en cas de doute, la communication de l'Agglo fait foi.
