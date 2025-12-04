// ui-manager.js
/**
 * Módulo de Interfaz de Usuario y Control Central.
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Sincronización de inputs, orquestación de calc, y renderizado final.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar animaciones AOS
    AOS.init({
        once: true,
        offset: 50
    });
    
    // 1. Inicializar Sincronización de Inputs
    sync('ccsDistRange', 'ccsDistance');
    sync('ccsElevRange', 'ccsElevation');
    sync('ccsElevNegRange', 'ccsElevationNegative');
    sync('ccsWeightRange', 'ccsWeight');

    document.getElementById('ccsTerrain').addEventListener('change', calc);
    document.getElementById('ccsProfile').addEventListener('change', calc);
    
    // 2. Eventos para Logística Temporal
    document.getElementById('ccsDate').addEventListener('change', calc);
    
    const geocodeBtn = document.getElementById('ccsGeocodeBtn');
    geocodeBtn.addEventListener('click', () => {
        const locationName = document.getElementById('ccsLocationName').value;
        window.geocodeLocation(locationName); // Llama a la función del safety-planner.js
    });
    
    // 3. Ejecutar cálculo inicial
    calc(); 
});


/**
 * Sincroniza un input de tipo range con un input de tipo number.
 */
function sync(rangeId, numId) {
    const r = document.getElementById(rangeId);
    const n = document.getElementById(numId);
    
    r.addEventListener('input', () => { 
        n.value = r.value; 
        calc(); 
    });
    
    n.addEventListener('input', () => { 
        r.value = n.value; 
        calc(); 
    });
}

/**
 * Función central de cálculo (ASÍNCRONA).
 */
