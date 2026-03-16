// ============================================================
// TABLAS DE CONFIGURACIÓN
// ============================================================

// Velocidad en llano: factor multiplicador sobre la velocidad base del terreno
export const FLAT_SPEEDS = {
    slow:   { factor: 0.80, label: "Lento"      },
    normal: { factor: 1.00, label: "Normal"     },
    fast:   { factor: 1.20, label: "Rápido"     },
    vfast:  { factor: 1.40, label: "Muy rápido" }
};

// Capacidad vertical: metros de desnivel cubiertos por hora (ascenso / descenso)
export const VERTICAL_PROFILES = {
    beginner:     { ascent: 300,  descent: 400,  label: "Principiante" },
    intermediate: { ascent: 400,  descent: 600,  label: "Intermedio"   },
    advanced:     { ascent: 550,  descent: 750,  label: "Avanzado"     },
    expert:       { ascent: 700,  descent: 1000, label: "Experto"      }
};

// Terreno: velocidad base en llano (km/h) y MET asociado
const TERRAIN_MAP = {
    5: { speed: 5, met: 3.8, label: "Pista forestal"       },
    4: { speed: 4, met: 3.3, label: "Sendero"              },
    3: { speed: 3, met: 3.0, label: "Sendero complejo"     },
    2: { speed: 2, met: 2.8, label: "Trail técnico / Roca" }
};

// Factor corrector MET por sexo
const SEX_FACTOR = {
    male:   1.00,
    female: 0.85
};

// Factor corrector MET por edad
function getAgeFactor(age) {
    if (!age || age <= 0) return 1.0;
    if (age < 30)  return 1.05;
    if (age <= 50) return 1.00;
    if (age <= 65) return 0.95;
    return 0.90;
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * @param {number} distance     - km
 * @param {number} elevGain     - m desnivel positivo
 * @param {number} elevLoss     - m desnivel negativo
 * @param {number} weight       - kg (cuerpo + mochila)
 * @param {number} terrainVal   - clave numérica (2, 3, 4, 5)
 * @param {string} flatSpeedKey - clave de FLAT_SPEEDS
 * @param {string} verticalKey  - clave de VERTICAL_PROFILES
 * @param {string} sex          - 'male' | 'female' | null
 * @param {number} age          - años (opcional, 0 = ignorar)
 */
export function calculateRouteStats(distance, elevGain, elevLoss, weight, terrainVal, flatSpeedKey, verticalKey, sex, age) {
    const terrain  = TERRAIN_MAP[terrainVal];
    const flatSpd  = FLAT_SPEEDS[flatSpeedKey];
    const vertical = VERTICAL_PROFILES[verticalKey];

    // --- 1. TIEMPOS (MIDE) ---
    const realFlatSpeed = terrain.speed * flatSpd.factor;
    const tFlat = distance / realFlatSpeed;
    const tVert = (elevGain / vertical.ascent) + (elevLoss / vertical.descent);

    // Regla de Irmischer: el componente menor se suma a la mitad
    let tEffective;
    if (tFlat > tVert) tEffective = tFlat + (tVert / 2);
    else               tEffective = tVert + (tFlat / 2);

    const tTotal = tEffective * 1.25; // +25% margen seguridad/paradas

    // --- 2. CALORÍAS (Híbrido mejorado) ---
    const sexFactor  = SEX_FACTOR[sex] ?? 1.0;
    const ageFactor  = getAgeFactor(age);
    const metAdjusted = terrain.met * sexFactor * ageFactor;

    // Componente basal (MET)
    const calBase = metAdjusted * 0.0175 * weight * (tEffective * 60);

    // Componente gravitacional: ascenso cuesta más que descenso
    const calGravAscent  = weight * elevGain * 0.012;
    const calGravDescent = weight * elevLoss * 0.003;

    const calMean = Math.round(calBase + calGravAscent + calGravDescent);
    const calMin  = Math.round(calMean * 0.80);
    const calMax  = Math.round(calMean * 1.20);

    // --- 3. DIFICULTAD (SENDIF) ---
    const sendif = Math.round(
        1.5 * Math.pow(distance, 2) +
        10 * distance +
        (1.85 * elevGain) / 2 +
        (2.1 * elevGain) / distance
    );
    const difficulty = getSendifInfo(sendif);

    return {
        tEffective,
        tTotal,
        calMean,
        calMin,
        calMax,
        sendifScore:   sendif,
        diffLabel:     difficulty.label,
        diffClass:     difficulty.class,
        flatLabel:     flatSpd.label,
        verticalLabel: vertical.label
    };
}

// ============================================================
// CLASIFICACIÓN SENDIF
// ============================================================
function getSendifInfo(score) {
    if (score < 135)  return { label: "Muy fácil",    class: "ccs-results__header--easy" };
    if (score <= 400) return { label: "Fácil",         class: "ccs-results__header--easy" };
    if (score <= 860) return { label: "Moderada",      class: "ccs-results__header--mod"  };
    if (score <= 1200)return { label: "Exigente",      class: "ccs-results__header--mod"  };
    return              { label: "Muy exigente",  class: "ccs-results__header--hard" };
}
