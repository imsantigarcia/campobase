// Configuración de perfiles
const PROFILES = {
    beginner: { ascent: 300, descent: 400, flatFactor: 0.9, label: "pausado (iniciación)" },
    average: { ascent: 400, descent: 600, flatFactor: 1.0, label: "medio (estándar)" },
    expert: { ascent: 600, descent: 900, flatFactor: 1.2, label: "ágil (deportivo)" }
};

// Mapa de equivalencia terreno/MET (Gasto energético)
const MET_MAP = { 3: 3.0, 4: 3.3, 5: 3.8 };

export function calculateRouteStats(distance, elevGain, elevLoss, weight, terrainVal, profileKey) {
    const prof = PROFILES[profileKey];
    
    // --- 1. TIEMPOS (MIDE) ---
    const realFlatSpeed = terrainVal * prof.flatFactor;
    const tFlat = distance / realFlatSpeed;
    const tVert = (elevGain / prof.ascent) + (elevLoss / prof.descent);

    let tEffective;
    if (tFlat > tVert) tEffective = tFlat + (tVert / 2);
    else tEffective = tVert + (tFlat / 2);

    const tTotal = tEffective * 1.25; // +25% margen seguridad/paradas

    // --- 2. CALORÍAS (Híbrido) ---
    const met = MET_MAP[terrainVal] || 3.3;
    const calBase = met * 0.0175 * weight * (tEffective * 60);
    const calGrav = weight * elevGain * 0.012;
    const calTotal = Math.round(calBase + calGrav);

    // --- 3. DIFICULTAD (SENDIF) ---
    // Fórmula: 1.5*D^2 + 10*D + (1.5*E+ + 0.35*E+)/2 + (E+ + 1.1*E+)/D
    // Nota: Simplificado según tu script original
    const sendif = Math.round(1.5 * Math.pow(distance, 2) + 10 * distance + (1.85 * elevGain) / 2 + (2.1 * elevGain) / distance);
    const difficulty = getSendifInfo(sendif);

    return {
        tEffective,
        tTotal,
        calTotal,
        sendifScore: sendif,
        diffLabel: difficulty.label,
        diffClass: difficulty.class,
        profileLabel: prof.label
    };
}

function getSendifInfo(score) {
    if (score < 135) return { label: "Muy fácil", class: "ccs-results__header--easy" };
    if (score <= 400) return { label: "Fácil", class: "ccs-results__header--easy" };
    if (score <= 860) return { label: "Moderada", class: "ccs-results__header--mod" };
    if (score <= 1200) return { label: "Exigente", class: "ccs-results__header--mod" };
    return { label: "Muy exigente", class: "ccs-results__header--hard" };
}