window.calc = async function() {
    // 1. Obtención de datos
    const D = parseFloat(document.getElementById('ccsDistance').value) || 0;
    const Eplus = parseFloat(document.getElementById('ccsElevation').value) || 0;
    const Eminus = parseFloat(document.getElementById('ccsElevationNegative').value) || 0;
    const W = parseFloat(document.getElementById('ccsWeight').value) || 0;
    const terrainSpeed = parseFloat(document.getElementById('ccsTerrain').value);
    const profileKey = document.getElementById('ccsProfile').value;
    const prof = window.profiles[profileKey];

    if(D === 0 || W === 0) {
        document.getElementById('ccsResultCard').classList.remove('ccs-results--visible');
        return;
    }

    // 2. Tiempos (MIDE) y Calorías
    const tTotal = window.calculateTimeMIDE(D, Eplus, Eminus, terrainSpeed, prof);
    const tEffective = tTotal / 1.25;
    const calTotal = window.calculateCalories(D, Eplus, W, terrainSpeed, tEffective);

    // 3. Dificultad (SENDIF)
    const diffData = window.calculateSendif(D, Eplus);

    // 4. Logística Temporal y Clima (ASÍNCRONO - Esperar datos de seguridad)
    const safetyLogistics = await window.fetchWeatherAndCalculateSafety(tTotal); 

    // 5. Nutrición e Hidratación
    const nutritionData = window.calculateHydrationNeeds(
        calTotal, 
        tTotal, 
        window.currentWeather // Datos de clima del safety-planner
    );
    
    // 6. Renderizar Nutrición
    document.getElementById('resHydrationVal').innerText = `${nutritionData.hydrationLiters} L`;
    document.getElementById('resNutritionVal').innerText = `${nutritionData.carbsGrams} g`;


    // 7. Combinación y Priorización de Alertas de Seguridad
    let narrativeAlert = safetyLogistics.safetyAlert;
    let alertClass = '';
    
    // A. Clase de Alerta por Lógica Temporal (Prioridad más alta)
    if (safetyLogistics.safetyAlert.includes('Alerta de Seguridad Logística')) {
        alertClass = 'danger';
    } else if (safetyLogistics.safetyAlert.includes('Advertencia de Riesgo Logístico')) {
        alertClass = 'warning';
    }

    // B. Alerta de Desnivel Alto (Subestimación de Tiempo)
    if (Eplus >= 600) {
        const dpAlert = `⛰️ **Advertencia DP Alto:** Desnivel positivo de ${Eplus}m. Los modelos de tiempo suelen **subestimar** rutas tan empinadas. Añade un 10-15% extra al tiempo estimado por seguridad.`;
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + dpAlert : dpAlert;
        alertClass = alertClass || 'warning'; 
    }
    
    // C. Alerta de Hidratación/Calor
    if (nutritionData.hydrationAlert) {
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + nutritionData.hydrationAlert : nutritionData.hydrationAlert;
        if (nutritionData.hydrationAlert.includes('ALERTA de Calor Extremo')) {
            alertClass = 'danger';
        } else if (alertClass !== 'danger') {
            alertClass = 'warning';
        }
    }
    
    // D. Alerta de Fallo de Clima
    if(window.currentWeather.error) {
        const climateErr = `⚠️ **Advertencia de Clima:** No se pudo obtener el pronóstico del tiempo (${window.currentWeather.error}). Planifica con extrema precaución.`;
        narrativeAlert = narrativeAlert ? narrativeAlert + '<br><br>' + climateErr : climateErr;
        alertClass = alertClass || 'warning';
    }


    // 8. Renderizado Final
    
    const header = document.getElementById('resHeader');
    header.innerText = `Dificultad física: ${diffData.label}`;
    header.className = `ccs-results__header ${diffData.class}`;

    document.getElementById('resTotalTimeVal').innerText = fmtTime(tTotal);
    document.getElementById('resCaloriesVal').innerText = calTotal;
    document.getElementById('resSendifScore').innerText = diffData.score;

    const effectiveTimeText = fmtTime(tEffective);
    const totalTimeText = fmtTime(tTotal);
    
    const narrativeHTML = `
        Esta ruta de <strong>${D} km</strong> y <strong>${Eplus} m</strong> de desnivel positivo es de dificultad física <strong>${diffData.label.toLowerCase()}</strong>. Te llevará aproximadamente <strong>${effectiveTimeText}</strong> completarla en movimiento, tiempo que se estima en <strong>${totalTimeText}</strong> si sumamos el 25% de margen para paradas. El gasto calórico previsto es de <strong>${calTotal} kcal</strong>, basado en el peso total (${W} kg) y un perfil <strong>${prof.label}</strong>.
    `;

    document.getElementById('resNarrativeText').innerHTML = narrativeHTML;
    
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


// --- HELPERS ---

function fmtTime(h) {
    const hours = Math.floor(h);
    const mins = Math.round((h % 1) * 60);
    if(mins === 60) return `${hours+1}h 00m`;
    return `${hours}h ${mins<10?'0':''}${mins}m`;
}

window.updateUIFromGPX = function(distKm, gainM, lossM) {
    const d = parseFloat(distKm.toFixed(1));
    const eg = Math.round(gainM);
    const el = Math.round(lossM);

    updateInputRange('ccsDistRange', 'ccsDistance', d);
    updateInputRange('ccsElevRange', 'ccsElevation', eg);
    updateInputRange('ccsElevNegRange', 'ccsElevationNegative', el);

    document.getElementById('ccsGpxText').innerText = `Cargado: ${d}km | +${eg}m`;
    
    calc();
}

function updateInputRange(rangeId, numId, value) {
    const range = document.getElementById(rangeId);
    const num = document.getElementById(numId);
    
    const maxVal = parseFloat(range.max);
    if (value > maxVal) {
        range.max = Math.ceil(value * 1.2); 
    }
    
    range.value = value;
    num.value = value;
}

window.updateCoordHint = function(success, message) {
    const hintElement = document.getElementById('ccsCoordHint');
    hintElement.innerHTML = success ? `✅ ${message}` : `❌ ${message}`;
    hintElement.style.color = success ? '#27ae60' : 'var(--color-danger)';
}