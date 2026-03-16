/**
 * solar.js — Cálculo astronómico de eventos solares (algoritmo NOAA)
 * Precisión: ±1 minuto para latitudes entre -72° y +72°
 * Sin dependencias externas.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ─── Helpers trigonométricos en grados ──────────────────────────────────────
const sind  = x => Math.sin(x * DEG);
const cosd  = x => Math.cos(x * DEG);
const tand  = x => Math.tan(x * DEG);
const asind = x => Math.asin(x)  * RAD;
const acosd = x => Math.acos(x)  * RAD;

// ─── Número de día juliano ───────────────────────────────────────────────────
function toJulianDay(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    return d.getTime() / 86400000 + 2440587.5;
}

// ─── Núcleo NOAA ─────────────────────────────────────────────────────────────
function solarParams(JD) {
    const T   = (JD - 2451545) / 36525;

    // Longitud media geométrica del sol (grados)
    const L0  = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;

    // Anomalía media del sol (grados)
    const M   = (357.52911 + T * (35999.05029 - T * 0.0001537)) % 360;

    // Ecuación del centro
    const C   = (1.914602 - T * (0.004817 + T * 0.000014)) * sind(M)
              + (0.019993 - T * 0.000101) * sind(2 * M)
              + 0.000289 * sind(3 * M);

    // Longitud verdadera del sol
    const theta = L0 + C;

    // Longitud aparente (aberración + nutación)
    const omega = 125.04 - 1934.136 * T;
    const lambda = theta - 0.00569 - 0.00478 * sind(omega);

    // Oblicuidad de la eclíptica corregida
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps  = eps0 + 0.00256 * cosd(omega);

    // Declinación solar
    const dec = asind(sind(eps) * sind(lambda));

    // Ecuación del tiempo (minutos)
    const y   = Math.pow(tand(eps / 2), 2);
    const e   = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
    const eot = 4 * RAD * (
        y * sind(2 * L0)
        - 2 * e * sind(M)
        + 4 * e * y * sind(M) * cosd(2 * L0)
        - 0.5 * y * y * sind(4 * L0)
        - 1.25 * e * e * sind(2 * M)
    );

    return { dec, eot };
}

/**
 * Calcula el ángulo horario para un ángulo cenital dado.
 * Devuelve null si el sol no alcanza ese ángulo (día polar / noche polar).
 */
function hourAngle(lat, dec, zenith) {
    const cosHA = (cosd(zenith) - sind(lat) * sind(dec)) / (cosd(lat) * cosd(dec));
    if (cosHA < -1 || cosHA > 1) return null;
    return acosd(cosHA); // grados
}

/**
 * Calcula los eventos solares para una fecha y ubicación dadas.
 *
 * @param {Date}   date  — Fecha local (solo se usa año/mes/día)
 * @param {number} lat   — Latitud en grados decimales
 * @param {number} lng   — Longitud en grados decimales
 * @returns {{
 *   sunrise:       Date|null,
 *   sunset:        Date|null,
 *   civilDawn:     Date|null,
 *   civilDusk:     Date|null,
 *   solarNoon:     Date|null
 * }}
 */
export function getSolarEvents(date, lat, lng) {
    const JD = toJulianDay(date);
    const { dec, eot } = solarParams(JD);

    // Mediodía solar en minutos UTC desde medianoche
    const solarNoonMin = 720 - 4 * lng - eot;

    function toUTCDate(minutesFromMidnight) {
        if (minutesFromMidnight === null) return null;
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCMinutes(d.getUTCMinutes() + minutesFromMidnight);
        return d;
    }

    // Ángulo cenital de referencia:
    //   Atardecer/amanecer astronómico:  90.833° (refracción atmosférica + disco solar)
    //   Crepúsculo civil:                96°
    const haSet  = hourAngle(lat, dec, 90.833);
    const haCivil = hourAngle(lat, dec, 96);

    return {
        solarNoon:  toUTCDate(solarNoonMin),
        sunrise:    toUTCDate(haSet   !== null ? solarNoonMin - haSet   * 4 : null),
        sunset:     toUTCDate(haSet   !== null ? solarNoonMin + haSet   * 4 : null),
        civilDawn:  toUTCDate(haCivil !== null ? solarNoonMin - haCivil * 4 : null),
        civilDusk:  toUTCDate(haCivil !== null ? solarNoonMin + haCivil * 4 : null),
    };
}

/**
 * Formatea una Date UTC a "HH:MM" en la zona horaria local del navegador.
 */
export function fmtTime(date) {
    if (!date) return '--:--';
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}
