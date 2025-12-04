import { calculateRouteStats } from './modules/calc.js';
import { formatTime, updateCoordHint } from './modules/utils.js';
import { parseGPX } from './modules/gpx.js';
import { renderElevationProfile } from './modules/charts.js';
import {
    currentLocation,
    currentWeather,
    geocodeLocation,
    fetchWeatherAndCalculateSafety
} from './modules/safety-planner.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') AOS.init({ once: true, offset: 50 });

    const dateInput = document.getElementById('ccsDate');
    if(dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    initSyncInputs();
    initEventListeners();
    updateCalculation();
});

function initEventListeners() {
    ['ccsTerrain', 'ccsProfile', 'ccsDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', updateCalculation);
    });

    const gpxInput = document.getElementById('ccsGpxInput');
    if (gpxInput) gpxInput.addEventListener('change', handleGPXUpload);

    const geocodeBtn = document.getElementById('ccsGeocodeBtn');
    if (geocodeBtn) {
        geocodeBtn.addEventListener('click', async () => {
            const name = document.getElementById('ccsLocationName').value;
            const success = await geocodeLocation(name);
            if(success) updateCalculation();
        });
    }
}

function initSyncInputs() {
    const pairs = [['ccsDistRange', 'ccsDistance'], ['ccsElevRange', 'ccsElevation'], ['ccsElevNegRange', 'ccsElevationNegative'], ['ccsWeightRange', 'ccsWeight']];
    pairs.forEach(([rangeId, numId]) => {
        const r = document.getElementById(rangeId), n = document.getElementById(numId);
        if (!r || !n) return;
        r.addEventListener('input', () => { n.value = r.value; updateCalculation(); });
        n.addEventListener('input', () => { r.value = n.value; updateCalculation(); });
    });
}

async function updateCalculation() {
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;

    const tempStats = calculateRouteStats(data.D, data.Eplus, data.Eminus, data.W, data.Terrain, data.Profile, {});
    const safetyLogistics = await fetchWeatherAndCalculateSafety(tempStats.tTotal);
    const finalStats = calculateRouteStats(data.D, data.Eplus, data.Eminus, data.W, data.Terrain, data.Profile, currentWeather);
    renderResults(data, finalStats, safetyLogistics);
}

function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('ccsGpxText').innerText = "Analizando...";

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const gpx = parseGPX(evt.target.result);
            currentLocation.lat = gpx.lat0; currentLocation.lon = gpx.lon0; currentLocation.source = 'gpx';
            updateCoordHint(true, `GPX: ${gpx.lat0.toFixed(3)}, ${gpx.lon0.toFixed(3)}`);
            updateInputPair('ccsDistRange', 'ccsDistance', gpx.distance);
            updateInputPair('ccsElevRange', 'ccsElevation', gpx.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative', gpx.elevationLoss);
            document.getElementById('ccsGpxText').innerText = `GPX: ${gpx.distance}km`;
            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', gpx.trackData);
            updateCalculation();
        } catch (err) {
            alert("Error GPX: " + err.message);
        }
    };
    reader.readAsText(file);
}

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

function updateInputPair(rId, nId, val) {
    const r = document.getElementById(rId), n = document.getElementById(nId);
    if (val > parseFloat(r.max)) r.max = Math.ceil(val * 1.2);
    r.value = val; n.value = val;
}

function renderResults(inputs, stats, safety) {
    const header = document.getElementById('resHeader');
    header.innerText = `Dificultad: ${stats.diffLabel}`;
    header.className = `ccs-results__header ${stats.diffClass}`;

    document.getElementById('resTotalTimeVal').innerText = formatTime(stats.tTotal);
    document.getElementById('resCaloriesVal').innerText = stats.calTotal;
    document.getElementById('resSendifScore').innerText = stats.sendifScore;
    document.getElementById('resHydrationVal').innerText = `${stats.nutrition.hydrationLiters} L`;
    document.getElementById('resNutritionVal').innerText = `${stats.nutrition.carbsGrams} g`;

    let alerts = [];
    let aClass = 'warning';
    if (safety.safetyAlert) { alerts.push(safety.safetyAlert); if(safety.safetyAlert.includes('MUY ALTO')) aClass='danger'; }
    if (inputs.Eplus >= 600) alerts.push(`⛰️ Desnivel alto: ${inputs.Eplus}m+ (revisar tiempo).`);
    if (stats.nutrition.hydrationAlert) { alerts.push(stats.nutrition.hydrationAlert); if(stats.nutrition.hydrationAlert.includes('Calor Extremo')) aClass='danger'; }

    document.getElementById('resNarrativeText').innerHTML = `Ruta de <strong>${inputs.D}km</strong>. Tiempo mov: <strong>${formatTime(stats.tEffective)}</strong>. Total: <strong>${formatTime(stats.tTotal)}</strong>.`;

    const alertEl = document.getElementById('resAlert');
    if (alerts.length > 0) {
        alertEl.innerHTML = alerts.join('<br><br>');
        alertEl.className = `ccs-results__alert-text ${aClass}`;
        alertEl.style.display = 'block';
    } else { alertEl.style.display = 'none'; }

    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}
