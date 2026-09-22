/**
 * Géocodage via la Base Adresse Nationale (service public, sans clé).
 *
 * Le périmètre est restreint à la Charente-Maritime : sans ce filtre, « rue de
 * la Paix » renvoie volontiers une rue homonyme à l'autre bout du pays, et
 * l'utilisateur obtient un « aucun secteur » incompréhensible.
 */

const BAN = "https://api-adresse.data.gouv.fr/search/";
const DEPARTEMENT = "17";

export interface Adresse {
  libelle: string;
  lat: number;
  lon: number;
  commune: string;
}

export async function chercherAdresse(
  requete: string, signal?: AbortSignal,
): Promise<Adresse[]> {
  const parametres = new URLSearchParams({ q: requete, limit: "8" });
  const reponse = await fetch(`${BAN}?${parametres}`, { signal });
  if (!reponse.ok) throw new Error(`BAN : HTTP ${reponse.status}`);

  const charge = await reponse.json();
  return (charge.features ?? [])
    .filter((trait: any) => String(trait.properties.citycode ?? "").startsWith(DEPARTEMENT))
    .map((trait: any) => ({
      libelle: trait.properties.label as string,
      lat: trait.geometry.coordinates[1] as number,
      lon: trait.geometry.coordinates[0] as number,
      commune: trait.properties.city as string,
    }));
}
