/**
 * geocoding.js — Búsqueda de municipios via Nominatim (OpenStreetMap)
 * Sin API key. Límite de uso: 1 req/s (suficiente para autocompletado con debounce).
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS   = { 'Accept-Language': 'es', 'Accept': 'application/json' };

/**
 * Busca municipios en España por texto libre.
 * @param {string} query
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function searchMunicipality(query) {
    if (!query || query.trim().length < 2) return [];

    const params = new URLSearchParams({
        q:            query.trim(),
        countrycodes: 'es',
        limit:        '6',
        format:       'json',
        addressdetails: '1',
    });

    const res  = await fetch(`${NOMINATIM}/search?${params}`, { headers: HEADERS });
    if (!res.ok) throw new Error('Error al consultar Nominatim');
    const data = await res.json();

    return data.map(r => {
        // Construir etiqueta legible: municipio + provincia
        const a     = r.address || {};
        const city  = a.city || a.town || a.village || a.municipality || r.display_name.split(',')[0];
        const prov  = a.province || a.state || '';
        const label = prov ? `${city}, ${prov}` : city;

        return { label, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    });
}

/**
 * Obtiene el nombre del municipio más cercano a unas coordenadas (reverse geocoding).
 * Útil para rellenar el campo de texto cuando se usa geolocalización.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lng) {
    const params = new URLSearchParams({
        lat, lon: lng, format: 'json', addressdetails: '1',
    });

    const res  = await fetch(`${NOMINATIM}/reverse?${params}`, { headers: HEADERS });
    if (!res.ok) return '';
    const data = await res.json();

    const a    = data.address || {};
    const city = a.city || a.town || a.village || a.municipality || '';
    const prov = a.province || a.state || '';
    return prov ? `${city}, ${prov}` : city;
}
