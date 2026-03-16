import { calculateRouteStats }    from './modules/calc.js';
import { formatTime }              from './modules/utils.js';
import { parseGPX }                from './modules/gpx.js';
import { renderElevationProfile }  from './modules/charts.js';
import { getSafetyInfo }           from './modules/safety.js';

// ─── INICIALIZACIÓN ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initSyncInputs();
    initEventListeners();
    setDefaultDate();
    requestGeolocation();
    updateCalculation();
});

// ─── FECHA POR DEFECTO ───────────────────────────────────────────────────────
function setDefaultDate() {
    const el = document.getElementById('ccsDate');
    if (!el) return;
    const today = new Date();
    el.value = today.toISOString().split('T')[0];
}

// ─── GEOLOCALIZACIÓN ─────────────────────────────────────────────────────────
function requestGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = document.getElementById('ccsLat');
            const lng = document.getElementById('ccsLng');
            if (lat) lat.value = pos.coords.latitude.toFixed(4);
            if (lng) lng.value = pos.coords.longitude.toFixed(4);
            updateCalculation();
        },
        () => {} // Si deniegan, se usan los valores por defecto del HTML
    );
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────
function initEventListeners() {
    ['ccsTerrain', 'ccsFlatSpeed', 'ccsVerticalProfile', 'ccsSex', 'ccsDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateCalculation);
    });

    ['ccsAge', 'ccsLat', 'ccsLng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCalculation);
    });

    const gpxInput = document.getElementById('ccsGpxInput');
    if (gpxInput) gpxInput.addEventListener('change', handleGPXUpload);
}

function initSyncInputs() {
    const pairs = [
        ['ccsDistRange',    'ccsDistance'],
        ['ccsElevRange',    'ccsElevation'],
        ['ccsElevNegRange', 'ccsElevationNegative'],
        ['ccsWeightRange',  'ccsWeight'],
    ];

    pairs.forEach(([rangeId, numId]) => {
        const r = document.getElementById(rangeId);
        const n = document.getElementById(numId);
        if (!r || !n) return;
        r.addEventListener('input', () => { n.value = r.value; updateCalculation(); });
        n.addEventListener('input', () => { r.value = n.value; updateCalculation(); });
    });
}

// ─── ORQUESTADOR ─────────────────────────────────────────────────────────────
function updateCalculation() {
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;

    const results = calculateRouteStats(
        data.D, data.Eplus, data.Eminus, data.W,
        data.Terrain, data.FlatSpeed, data.VerticalProfile,
        data.Sex, data.Age
    );

    renderResults(data, results);

    if (data.date && data.lat !== null && data.lng !== null) {
        const safety = getSafetyInfo(data.date, data.lat, data.lng, results.tTotal);
        renderSafetyCard(safety);
    }
}

// ─── LECTURA DOM ─────────────────────────────────────────────────────────────
function getDOMValues() {
    const dateStr = document.getElementById('ccsDate')?.value;
    const latVal  = parseFloat(document.getElementById('ccsLat')?.value);
    const lngVal  = parseFloat(document.getElementById('ccsLng')?.value);

    return {
        D:               parseFloat(document.getElementById('ccsDistance').value)          || 0,
        Eplus:           parseFloat(document.getElementById('ccsElevation').value)         || 0,
        Eminus:          parseFloat(document.getElementById('ccsElevationNegative').value) || 0,
        W:               parseFloat(document.getElementById('ccsWeight').value)            || 0,
        Terrain:         parseFloat(document.getElementById('ccsTerrain').value),
        FlatSpeed:       document.getElementById('ccsFlatSpeed').value,
        VerticalProfile: document.getElementById('ccsVerticalProfile').value,
        Sex:             document.getElementById('ccsSex')?.value   || null,
        Age:             parseFloat(document.getElementById('ccsAge')?.value) || 0,
        date:            dateStr ? new Date(dateStr + 'T12:00:00') : null,
        lat:             isNaN(latVal) ? null : latVal,
        lng:             isNaN(lngVal) ? null : lngVal,
    };
}

// ─── RENDER RESULTADOS ────────────────────────────────────────────────────────
function updateInputPair(rangeId, numId, val) {
    const range = document.getElementById(rangeId);
    const num   = document.getElementById(numId);
    if (val > parseFloat(range.max)) range.max = Math.ceil(val * 1.2);
    range.value = val;
    num.value   = val;
}

function renderResults(inputs, stats) {
    const header = document.getElementById('resHeader');
    header.innerText = `Dificultad física: ${stats.diffLabel}`;
    header.className = `ccs-results__header ${stats.diffClass}`;

    document.getElementById('resTotalTimeVal').innerText = formatTime(stats.tTotal);
    document.getElementById('resCaloriesVal').innerText  = `${stats.calMin}–${stats.calMax}`;
    document.getElementById('resSendifScore').innerText  = stats.sendifScore;

    const sexNote = inputs.Sex
        ? ` · ${inputs.Sex === 'female' ? 'mujer' : 'hombre'}${inputs.Age > 0 ? `, ${inputs.Age} años` : ''}`
        : '';

    document.getElementById('resNarrativeText').innerHTML = `
        Esta ruta de <strong>${inputs.D} km</strong> y <strong>${inputs.Eplus} m</strong> de desnivel
        positivo es de dificultad física <strong>${stats.diffLabel.toLowerCase()}</strong>.
        Te llevará aproximadamente <strong>${formatTime(stats.tEffective)}</strong> en movimiento,
        o <strong>${formatTime(stats.tTotal)}</strong> contando paradas.
        Gasto calórico estimado: <strong>${stats.calMin}–${stats.calMax} kcal</strong>
        (${inputs.W} kg · velocidad ${stats.flatLabel} · vertical ${stats.verticalLabel}${sexNote}).
    `;
    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}

