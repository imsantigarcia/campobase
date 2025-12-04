// safety-planner.js
/**
 * Módulo de Planificación de Seguridad (Coordenadas, Sol y Clima).
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Obtención de Lat/Lon, fetch de Clima, cálculo de Horarios (SunCalc).
 */

// --- ESTADO GLOBAL ---
export let currentLocation = { 
    lat: null, 
    lon: null, 
    source: 'manual' 
}; 

export let currentWeather = {
    temp: null,
    windSpeed: null,
    rainProb: null,
    error: null
};

// --- FUNCIONES DE VALIDACIÓN Y GEOCODIFICACIÓN ---
export async function geocodeLocation(locationName) {
    const hintElement = document.getElementById('ccsCoordHint');
    const btnElement = document.getElementById('ccsGeocodeBtn');

    if (!locationName) {
        window.updateCoordHint(false, "Por favor, introduce un nombre de lugar.");
        currentLocation.lat = null;
        return false;
    }

    // Lógica de feedback y llamada a Nominatim (sin cambios, ya que funciona)
    btnElement.innerText = "Buscando...";
    btnElement.disabled = true;
    hintElement.innerHTML = "🔍 Consultando coordenadas...";
    hintElement.style.color = 'var(--brand-blue)';
    
    const NOMINATIM_URL = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;

    try {
        const response = await fetch(NOMINATIM_URL);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            
            currentLocation.lat = parseFloat(result.lat);
            currentLocation.lon = parseFloat(result.lon);
            currentLocation.source = 'manual';

            const displayName = result.display_name.split(',').slice(0, 3).join(', ');
            window.updateCoordHint(true, `${currentLocation.lat.toFixed(3)}° N, ${currentLocation.lon.toFixed(3)}° E (${displayName})`);

            window.updateCalculation(); 
            return true;

        } else {
            window.updateCoordHint(false, `No se ha encontrado el lugar: "${locationName}". Prueba con un nombre más específico.`);
            currentLocation.lat = null;
            window.updateCalculation(); 
            return false;
        }

    } catch (error) {
        window.updateCoordHint(false, `Error de conexión con el servicio de mapas.`);
        currentLocation.lat = null;
        window.updateCalculation(); 
        return false;
    } finally {
        btnElement.innerText = "Calcular";
        btnElement.disabled = false;
    }
}


// --- FUNCIONES DE CLIMA Y ORQUESTACIÓN DE SEGURIDAD ---

async function fetchWeather() {
    const { lat, lon } = currentLocation;
    const dateStr = document.getElementById('ccsDate').value;
    
    if (lat === null || !dateStr) {
        currentWeather = { temp: null, windSpeed: null, rainProb: null, error: 'Datos de ubicación/fecha incompletos.' };
        return;
    }

    const isoDate = dateStr; 
    const OPENMETEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;

    try {
        const response = await fetch(OPENMETEO_URL);
        const data = await response.json();
        
        if (data.daily && data.daily.time && data.daily.time.length > 0) {
            currentWeather.temp = data.daily.temperature_2m_max[0];
            currentWeather.windSpeed = data.daily.wind_speed_10m_max[0];
            currentWeather.rainProb = data.daily.precipitation_probability_max[0];
            currentWeather.error = null;
        } else {
            currentWeather.error = 'No hay datos de clima para la fecha seleccionada.';
        }

    } catch (error) {
        currentWeather.error = 'Error de conexión con la API de clima.';
    }
}

export async function fetchWeatherAndCalculateSafety(tTotal) {
    await fetchWeather(); 
    const sunLogistics = calculateSafetyLogistics(tTotal);
    renderWeatherLogistics();
    return sunLogistics;
}

