"""Sitios semilla para contenido de demo (SPEC §4.5).

Coordenadas APROXIMADAS: afinar contra el DEM antes de la demo.
Lat en grados (negativa = sur), lon en grados este [0, 360).
"""

SEED_SITES = [
    {
        "name": "Shackleton (borde)",
        "lat": -89.9,
        "lon": 0.0,
        "note": "Borde iluminado, interior en PSR",
    },
    {
        "name": "Connecting Ridge",
        "lat": -89.4,
        "lon": 222.0,
        "note": "Pico de luz casi eterna cerca de Shackleton",
    },
    {
        "name": "de Gerlache (borde)",
        "lat": -88.5,
        "lon": 292.0,
        "note": "Candidato Artemis",
    },
    {
        "name": "Nobile Rim",
        "lat": -85.2,
        "lon": 32.0,
        "note": "Región candidata Artemis III",
    },
    {
        "name": "Malapert Massif",
        "lat": -86.0,
        "lon": 0.0,
        "note": "Alta visibilidad de Tierra",
    },
    {
        "name": "Haworth",
        "lat": -87.5,
        "lon": 5.0,
        "note": "Cráter con PSR",
    },
]


def find_seed_site(lat: float, lon: float, tol: float = 0.05):
    """Devuelve el sitio semilla que matchea lat/lon (o None)."""
    for s in SEED_SITES:
        if abs(s["lat"] - lat) <= tol and abs(s["lon"] - lon) <= tol:
            return s
    return None
