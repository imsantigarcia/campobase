/**
 * Módulo de Utilidades
 * Responsabilidad: Funciones de uso común (matemáticas, formatos, feedback visual).
 */

export function formatTime(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    if (m === 60) return `${h + 1}h 00m`;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

export function updateCoordHint(success, message) {
    const hintElement = document.getElementById('ccsCoordHint');
    if (!hintElement) return;
    hintElement.innerHTML = success ? `✅ ${message}` : `❌ ${message}`;
    hintElement.style.color = success ? '#27ae60' : '#c0392b';
}
