"""
Geocoding utility using Nominatim (OpenStreetMap) — free, no API key required.
Converts address strings to latitude/longitude coordinates.
"""

import httpx
from typing import Optional, Tuple


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_COORDS = (32.2211, 35.2544)  # Nablus fallback


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Convert an address string to (latitude, longitude).
    Returns None if geocoding fails.
    Uses progressive rightmost dropping of broad terms to find exact street-level landmarks.
    """
    if not address or not address.strip():
        return None

    def query_nominatim(q: str) -> Optional[Tuple[float, float]]:
        try:
            response = httpx.get(
                NOMINATIM_URL,
                params={
                    "q": q,
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
        except Exception as e:
            print(f"Nominatim query failed for '{q}': {e}")
        return None

    # Split address by comma
    parts = [p.strip() for p in address.split(",") if p.strip()]

    # 1. Try progressive right-dropping (first full address, then remove rightmost broad country/state parts)
    # This keeps the exact specific landmark/street on the left intact!
    for i in range(len(parts), 0, -1):
        query_str = ", ".join(parts[:i])
        print(f"Smart Geocoder: Progressive search trying: '{query_str}'")
        coords = query_nominatim(query_str)
        if coords:
            return coords

    # 2. Try smart prefix/landmark stripping if progressive dropping failed
    if parts:
        first_part = parts[0]
        words = first_part.split()
        if len(words) > 1:
            # Common Arabic/English building/landmark prefixes
            prefixes = {
                'مدرسة', 'شارع', 'قرب', 'بجانب', 'عمارة', 'مسجد', 'مكتبة', 
                'سوبرمارکت', 'سوبرماركت', 'حارة', 'حي', 'منطقة', 'دوار', 
                'مستشفى', 'near', 'beside', 'opposite', 'building', 'street', 'school'
            }
            if words[0].lower() in prefixes or len(words[0]) <= 3:
                # Try geocoding with only the rest of the words in the first part + subsequent parts
                rest_first = ' '.join(words[1:])
                simplified = ', '.join([rest_first] + parts[1:])
                simplified_parts = [p.strip() for p in simplified.split(",") if p.strip()]
                for i in range(len(simplified_parts), 0, -1):
                    query_str = ", ".join(simplified_parts[:i])
                    print(f"Smart Geocoder: Stripped prefix progressive search trying: '{query_str}'")
                    coords = query_nominatim(query_str)
                    if coords:
                        return coords

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
