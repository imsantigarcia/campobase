/**
 * safety.js — Lógica de seguridad horaria para la ruta
 *
 * Regla principal:
 *   Hora máxima de salida = crepúsculo civil − tTotal
 *   (El crepúsculo civil es más conservador que el simple atardecer)
 *
 * Además se calcula una advertencia progresiva según lo ajustada
 * que quede la ventana entre "ahora/mínima razonable" y la hora máxima.
 */

import { getSolarEvents, fmtTime } from './solar.js';

/**
 * @param {Date}    date        — Fecha elegida por el usuario
 * @param {number}  lat         — Latitud
 * @param {number}  lng         — Longitud
 * @param {number}  tTotalHours — Tiempo total de la ruta en horas (con paradas)
 *
 * @returns {{
 *   sunset:       Date,
 *   civilDusk:    Date,
 *   sunrise:      Date,
 *   latestStart:  Date,          // hora máxima de salida (basada en crepúsculo civil)
 *   latestStartSoft: Date,       // versión "suave" (basada en atardecer, sin margen extra)
 *   windowMinutes: number,       // minutos entre ahora/amanecer y latestStart
 *   level:        'ok'|'warn'|'danger'|'impossible',
 *   levelLabel:   string,
 *   fmtSunset:    string,
 *   fmtDusk:      string,
 *   fmtLatest:    string,
 *   fmtSunrise:   string,
 * }}
 */
export function getSafetyInfo(date, lat, lng, tTotalHours) {
    const events = getSolarEvents(date, lat, lng);
    const { sunrise, sunset, civilDusk } = events;

    // Hora máxima de salida = crepúsculo civil − duración total
    const durationMs   = tTotalHours * 3600 * 1000;
    const latestStart  = civilDusk  ? new Date(civilDusk.getTime()  - durationMs) : null;
    const latestStartSoft = sunset  ? new Date(sunset.getTime()     - durationMs) : null;

    // Referencia "más temprano posible": amanecer o medianoche
    const earliest = sunrise ? sunrise.getTime() : date.setHours(0, 0, 0, 0);
    const windowMinutes = latestStart
        ? Math.round((latestStart.getTime() - earliest) / 60000)
        : null;

    // Semáforo
    let level, levelLabel;
    if (!latestStart || windowMinutes === null) {
        level      = 'impossible';
        levelLabel = 'Ruta inviable en este día';
    } else if (windowMinutes < 0) {
        level      = 'impossible';
        levelLabel = 'No hay tiempo suficiente antes del anochecer';
    } else if (windowMinutes < 60) {
        level      = 'danger';
        levelLabel = 'Margen muy reducido — riesgo alto';
    } else if (windowMinutes < 180) {
        level      = 'warn';
        levelLabel = 'Margen ajustado — planifica bien la salida';
    } else {
        level      = 'ok';
        levelLabel = 'Margen suficiente';
    }

    return {
        sunrise,
        sunset,
        civilDusk,
        latestStart,
        latestStartSoft,
        windowMinutes,
        level,
        levelLabel,
        fmtSunrise:  fmtTime(sunrise),
        fmtSunset:   fmtTime(sunset),
        fmtDusk:     fmtTime(civilDusk),
        fmtLatest:   latestStart ? fmtTime(latestStart) : '--:--',
    };
}
