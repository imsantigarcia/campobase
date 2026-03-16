import { calculateRouteStats } from './modules/calc.js';
import { formatTime } from './modules/utils.js';
import { parseGPX } from './modules/gpx.js';
import { renderElevationProfile } from './modules/charts.js';

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initSyncInputs();
    initEventListeners();
    updateCalculation();
});

// --- LÓGICA DE EVENTOS ---
function initEventListeners() {
    // Selects que disparan recálculo
    const triggers = ['ccsTerrain', 'ccsFlatSpeed', 'ccsVerticalProfile', 'ccsSex'];
    triggers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateCalculation);
    });

    // Input de edad (opcional)
    const ageInput = document.getElementById('ccsAge');
    if (ageInput) ageInput.addEventListener('input', updateCalculation);

    // Subida GPX
    const gpxInput = document.getElementById('ccsGpxInput');
    if (gpxInput) gpxInput.addEventListener('change', handleGPXUpload);
}

function initSyncInputs() {
    const pairs = [
        ['ccsDistRange',    'ccsDistance'],
        ['ccsElevRange',    'ccsElevation'],
        ['ccsElevNegRange', 'ccsElevationNegative'],
        ['ccsWeightRange',  'ccsWeight']
    ];

    pairs.forEach(([rangeId, numId]) => {
        const r = document.getElementById(rangeId);
        const n = document.getElementById(numId);
        if (!r || !n) return;

        r.addEventListener('input', () => { n.value = r.value; updateCalculation(); });
        n.addEventListener('input', () => { r.value = n.value; updateCalculation(); });
    });
}

// --- ORQUESTADOR PRINCIPAL ---
function updateCalculation() {
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;

    const results = calculateRouteStats(
        data.D, data.Eplus, data.Eminus, data.W,
        data.Terrain, data.FlatSpeed, data.VerticalProfile,
        data.Sex, data.Age
    );

    renderResults(data, results);
}

// --- HELPERS UI ---
function getDOMValues() {
    return {
        D:               parseFloat(document.getElementById('ccsDistance').value)            || 0,
        Eplus:           parseFloat(document.getElementById('ccsElevation').value)           || 0,
        Eminus:          parseFloat(document.getElementById('ccsElevationNegative').value)   || 0,
        W:               parseFloat(document.getElementById('ccsWeight').value)              || 0,
        Terrain:         parseFloat(document.getElementById('ccsTerrain').value),
        FlatSpeed:       document.getElementById('ccsFlatSpeed').value,
        VerticalProfile: document.getElementById('ccsVerticalProfile').value,
        Sex:             document.getElementById('ccsSex')?.value   || null,
        Age:             parseFloat(document.getElementById('ccsAge')?.value) || 0
    };
}

function updateInputPair(rangeId, numId, val) {
    const range = document.getElementById(rangeId);
    const num   = document.getElementById(numId);
    if (val > parseFloat(range.max)) range.max = Math.ceil(val * 1.2);
    range.value = val;
    num.value   = val;
}

function renderResults(inputs, stats) {
    // Header de dificultad
    const header = document.getElementById('resHeader');
    header.innerText  = `Dificultad física: ${stats.diffLabel}`;
    header.className  = `ccs-results__header ${stats.diffClass}`;

    // Tiempo
    document.getElementById('resTotalTimeVal').innerText = formatTime(stats.tTotal);

    // Calorías: rango en lugar de número único
    document.getElementById('resCaloriesVal').innerText =
        `${stats.calMin}–${stats.calMax}`;

    // SENDIF
    document.getElementById('resSendifScore').innerText = stats.sendifScore;

    // Narrativa
    const sexNote = inputs.Sex
        ? ` · ${inputs.Sex === 'female' ? 'mujer' : 'hombre'}${inputs.Age > 0 ? `, ${inputs.Age} años` : ''}`
        : '';

    const narrativeHTML = `
        Esta ruta de <strong>${inputs.D} km</strong> y <strong>${inputs.Eplus} m</strong> de desnivel
        positivo es de dificultad física <strong>${stats.diffLabel.toLowerCase()}</strong>.
        Te llevará aproximadamente <strong>${formatTime(stats.tEffective)}</strong> en movimiento,
        o <strong>${formatTime(stats.tTotal)}</strong> contando paradas.
        Gasto calórico estimado: <strong>${stats.calMin}–${stats.calMax} kcal</strong>
        (${inputs.W} kg · velocidad ${stats.flatLabel} · vertical ${stats.verticalLabel}${sexNote}).
    `;
    document.getElementById('resNarrativeText').innerHTML = narrativeHTML;
    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}

// --- GPX ---
function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ccsGpxText').innerText = "Analizando ruta...";

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const gpxData = parseGPX(evt.target.result);

            updateInputPair('ccsDistRange',    'ccsDistance',           gpxData.distance);
            updateInputPair('ccsElevRange',    'ccsElevation',          gpxData.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative',  gpxData.elevationLoss);

            document.getElementById('ccsGpxText').innerText =
                `Cargado: ${gpxData.distance} km | +${gpxData.elevationGain} m | -${gpxData.elevationLoss} m`;

            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', gpxData.trackData);

            updateCalculation();
        } catch (err) {
            // Mostrar error inline, sin alert()
            document.getElementById('ccsGpxText').innerText = `⚠ Error: ${err.message}`;
        }
    };
    reader.readAsText(file);
}