// ─── RENDER TARJETA DE SEGURIDAD ─────────────────────────────────────────────
function renderSafetyCard(s) {
    const card = document.getElementById('ccsSafetyCard');
    if (!card) return;

    const levelClass = {
        ok:         'ccs-safety__header--ok',
        warn:       'ccs-safety__header--warn',
        danger:     'ccs-safety__header--danger',
        impossible: 'ccs-safety__header--danger',
    }[s.level];

    const icon = { ok: '✅', warn: '⚠️', danger: '🚫', impossible: '🚫' }[s.level];

    const header = card.querySelector('.ccs-safety__header');
    header.className = `ccs-safety__header ${levelClass}`;
    header.innerHTML = `<span class="ccs-safety__icon">${icon}</span><span>${s.levelLabel}</span>`;

    card.querySelector('#safetyLatestStart').innerText = s.fmtLatest;
    card.querySelector('#safetySunrise').innerText     = s.fmtSunrise;
    card.querySelector('#safetySunset').innerText      = s.fmtSunset;
    card.querySelector('#safetyCivil').innerText       = s.fmtDusk;

    renderSafetyTimeline(card.querySelector('#safetyTimeline'), s);
    card.classList.add('ccs-results--visible');
}

function renderSafetyTimeline(canvas, s) {
    if (!canvas || !s.sunrise || !s.civilDusk) return;

    const W = canvas.offsetWidth || 680;
    const H = 68;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Ventana de referencia: 05:00–23:00
    const REF_START = 5 * 60;
    const REF_SPAN  = 18 * 60;

    function toX(date) {
        const local = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const mins  = local.getHours() * 60 + local.getMinutes();
        return Math.max(0, Math.min(W, ((mins - REF_START) / REF_SPAN) * W));
    }

    const xSunrise = toX(s.sunrise);
    const xSunset  = toX(s.sunset);
    const xDusk    = toX(s.civilDusk);
    const xLatest  = s.latestStart ? toX(s.latestStart) : null;

    const Y = 22, BAR = 24, R = 6;

    // Noche
    ctx.fillStyle = '#1e1b4b';
    roundRect(ctx, 0, Y, W, BAR, R); ctx.fill();

    // Crepúsculo (amanecer → atardecer + margen civil)
    ctx.fillStyle = '#f97316';
    roundRect(ctx, xSunrise, Y, xDusk - xSunrise, BAR, 0); ctx.fill();

    // Día (amanecer → atardecer)
    ctx.fillStyle = '#fde68a';
    roundRect(ctx, xSunrise, Y, xSunset - xSunrise, BAR, 0); ctx.fill();

    // Zona segura de inicio
    if (xLatest !== null && xLatest > xSunrise) {
        ctx.fillStyle = {
            ok:         'rgba(34,197,94,0.4)',
            warn:       'rgba(251,191,36,0.5)',
            danger:     'rgba(239,68,68,0.5)',
            impossible: 'rgba(239,68,68,0.5)',
        }[s.level];
        roundRect(ctx, xSunrise, Y, xLatest - xSunrise, BAR, 0); ctx.fill();
    }

    // Marcador hora máxima
    if (xLatest !== null) {
        const col = { ok: '#16a34a', warn: '#d97706', danger: '#dc2626', impossible: '#dc2626' }[s.level];
        ctx.strokeStyle = col;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.moveTo(xLatest, Y - 5);
        ctx.lineTo(xLatest, Y + BAR + 5);
        ctx.stroke();

        // Etiqueta hora máxima (arriba)
        ctx.fillStyle = col;
        ctx.font      = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`⬆ ${s.fmtLatest}`, clamp(xLatest, 32, W - 32), Y - 8);
    }

    // Etiquetas inferiores: amanecer, atardecer, crepúsculo
    ctx.font      = '10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    [
        [xSunrise, `🌅 ${s.fmtSunrise}`],
        [xSunset,  `🌇 ${s.fmtSunset}`],
        [xDusk,    `🌑 ${s.fmtDusk}`],
    ].forEach(([x, label]) => {
        ctx.fillStyle = '#555';
        ctx.fillText(label, clamp(x, 28, W - 28), Y + BAR + 14);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    if (w <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── GPX ─────────────────────────────────────────────────────────────────────
function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ccsGpxText').innerText = 'Analizando ruta...';

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const gpxData = parseGPX(evt.target.result);
            updateInputPair('ccsDistRange',    'ccsDistance',          gpxData.distance);
            updateInputPair('ccsElevRange',    'ccsElevation',         gpxData.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative', gpxData.elevationLoss);
            document.getElementById('ccsGpxText').innerText =
                `Cargado: ${gpxData.distance} km | +${gpxData.elevationGain} m | -${gpxData.elevationLoss} m`;
            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', gpxData.trackData);
            updateCalculation();
        } catch (err) {
            document.getElementById('ccsGpxText').innerText = `⚠ Error: ${err.message}`;
        }
    };
    reader.readAsText(file);
}