function renderWeatherLogistics() {
    const iconEl = document.getElementById('resWeatherIcon');
    const tempEl = document.getElementById('resTemp');
    const container = document.getElementById('ccsWeatherLogistics');
    
    container.style.opacity = 1;

    if (currentWeather.error || currentLocation.lat === null) {
        iconEl.innerText = '❓';
        tempEl.innerHTML = 'N/D';
        container.style.opacity = 0.5;
        return;
    }

    const T = currentWeather.temp;
    const W = currentWeather.windSpeed;
    const P = currentWeather.rainProb;

    let icon = '❓';
    
    if (T >= 30) icon = '🥵'; 
    else if (T >= 25) icon = '☀️'; 
    else if (T >= 15) icon = '🌤️'; 
    else if (T < 10) icon = '🥶'; 
    
    if (P >= 50) icon = '🌧️'; 
    if (W >= 30) icon = '💨'; 

    iconEl.innerText = icon;
    tempEl.innerHTML = `${T ? T.toFixed(0) : 'N/D'}°C / ${W ? W.toFixed(0) : 'N/D'} km/h`;
}


function calculateSafetyLogistics(tTotal) {
    const dateStr = document.getElementById('ccsDate').value;
    const date = new Date(dateStr);
    
    const resultDiv = document.getElementById('ccsTimeLogistics');
    const sunriseVal = document.getElementById('resSunriseTime');
    const sunsetLimitVal = document.getElementById('resSunsetLimit');
    const sunsetVal = document.getElementById('resSunsetTime');

    if (currentLocation.lat === null || isNaN(currentLocation.lat) || !dateStr) {
        resultDiv.style.opacity = 0.5;
        sunriseVal.innerText = 'N/D';
        sunsetLimitVal.innerText = 'N/D';
        sunsetVal.innerText = 'N/D';
        return { 
            sunSetTime: null, 
            safetyAlert: '⚠️ Introduce ubicación y fecha para calcular los horarios de sol y el riesgo logístico.'
        };
    }
    
    if (typeof SunCalc === 'undefined') {
        // Asumiendo que SunCalc se incluye en index.html
        resultDiv.style.opacity = 0.5;
        sunriseVal.innerText = 'ERR';
        sunsetLimitVal.innerText = 'ERR';
        sunsetVal.innerText = 'ERR';
        return { 
            sunSetTime: null, 
            safetyAlert: '🚨 Error: La librería SunCalc no se ha cargado. No es posible calcular los horarios solares.'
        };
    }
    
    const times = SunCalc.getTimes(date, currentLocation.lat, currentLocation.lon);
    
    const safeLimit = times.sunset;
    const realSunset = times.dusk;

    const fmtTime = (dt) => dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    sunriseVal.innerText = fmtTime(times.sunrise);
    sunsetLimitVal.innerText = fmtTime(safeLimit);
    sunsetVal.innerText = fmtTime(realSunset);
    resultDiv.style.opacity = 1;

    const startTime = times.sunrise.getTime(); 
    const tTotalMs = tTotal * 60 * 60 * 1000;
    const estimatedArrival = new Date(startTime + tTotalMs);
    
    let safetyAlert = '';
    
    if (estimatedArrival.getTime() > safeLimit.getTime()) {
        const diffMs = estimatedArrival.getTime() - safeLimit.getTime();
        const diffMins = Math.round(diffMs / 60000);
        
        safetyAlert = `🚨 **Alerta de Seguridad Logística (MUY ALTO RIESGO):** Su hora estimada de llegada (${fmtTime(estimatedArrival)}) es ${diffMins} minutos después del Atardecer (${fmtTime(safeLimit)}). La ruta no es viable en un solo día sin linterna. **¡Ajusta la hora de inicio o el largo de la ruta!**`;
        
    } else if (estimatedArrival.getTime() > new Date(safeLimit.getTime() - (2 * 60 * 60 * 1000)).getTime()) {
        safetyAlert = `⚠️ **Advertencia de Riesgo Logístico:** La Hora Estimada de Llegada (${fmtTime(estimatedArrival)}) es muy ajustada. Se recomienda empezar al amanecer para disponer de un margen mayor de seguridad.`;
    }
    
    return { sunSetTime: safeLimit, safetyAlert: safetyAlert };
}