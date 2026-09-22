# Communauté d'agglomération de La Rochelle

Support for schedules provided by [La Rochelle Open Data](https://opendata.agglo-larochelle.fr/),
covering the 28 municipalities of the agglomeration.

## Configuration via `configuration.yaml`

```yaml
waste_collection_schedule:
  sources:
    - name: larochelle_fr
      args:
        address: ADDRESS
```

### Configuration Variables

**address**  
*(String) (optional)* Postal address, geocoded through the French
[Base Adresse Nationale](https://adresse.data.gouv.fr/).

**latitude** / **longitude**  
*(Float) (optional)* Use instead of `address` when you already know the
coordinates. Either `address` or both coordinates must be given.

## Example

```yaml
waste_collection_schedule:
  sources:
    - name: larochelle_fr
      args:
        address: "place de Verdun, La Rochelle"
```

## How it works

The source reads the `dechet_-_secteur_de_collecte` dataset, finds the
collection sectors whose polygon contains the address, then expands each
sector's rules (weekday × ISO-week parity × seasonal period) over the next
200 days. No API key is required.

Two waste streams are reported: *Ordures ménagères* (general waste) and
*Emballages recyclables* (recycling).
