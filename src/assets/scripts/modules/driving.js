/**
 * driving.js — Cálculo de ruta en coche via OpenRouteService (ORS)
 *
 * API gratuita: https://openrouteservice.org/
 * Límite free tier: 2 000 peticiones/día, 40/min.
 * Requiere API key (gratuita con registro).
 *
 * La clave se lee de la constante ORS_API_KEY.
 * En producción, inyéctala via variable de entorno o build-time replacement.
 */

const ORS_BASE   = 'https://api.openrouteservice.org/v2/directions/driving-car';
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImRlMDU4NmJkNjA2ZTQ3YjhhYzhjNWVhNGY0ZDYwMDc1IiwiaCI6Im11cm11cjY0In0='; // ← reemplaza con tu clave de ORS

/**
 * Calcula la ruta en coche entre dos puntos.
 *
 * @param {number} fromLat  Latitud de origen (ubicación del usuario)
 * @param {number} fromLng  Longitud de origen
 * @param {number} toLat    Latitud de destino (inicio de la ruta de senderismo)
 * @param {number} toLng    Longitud de destino
 *
 * @returns {Promise<{
 *   distanceKm:  number,   // km de carretera
 *   durationMin: number,   // minutos de conducción
 *   durationFmt: string,   // "1h 23m"
 *   summary:     string,   // "~87 km · 1h 23m en coche"
 * }>}
 */
export async function getDrivingRoute(fromLat, fromLng, toLat, toLng) {
    const body = {
        coordinates: [
            [fromLng, fromLat],  // ORS usa [lng, lat]
            [toLng,   toLat],
        ],
    };

    const res = await fetch(ORS_BASE, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': ORS_API_KEY,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `ORS error ${res.status}`);
    }

    const data     = await res.json();
    const segment  = data.routes?.[0]?.summary;
    if (!segment) throw new Error('Respuesta inesperada de ORS');

    const distanceKm  = Math.round(segment.distance / 100) / 10;  // m → km (1 decimal)
    const durationMin = Math.round(segment.duration / 60);         // s → min

    return {
        distanceKm,
        durationMin,
        durationFmt: formatDrivingTime(durationMin),
        summary:     `~${distanceKm} km · ${formatDrivingTime(durationMin)} en coche`,
    };
}

function formatDrivingTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
