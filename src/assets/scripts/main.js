// main.js
/**
 * Módulo Principal (Orquestador)
 * Responsabilidad: Controlar el flujo, manejar eventos DOM, coordinar módulos y renderizar resultados finales.
 */
import { calculateRouteStats } from './modules/calc.js';
import { formatTime } from './modules/utils.js';
import { parseGPX } from './modules/gpx.js';
import { renderElevationProfile } from './modules/charts.js';
import { 
    currentLocation, 
    currentWeather, 
    geocodeLocation,
    fetchWeatherAndCalculateSafety
} from './modules/safety-planner.js'; 


// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initSyncInputs();
    initEventListeners();
    
    // Llamada inicial (asíncrona)
    updateCalculation();
});

// --- LÓGICA DE EVENTOS ---
function initEventListeners() {
    // Inputs que disparan recálculo
    const triggers = ['ccsTerrain', 'ccsProfile', 'ccsDate']; 
    triggers.forEach(id => {
        document.getElementById(id).addEventListener('change', updateCalculation);
    });

    // Subida GPX
    const gpxInput = document.getElementById('ccsGpxInput');
    if (gpxInput) {
        gpxInput.addEventListener('change', handleGPXUpload);
    }
    
    // Geocodificación (Llama a la función global en safety-planner)
    const geocodeBtn = document.getElementById('ccsGeocodeBtn');
    if (geocodeBtn) {
        geocodeBtn.addEventListener('click', () => {
            const locationName = document.getElementById('ccsLocationName').value;
            geocodeLocation(locationName); 
        });
    }
}

function initSyncInputs() {
    // Pares de slider + input numérico
    const pairs = [
        ['ccsDistRange', 'ccsDistance'],
        ['ccsElevRange', 'ccsElevation'],
        ['ccsElevNegRange', 'ccsElevationNegative'],
        ['ccsWeightRange', 'ccsWeight']
    ];

    pairs.forEach(([rangeId, numId]) => {
        const r = document.getElementById(rangeId);
        const n = document.getElementById(numId);
        if (!r || !n) return;

        r.addEventListener('input', () => { n.value = r.value; updateCalculation(); });
        n.addEventListener('input', () => { r.value = n.value; updateCalculation(); });
    });
}

// --- ORQUESTADOR PRINCIPAL (ASÍNCRONO) ---
async function updateCalculation() {
    // 1. Obtener valores DOM
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;
    
    // 2. Ejecutar Lógica Asíncrona de Seguridad (Clima/Sol)
    // Usamos una versión temporal de las stats para obtener el tTotal
    const tempStats = calculateRouteStats(data.D, data.Eplus, data.Eminus, data.W, data.Terrain, data.Profile, currentWeather);
    const safetyLogistics = await fetchWeatherAndCalculateSafety(tempStats.tTotal);

    // 3. Recalcular las estadísticas PURAS con la data de clima actualizada (esencial para Nutrición)
    const finalStats = calculateRouteStats(data.D, data.Eplus, data.Eminus, data.W, data.Terrain, data.Profile, currentWeather);

    // 4. Actualizar UI
    renderResults(data, finalStats, safetyLogistics);
}

function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ccsGpxText').innerText = "Analizando ruta...";
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const gpxData = parseGPX(evt.target.result);
            
            // 1. Actualizar coordenadas globales (para Sol/Clima)
            currentLocation.lat = gpxData.lat0;
            currentLocation.lon = gpxData.lon0;
            currentLocation.source = 'gpx';
            window.updateCoordHint(true, `${gpxData.lat0.toFixed(3)}° N, ${gpxData.lon0.toFixed(3)}° E (Inicio GPX)`);

            // 2. Actualizar inputs con datos del GPX
            updateInputPair('ccsDistRange', 'ccsDistance', gpxData.distance);
            updateInputPair('ccsElevRange', 'ccsElevation', gpxData.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative', gpxData.elevationLoss);

            // 3. Feedback Visual y Gráfica
            document.getElementById('ccsGpxText').innerText = `Cargado: ${gpxData.distance}km | +${gpxData.elevationGain}m`;
            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', gpxData.trackData);

            // 4. Recalcular todo
            updateCalculation();

        } catch (err) {
            alert("Error al leer GPX: " + err.message);
            document.getElementById('ccsGpxText').innerText = "Error en archivo";
        }
    };
    reader.readAsText(file);
}

