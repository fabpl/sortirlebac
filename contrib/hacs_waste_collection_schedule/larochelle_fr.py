"""Source Home Assistant pour l'Agglomération de La Rochelle.

Destiné à mampfes/hacs_waste_collection_schedule, dont les sources sont des
fichiers autonomes n'utilisant que `requests`. Le moteur de règles du paquet
`dechets` est donc réimplémenté ici en version courte ; les deux restent
alignés grâce à tests/test_rules.py, qui valide la logique contre les dates
publiées par le portail.
"""

import datetime
import json

import requests
from waste_collection_schedule import Collection, Icons

TITLE = "Communauté d'agglomération de La Rochelle"
DESCRIPTION = "Source pour opendata.agglo-larochelle.fr (28 communes)"
URL = "https://opendata.agglo-larochelle.fr/"
COUNTRY = "fr"
TEST_CASES = {
    "La Rochelle centre": {"address": "place de Verdun, La Rochelle"},
    "Châtelaillon-Plage": {"address": "avenue de la Falaise, Châtelaillon-Plage"},
    "Coordonnées directes": {"latitude": 46.159313, "longitude": -1.151209},
}

API = ("https://opendata.agglo-larochelle.fr/d4c/api/records/1.0/search/"
       "?dataset=dechet_-_secteur_de_collecte&rows=2000")
BAN = "https://api-adresse.data.gouv.fr/search/"

ICON_MAP = {
    "Ordures ménagères": Icons.GENERAL_WASTE,
    "Emballages recyclables": Icons.RECYCLING,
}

JOURS = {"Lundi": 0, "Mardi": 1, "Mercredi": 2, "Jeudi": 3,
         "Vendredi": 4, "Samedi": 5, "Dimanche": 6}

HORIZON_JOURS = 200


class SourceArgumentError(ValueError):
    """Repris de waste_collection_schedule.exceptions lors de l'intégration."""


def _dans_polygone(lon, lat, anneau):
    dedans = False
    n = len(anneau)
    j = n - 1
    for i in range(n):
        xi, yi = anneau[i]
        xj, yj = anneau[j]
        if (yi > lat) != (yj > lat):
            if lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                dedans = not dedans
        j = i
    return dedans


def _geocoder(adresse):
    reponse = requests.get(BAN, params={"q": adresse, "limit": 1}, timeout=30)
    reponse.raise_for_status()
    traits = reponse.json().get("features", [])
    if not traits:
        raise SourceArgumentError(f"adresse introuvable : {adresse!r}")
    lon, lat = traits[0]["geometry"]["coordinates"]
    return lat, lon


class Source:
    def __init__(self, address=None, latitude=None, longitude=None):
        if address is None and (latitude is None or longitude is None):
            raise SourceArgumentError(
                "fournir `address`, ou `latitude` et `longitude`")
        self._address = address
        self._latitude = latitude
        self._longitude = longitude

    def _position(self):
        if self._latitude is not None and self._longitude is not None:
            return float(self._latitude), float(self._longitude)
        return _geocoder(self._address)

    def fetch(self):
        lat, lon = self._position()

        reponse = requests.get(API, timeout=60)
        reponse.raise_for_status()
        lignes = [enreg["fields"] for enreg in reponse.json()["records"]]

        regles = []
        cache = {}
        for ligne in lignes:
            brut = ligne["geojson"]
            if brut not in cache:
                geometrie = json.loads(brut)
                anneaux = geometrie["coordinates"] \
                    if geometrie["type"] == "Polygon" \
                    else [a for p in geometrie["coordinates"] for a in p]
                cache[brut] = _dans_polygone(lon, lat, anneaux[0])
            if cache[brut]:
                regles.append(ligne)

        if not regles:
            raise SourceArgumentError(
                "aucun secteur de collecte ne couvre ce point "
                f"({lat}, {lon}) — hors des 28 communes de l'Agglo ?")

        aujourdhui = datetime.date.today()
        entrees = []
        vues = set()
        for decalage in range(HORIZON_JOURS):
            jour = aujourdhui + datetime.timedelta(days=decalage)
            paire = jour.isocalendar()[1] % 2 == 0
            for regle in regles:
                if JOURS[regle["jour"]] != jour.weekday():
                    continue
                if not (regle["periode_debut"] <= jour.isoformat()
                        <= regle["periode_fin"]):
                    continue
                parite = regle["semaine_parite"]
                if parite == "Paire" and not paire:
                    continue
                if parite == "Impaire" and paire:
                    continue

                type_dechet = regle["collecte_type"]
                if (jour, type_dechet) in vues:
                    continue
                vues.add((jour, type_dechet))
                entrees.append(Collection(
                    date=jour, t=type_dechet,
                    icon=ICON_MAP.get(type_dechet)))

        return entrees
