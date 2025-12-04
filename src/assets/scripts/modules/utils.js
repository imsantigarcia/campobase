// utils.js
/**
 * Módulo de Utilidades
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Funciones de uso común (matemáticas, formatos).
 */

// Formatear horas decimales (ej: 2.5 -> "2h 30m")
export function formatTime(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    if (m === 60) return `${h + 1}h 00m`;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

// Fórmula de Haversine para distancia entre coordenadas (Usada en GPX)
export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la tierra en km
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

// Para la pista visual de coordenadas en el HTML (usada por safety-planner)
window.updateCoordHint = function(success, message) {
    const hintElement = document.getElementById('ccsCoordHint');
    hintElement.innerHTML = success ? `✅ ${message}` : `❌ ${message}`;
    hintElement.style.color = success ? '#27ae60' : 'var(--color-danger)';
}