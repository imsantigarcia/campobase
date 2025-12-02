import { calculateRouteStats } from './modules/calc.js';
import { formatTime } from './modules/utils.js';
import { parseGPX } from './modules/gpx.js';
import { renderElevationProfile } from './modules/charts.js';

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar inputs y eventos
    initSyncInputs();
    initEventListeners();
    
    // Calcular inicial
    updateCalculation();
    
    // Nota: AOS se inicializa en index.html o aquí si lo importas vía NPM
    // if (window.AOS) window.AOS.init(); 
});

// --- LÓGICA DE EVENTOS ---
function initEventListeners() {
    // Inputs que disparan recálculo
    const triggers = ['ccsTerrain', 'ccsProfile'];
    triggers.forEach(id => {
        document.getElementById(id).addEventListener('change', updateCalculation);
    });

    // Subida GPX
    const gpxInput = document.getElementById('ccsGpxInput');
    if (gpxInput) {
        gpxInput.addEventListener('change', handleGPXUpload);
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

// --- ORQUESTADOR PRINCIPAL ---
function updateCalculation() {
    // 1. Obtener valores DOM
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;

    // 2. Ejecutar Lógica Pura
    const results = calculateRouteStats(data.D, data.Eplus, data.Eminus, data.W, data.Terrain, data.Profile);

    // 3. Actualizar UI
    renderResults(data, results);
}

function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ccsGpxText').innerText = "Analizando ruta...";
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const gpxData = parseGPX(evt.target.result);
            
            // Actualizar inputs con datos del GPX
            updateInputPair('ccsDistRange', 'ccsDistance', gpxData.distance);
            updateInputPair('ccsElevRange', 'ccsElevation', gpxData.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative', gpxData.elevationLoss);

            // Feedback Visual
            document.getElementById('ccsGpxText').innerText = `Cargado: ${gpxData.distance}km | +${gpxData.elevationGain}m`;
            
            // Renderizar Gráfica
            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', gpxData.trackData);

            // Recalcular todo
            updateCalculation();

        } catch (err) {
            alert("Error al leer GPX: " + err.message);
            document.getElementById('ccsGpxText').innerText = "Error en archivo";
        }
    };
    reader.readAsText(file);
}

// --- HELPERS UI ---
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
    
    // Ajustar max del range si el valor es mayor
    if (val > parseFloat(range.max)) range.max = Math.ceil(val * 1.2);
    
    range.value = val;
    num.value = val;
}

function renderResults(inputs, stats) {
    // Header Color
    const header = document.getElementById('resHeader');
    header.innerText = `Dificultad física: ${stats.diffLabel}`;
    header.className = `ccs-results__header ${stats.diffClass}`;

    // Stats Numéricos
    document.getElementById('resTotalTimeVal').innerText = formatTime(stats.tTotal);
    document.getElementById('resCaloriesVal').innerText = stats.calTotal;
    document.getElementById('resSendifScore').innerText = stats.sendifScore;

    // Narrativa
    const narrativeHTML = `
        Esta ruta de <strong>${inputs.D} km</strong> y <strong>${inputs.Eplus} m</strong> de desnivel positivo es de dificultad física <strong>${stats.diffLabel.toLowerCase()}</strong>. 
        Te llevará aproximadamente <strong>${formatTime(stats.tEffective)}</strong> en movimiento, 
        o <strong>${formatTime(stats.tTotal)}</strong> contando paradas. 
        Gasto calórico: <strong>${stats.calTotal} kcal</strong> (${inputs.W} kg, perfil ${stats.profileLabel}).
    `;
    document.getElementById('resNarrativeText').innerHTML = narrativeHTML;
    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}
