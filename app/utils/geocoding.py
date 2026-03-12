"""
Geocoding utility using Nominatim (OpenStreetMap) — free, no API key required.
Converts address strings to latitude/longitude coordinates.
"""

import httpx
from typing import Optional, Tuple


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_COORDS = (31.95, 35.93)  # Amman, Jordan fallback


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Convert an address string to (latitude, longitude).
    Returns None if geocoding fails.
    """
    if not address or not address.strip():
        return None

    try:
        response = httpx.get(
            NOMINATIM_URL,
            params={
                "q": address,
                "format": "json",
                "limit": 1,
            },
            headers={
                "User-Agent": "FastAPI-Ecommerce/1.0",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        results = response.json()

        if results and len(results) > 0:
            lat = float(results[0]["lat"])
            lon = float(results[0]["lon"])
            return (lat, lon)

        return None
    except Exception as e:
        print(f"Geocoding failed for '{address}': {e}")
        return None


def geocode_address_with_fallback(
    address: str,
    fallback: Tuple[float, float] = DEFAULT_COORDS,
) -> Tuple[float, float]:
    """
    Geocode an address and fall back to default coordinates on failure.
    """
    result = geocode_address(address)
    return result if result else fallback
