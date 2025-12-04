import { updateCoordHint } from './utils.js';

export let currentLocation = { lat: null, lon: null, source: 'manual' };
export let currentWeather = { temp: null, windSpeed: null, rainProb: null, error: null };

export async function geocodeLocation(locationName) {
    const hintElement = document.getElementById('ccsCoordHint');
    const btnElement = document.getElementById('ccsGeocodeBtn');

    if (!locationName) {
        updateCoordHint(false, "Por favor, introduce un nombre de lugar.");
        currentLocation.lat = null;
        return false;
    }

    btnElement.innerText = "Buscando...";
    btnElement.disabled = true;
    hintElement.innerHTML = "🔍 Consultando coordenadas...";

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
            updateCoordHint(true, `${currentLocation.lat.toFixed(3)}° N, ${currentLocation.lon.toFixed(3)}° E (${displayName})`);
            return true;
        } else {
            updateCoordHint(false, `No se ha encontrado: "${locationName}".`);
            currentLocation.lat = null;
            return false;
        }
    } catch (error) {
        updateCoordHint(false, `Error de conexión.`);
        currentLocation.lat = null;
        return false;
    } finally {
        btnElement.innerText = "Calcular";
        btnElement.disabled = false;
    }
}

async function fetchWeather() {
    const { lat, lon } = currentLocation;
    const dateInput = document.getElementById('ccsDate');
    const dateStr = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

    if (lat === null || !dateStr) {
        currentWeather = { temp: null, windSpeed: null, rainProb: null, error: 'Faltan datos' };
        return;
    }

    const OPENMETEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

    try {
        const response = await fetch(OPENMETEO_URL);
        const data = await response.json();
        if (data.daily && data.daily.time && data.daily.time.length > 0) {
            currentWeather.temp = data.daily.temperature_2m_max[0];
            currentWeather.windSpeed = data.daily.wind_speed_10m_max[0];
            currentWeather.rainProb = data.daily.precipitation_probability_max[0];
            currentWeather.error = null;
        } else {
            currentWeather.error = 'Sin datos clima.';
        }
    } catch (error) {
        currentWeather.error = 'Error API Clima.';
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
    if(!container) return;

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
    let icon = '🌤️';
    if (T >= 30) icon = '🥵'; else if (T <= 5) icon = '🥶'; else if (P >= 50) icon = '🌧️';
    iconEl.innerText = icon;
    tempEl.innerHTML = `${T ? T.toFixed(0) : '--'}°C`;
}

function calculateSafetyLogistics(tTotal) {
    const dateInput = document.getElementById('ccsDate');
    const dateStr = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);

    const resultDiv = document.getElementById('ccsTimeLogistics');
    const sunriseVal = document.getElementById('resSunriseTime');
    const sunsetLimitVal = document.getElementById('resSunsetLimit');
    const sunsetVal = document.getElementById('resSunsetTime');

    if (!resultDiv || currentLocation.lat === null) return { safetyAlert: '' };
    if (typeof SunCalc === 'undefined') return { safetyAlert: '🚨 Error: Librería SunCalc no cargada.' };

    const times = SunCalc.getTimes(date, currentLocation.lat, currentLocation.lon);
    const safeLimit = times.sunset;
    const fmt = (dt) => dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if(sunriseVal) sunriseVal.innerText = fmt(times.sunrise);
    if(sunsetLimitVal) sunsetLimitVal.innerText = fmt(safeLimit);
    if(sunsetVal) sunsetVal.innerText = fmt(times.dusk);
    resultDiv.style.opacity = 1;

    const startTime = times.sunrise.getTime();
    const tTotalMs = tTotal * 60 * 60 * 1000;
    const estimatedArrival = new Date(startTime + tTotalMs);
    let safetyAlert = '';

    if (estimatedArrival.getTime() > safeLimit.getTime()) {
        const diffMins = Math.round((estimatedArrival.getTime() - safeLimit.getTime()) / 60000);
        safetyAlert = `🚨 **Alerta Logística:** Llegarás ${diffMins} min después del atardecer.`;
    } else if (estimatedArrival.getTime() > (safeLimit.getTime() - 7200000)) {
        safetyAlert = `⚠️ **Advertencia:** Margen solar menor a 2h.`;
    }
    return { sunSetTime: safeLimit, safetyAlert };
}