// --- HELPERS UI Y RENDERIZADO ---
function getDOMValues() {
    return {
        D: parseFloat(document.getElementById('ccsDistance').value) || 0,
        Eplus: parseFloat(document.getElementById('ccsElevation').value) || 0,
        Eminus: parseFloat(document.getElementById('ccsElevationNegative').value) || 0,
        W: parseFloat(document.getElementById('ccsWeight').value) || 0,
        Terrain: parseFloat(document.getElementById('ccsTerrain').value),
        Profile: document.getElementById('ccsProfile').value
    };
}

function updateInputPair(rangeId, numId, val) {
    const range = document.getElementById(rangeId);
    const num = document.getElementById(numId);
    
    if (val > parseFloat(range.max)) range.max = Math.ceil(val * 1.2);
    
    range.value = val;
    num.value = val;
}

function renderResults(inputs, stats, safety) {
    // 1. Header y Stats Numéricos
    const header = document.getElementById('resHeader');
    header.innerText = `Dificultad física: ${stats.diffLabel}`;
    header.className = `ccs-results__header ${stats.diffClass}`;

    document.getElementById('resTotalTimeVal').innerText = formatTime(stats.tTotal);
    document.getElementById('resCaloriesVal').innerText = stats.calTotal;
    document.getElementById('resSendifScore').innerText = stats.sendifScore;

    // 2. Nutrición
    document.getElementById('resHydrationVal').innerText = `${stats.nutrition.hydrationLiters} L`;
    document.getElementById('resNutritionVal').innerText = `${stats.nutrition.carbsGrams} g`;

    // 3. Lógica de Alertas (Priorización)
    let narrativeAlert = safety.safetyAlert || ''; // Alerta de Sol/Logística
    let alertClass = '';

    // A. Clase de Alerta por Logística (Prioridad más alta)
    if (safety.safetyAlert && safety.safetyAlert.includes('Alerta de Seguridad Logística')) {
        alertClass = 'danger';
    } else if (safety.safetyAlert && safety.safetyAlert.includes('Advertencia de Riesgo Logístico')) {
        alertClass = 'warning';
    }
    
    // B. Alerta de Desnivel Alto
    if (inputs.Eplus >= 600) {
        const dpAlert = `⛰️ **Advertencia DP Alto:** Desnivel positivo de ${inputs.Eplus}m. Los modelos de tiempo suelen **subestimar** rutas tan empinadas. Añade un 10-15% extra al tiempo estimado por seguridad.`;
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + dpAlert : dpAlert;
        alertClass = alertClass || 'warning'; 
    }
    
    // C. Alerta de Hidratación/Calor
    if (stats.nutrition.hydrationAlert) {
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + stats.nutrition.hydrationAlert : stats.nutrition.hydrationAlert;
        if (stats.nutrition.hydrationAlert.includes('ALERTA de Calor Extremo')) {
            alertClass = 'danger';
        } else if (alertClass !== 'danger') {
            alertClass = 'warning';
        }
    }
    
    // D. Alerta de Fallo de Clima
    if(currentWeather.error) {
        const climateErr = `⚠️ **Advertencia de Clima:** No se pudo obtener el pronóstico del tiempo (${currentWeather.error}). Planifica con extrema precaución.`;
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + climateErr : climateErr;
        alertClass = alertClass || 'warning';
    }

    // 4. Narrativa Final
    const narrativeHTML = `
        Esta ruta de <strong>${inputs.D} km</strong> y <strong>${inputs.Eplus} m</strong> de desnivel positivo es de dificultad física <strong>${stats.diffLabel.toLowerCase()}</strong>. 
        Te llevará aproximadamente <strong>${formatTime(stats.tEffective)}</strong> en movimiento, 
        o <strong>${formatTime(stats.tTotal)}</strong> contando paradas. 
        Gasto calórico: <strong>${stats.calTotal} kcal</strong> (${inputs.W} kg, perfil ${stats.profileLabel}).
    `;
    document.getElementById('resNarrativeText').innerHTML = narrativeHTML;
    
    // Renderizar Alerta
    const alertElement = document.getElementById('resAlert');
    if (narrativeAlert) {
        alertElement.innerHTML = narrativeAlert;
        alertElement.className = `ccs-results__alert-text ${alertClass}`;
        alertElement.style.display = 'block';
    } else {
        alertElement.style.display = 'none';
    }

    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}

// Nota: Las funciones helper updateCoordHint, formatTime, etc., se moverán a utils.js 
// o se globalizarán si es necesario para el HTML. Asegúrate de que utils.js contenga 
// las funciones formatTime, getDistanceFromLatLonInKm, y deg2rad.