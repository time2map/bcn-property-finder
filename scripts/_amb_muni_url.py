#!/usr/bin/env python3
"""Prints the opendatasoft export URL for AMB metro municipalities.
Used by prepare-areas-data.sh (curl can't build the encoded ODSQL where clause inline)."""
import urllib.parse

# AMB metro municipalities (Barcelona city excluded — covered by districtes/barris).
AMB = [
    "Badalona", "Badia del Vallès", "Barberà del Vallès", "Begues", "Castellbisbal",
    "Castelldefels", "Cerdanyola del Vallès", "Cervelló", "Corbera de Llobregat",
    "Cornellà de Llobregat", "El Papiol", "El Prat de Llobregat", "Esplugues de Llobregat",
    "Gavà", "L'Hospitalet de Llobregat", "La Palma de Cervelló", "Molins de Rei",
    "Montcada i Reixac", "Montgat", "Pallejà", "Ripollet", "Sant Adrià de Besòs",
    "Sant Andreu de la Barca", "Sant Boi de Llobregat", "Sant Climent de Llobregat",
    "Sant Cugat del Vallès", "Sant Feliu de Llobregat", "Sant Joan Despí",
    "Sant Just Desvern", "Sant Vicenç dels Horts", "Santa Coloma de Cervelló",
    "Santa Coloma de Gramenet", "Tiana", "Torrelles de Llobregat", "Viladecans",
]

where = "mun_name in (%s)" % ",".join('"%s"' % n for n in AMB)
qs = urllib.parse.urlencode({"where": where, "select": "mun_name"})
print("https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
      "georef-spain-municipio/exports/geojson?" + qs)
