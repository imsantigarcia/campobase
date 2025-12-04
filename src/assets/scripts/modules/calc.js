// calc.js
/**
 * Módulo de Núcleo de Cálculo (MIDE, SENDIF, Calorías, Nutrición)
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Implementar modelos matemáticos.
 */

const profiles = {
    beginner: { ascent: 300, descent: 400, flatFactor: 0.9, label: "pausado (iniciación)" },
    average:  { ascent: 400, descent: 600, flatFactor: 1.0, label: "medio (estándar)" },
    expert:   { ascent: 600, descent: 900, flatFactor: 1.2, label: "ágil (deportivo)" }
};

function calculateTimeMIDE(D, Eplus, Eminus, terrainSpeed, prof) {
    const realFlatSpeed = terrainSpeed * prof.flatFactor;
    const tFlat = D / realFlatSpeed;
    const tVert = (Eplus / prof.ascent) + (Eminus / prof.descent);
    
    let tEffective; 
    if (tFlat > tVert) tEffective = tFlat + (tVert / 2);
    else tEffective = tVert + (tFlat / 2);

    const tTotal = tEffective * 1.25; 
    return { tTotal, tEffective };
}

function calculateCalories(D, Eplus, W, terrainSpeed, tEffective) {
    const metMap = {3:3.0, 4:3.3, 5:3.8};
    const met = metMap[terrainSpeed] || 3.3; 
    
    const calBase = met * 0.0175 * W * (tEffective * 60);
    const calGrav = W * Eplus * 0.012; 
    
    const calTotal = Math.round(calBase + calGrav);
    return calTotal;
}

function calculateHydrationNeeds(calTotal, tTotal, weatherData) {
    const T = weatherData.temp || 20; 
    
    let baseHydration = (calTotal / 1000) * 0.5;
    
    let heatFactor = 0;
    let hydrationAlert = '';
    
    if (T >= 25 && T < 30) {
        heatFactor = 0.4 * tTotal; 
        hydrationAlert = '⚠️ **Riesgo de Deshidratación/Golpe de Calor:** La temperatura ($\ge 25^\circ\text{C}$) requiere un consumo constante de agua y electrolitos.';
    } else if (T >= 30) {
        heatFactor = 0.6 * tTotal; 
        hydrationAlert = '🚨 **ALERTA de Calor Extremo:** La ruta implica un alto riesgo de golpe de calor. **Añade más de 1L extra** de reserva y planifica pausas en la sombra.';
    }

    let hydrationLiters = Math.max(1.0, baseHydration + heatFactor);
    hydrationLiters = parseFloat(hydrationLiters.toFixed(2));
    
    const carbsGrams = Math.round(40 * tTotal); 
    
    return { hydrationLiters, carbsGrams, hydrationAlert };
}

function calculateSendif(D, Eplus) {
    const s = Math.round(1.5 * Math.pow(D, 2) + 10 * D + (1.5 * Eplus + 0.35 * Eplus) / 2 + (Eplus + 1.1 * Eplus) / D);
    
    let label, className;
    if(s < 135) { label = "Muy fácil"; className = "ccs-results__header--easy"; }
    else if(s <= 400) { label = "Fácil"; className = "ccs-results__header--easy"; }
    else if(s <= 860) { label = "Moderada"; className = "ccs-results__header--mod"; }
    else if(s <= 1200) { label = "Exigente"; className = "ccs-results__header--mod"; }
    else { label = "Muy exigente"; className = "ccs-results__header--hard"; }

    return { score: s, label: label, class: className };
}


/**
 * Wrapper principal para calcular todas las estadísticas puras.
 */
export function calculateRouteStats(D, Eplus, Eminus, W, Terrain, ProfileKey, WeatherData) {
    const prof = profiles[ProfileKey];
    
    const { tTotal, tEffective } = calculateTimeMIDE(D, Eplus, Eminus, Terrain, prof);
    const calTotal = calculateCalories(D, Eplus, W, Terrain, tEffective);
    const { score: sendifScore, label: diffLabel, class: diffClass } = calculateSendif(D, Eplus);
    const nutrition = calculateHydrationNeeds(calTotal, tTotal, WeatherData);

    return {
        tTotal,
        tEffective,
        calTotal,
        sendifScore,
        diffLabel,
        diffClass,
        profileLabel: prof.label,
        nutrition 
    };
}