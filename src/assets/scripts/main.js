import { calculateRouteStats }            from './modules/calc.js';
import { formatTime }                      from './modules/utils.js';
import { parseGPX }                        from './modules/gpx.js';
import { renderElevationProfile }          from './modules/charts.js';
import { getSafetyInfo }                   from './modules/safety.js';
import { searchMunicipality, reverseGeocode } from './modules/geocoding.js';
import { getDrivingRoute }                 from './modules/driving.js';

// ─── ESTADO ───────────────────────────────────────────────────────────────────
let userOriginLat   = null;   // coords del usuario (para el coche)
let userOriginLng   = null;
let userOriginLabel = '';
let routeStartLat   = null;   // coords del municipio elegido (inicio ruta)
let routeStartLng   = null;
let autocompleteTimer = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initSyncInputs();
    initEventListeners();
    initAutocomplete();
    setDefaultDate();
    requestGeolocation();
    updateCalculation();
});

function setDefaultDate() {
    const el = document.getElementById('ccsDate');
    if (el) el.value = new Date().toISOString().split('T')[0];
}

function requestGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
        userOriginLat = pos.coords.latitude;
        userOriginLng = pos.coords.longitude;
        try {
            const name = await reverseGeocode(userOriginLat, userOriginLng);
            userOriginLabel = name;
            const input = document.getElementById('ccsMunicipality');
            if (input && !input.value && name) {
                input.value   = name;
                routeStartLat = userOriginLat;
                routeStartLng = userOriginLng;
                updateCalculation();
            }
        } catch (_) {}
    }, () => {});
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────
function initEventListeners() {
    ['ccsTerrain', 'ccsFlatSpeed', 'ccsVerticalProfile', 'ccsSex', 'ccsDate']
        .forEach(id => document.getElementById(id)?.addEventListener('change', updateCalculation));

    document.getElementById('ccsAge')
        ?.addEventListener('input', updateCalculation);

    document.getElementById('ccsGpxInput')
        ?.addEventListener('change', handleGPXUpload);

    document.getElementById('ccsSetOrigin')
        ?.addEventListener('click', handleSetOrigin);
}

function handleSetOrigin() {
    if (userOriginLat === null) {
        alert('Activa la geolocalización para usar tu ubicación actual.');
        return;
    }
    const label = document.getElementById('ccsOriginLabel');
    if (label) label.innerText = userOriginLabel
        || `${userOriginLat.toFixed(3)}, ${userOriginLng.toFixed(3)}`;
    updateDriving();
}

function initSyncInputs() {
    [
        ['ccsDistRange',    'ccsDistance'],
        ['ccsElevRange',    'ccsElevation'],
        ['ccsElevNegRange', 'ccsElevationNegative'],
        ['ccsWeightRange',  'ccsWeight'],
    ].forEach(([rid, nid]) => {
        const r = document.getElementById(rid);
        const n = document.getElementById(nid);
        if (!r || !n) return;
        r.addEventListener('input', () => { n.value = r.value; updateCalculation(); });
        n.addEventListener('input', () => { r.value = n.value; updateCalculation(); });
    });
}

// ─── AUTOCOMPLETADO ───────────────────────────────────────────────────────────
function initAutocomplete() {
    const input = document.getElementById('ccsMunicipality');
    const list  = document.getElementById('ccsMunicipalityList');
    if (!input || !list) return;

    input.addEventListener('input', () => {
        clearTimeout(autocompleteTimer);
        const q = input.value.trim();
        if (q.length < 2) { hideList(list); return; }
        autocompleteTimer = setTimeout(async () => {
            try { renderList(list, await searchMunicipality(q), input); }
            catch (_) { hideList(list); }
        }, 300);
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !list.contains(e.target)) hideList(list);
    });

    input.addEventListener('keydown', e => {
        const items  = [...list.querySelectorAll('.ccs-autocomplete__item')];
        const active = list.querySelector('.ccs-autocomplete__item--active');
        if (e.key === 'Escape') { hideList(list); return; }
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx  = active ? items.indexOf(active) + 1 : 0;
            active?.classList.remove('ccs-autocomplete__item--active');
            items[Math.min(idx, items.length - 1)]?.classList.add('ccs-autocomplete__item--active');
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const idx  = active ? items.indexOf(active) - 1 : items.length - 1;
            active?.classList.remove('ccs-autocomplete__item--active');
            items[Math.max(idx, 0)]?.classList.add('ccs-autocomplete__item--active');
        }
        if (e.key === 'Enter' && active) { e.preventDefault(); active.click(); }
    });
}

function renderList(list, results, input) {
    list.innerHTML = '';
    if (!results.length) { hideList(list); return; }
    results.forEach(r => {
        const li = document.createElement('li');
        li.className   = 'ccs-autocomplete__item';
        li.textContent = r.label;
        li.addEventListener('mousedown', e => e.preventDefault()); // evita blur antes del click
        li.addEventListener('click', () => {
            input.value   = r.label;
            routeStartLat = r.lat;
            routeStartLng = r.lng;
            hideList(list);
            updateCalculation();
            updateDriving();
        });
        list.appendChild(li);
    });
    list.classList.add('ccs-autocomplete__list--visible');
}

function hideList(list) {
    list.innerHTML = '';
    list.classList.remove('ccs-autocomplete__list--visible');
}

// ─── ORQUESTADOR ──────────────────────────────────────────────────────────────
function updateCalculation() {
    const data = getDOMValues();
    if (data.D === 0 || data.W === 0) return;

    const results = calculateRouteStats(
        data.D, data.Eplus, data.Eminus, data.W,
        data.Terrain, data.FlatSpeed, data.VerticalProfile,
        data.Sex, data.Age
    );

    renderResults(data, results);

    if (data.date && routeStartLat !== null) {
        renderSafetyCard(getSafetyInfo(data.date, routeStartLat, routeStartLng, results.tTotal));
    }
}

// ─── TRAYECTO EN COCHE ────────────────────────────────────────────────────────
async function updateDriving() {
    if (userOriginLat === null || routeStartLat === null) return;
    const card = document.getElementById('ccsDrivingCard');
    if (!card) return;

    card.querySelector('#drivingStatus').innerText = 'Calculando ruta...';
    card.classList.add('ccs-results--visible');

    try {
        const route = await getDrivingRoute(userOriginLat, userOriginLng, routeStartLat, routeStartLng);
        card.querySelector('#drivingDistVal').innerText = `${route.distanceKm} km`;
        card.querySelector('#drivingTimeVal').innerText = route.durationFmt;
        card.querySelector('#drivingStatus').innerText  = '';
    } catch (err) {
        card.querySelector('#drivingStatus').innerText = `⚠ ${err.message}`;
    }
}

// ─── LECTURA DOM ──────────────────────────────────────────────────────────────
function getDOMValues() {
    const dateStr = document.getElementById('ccsDate')?.value;
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
    };
}

function updateInputPair(rangeId, numId, val) {
    const range = document.getElementById(rangeId);
    const num   = document.getElementById(numId);
    if (val > parseFloat(range.max)) range.max = Math.ceil(val * 1.2);
    range.value = val;
    num.value   = val;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
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
        Esta ruta de <strong>${inputs.D} km</strong> y <strong>${inputs.Eplus} m</strong>
        de desnivel positivo es de dificultad física <strong>${stats.diffLabel.toLowerCase()}</strong>.
        Te llevará aproximadamente <strong>${formatTime(stats.tEffective)}</strong> en movimiento,
        o <strong>${formatTime(stats.tTotal)}</strong> contando paradas.
        Gasto calórico estimado: <strong>${stats.calMin}–${stats.calMax} kcal</strong>
        (${inputs.W} kg · velocidad ${stats.flatLabel} · vertical ${stats.verticalLabel}${sexNote}).
    `;
    document.getElementById('ccsResultCard').classList.add('ccs-results--visible');
}

function renderSafetyCard(s) {
    const card = document.getElementById('ccsSafetyCard');
    if (!card) return;

    const levelClass = {
        ok: 'ccs-safety__header--ok', warn: 'ccs-safety__header--warn',
        danger: 'ccs-safety__header--danger', impossible: 'ccs-safety__header--danger',
    }[s.level];
    const icon = { ok: '✅', warn: '⚠️', danger: '🚫', impossible: '🚫' }[s.level];

    const hdr = card.querySelector('.ccs-safety__header');
    hdr.className = `ccs-safety__header ${levelClass}`;
    hdr.innerHTML = `<span class="ccs-safety__icon">${icon}</span><span>${s.levelLabel}</span>`;

    card.querySelector('#safetyLatestStart').innerText = s.fmtLatest;
    card.querySelector('#safetySunrise').innerText     = s.fmtSunrise;
    card.querySelector('#safetySunset').innerText      = s.fmtSunset;
    card.querySelector('#safetyCivil').innerText       = s.fmtDusk;

    renderSafetyTimeline(card.querySelector('#safetyTimeline'), s);
    card.classList.add('ccs-results--visible');
}

// ─── CANVAS (con corrección DPR) ──────────────────────────────────────────────
function renderSafetyTimeline(canvas, s) {
    if (!canvas || !s.sunrise || !s.civilDusk) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth || 680;
    const H   = 68;

    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const REF_START = 5 * 60, REF_SPAN = 18 * 60;

    function toX(date) {
        const local = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        return Math.max(0, Math.min(W, ((local.getHours() * 60 + local.getMinutes() - REF_START) / REF_SPAN) * W));
    }

    const xSunrise = toX(s.sunrise), xSunset = toX(s.sunset);
    const xDusk    = toX(s.civilDusk);
    const xLatest  = s.latestStart ? toX(s.latestStart) : null;
    const Y = 22, BAR = 24, R = 6;

    const rr = (x, y, w, h, r) => {
        if (w <= 0) return;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);     ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
    };

    ctx.fillStyle = '#1e1b4b'; rr(0, Y, W, BAR, R); ctx.fill();
    ctx.fillStyle = '#f97316'; rr(xSunrise, Y, xDusk - xSunrise, BAR, 0); ctx.fill();
    ctx.fillStyle = '#fde68a'; rr(xSunrise, Y, xSunset - xSunrise, BAR, 0); ctx.fill();

    if (xLatest !== null && xLatest > xSunrise) {
        ctx.fillStyle = { ok:'rgba(34,197,94,.4)', warn:'rgba(251,191,36,.5)', danger:'rgba(239,68,68,.5)', impossible:'rgba(239,68,68,.5)' }[s.level];
        rr(xSunrise, Y, xLatest - xSunrise, BAR, 0); ctx.fill();
    }

    if (xLatest !== null) {
        const col = { ok:'#16a34a', warn:'#d97706', danger:'#dc2626', impossible:'#dc2626' }[s.level];
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(xLatest, Y-5); ctx.lineTo(xLatest, Y+BAR+5); ctx.stroke();
        ctx.fillStyle = col; ctx.font = 'bold 11px Montserrat,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`⬆ ${s.fmtLatest}`, clamp(xLatest, 34, W-34), Y-8);
    }

    ctx.font = '10px Montserrat,sans-serif'; ctx.textAlign = 'center';
    [[xSunrise,`🌅 ${s.fmtSunrise}`],[xSunset,`🌇 ${s.fmtSunset}`],[xDusk,`🌑 ${s.fmtDusk}`]]
        .forEach(([x,l]) => { ctx.fillStyle='#555'; ctx.fillText(l, clamp(x,28,W-28), Y+BAR+14); });
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ─── GPX ──────────────────────────────────────────────────────────────────────
function handleGPXUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('ccsGpxText').innerText = 'Analizando ruta...';
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const g = parseGPX(evt.target.result);
            updateInputPair('ccsDistRange',    'ccsDistance',          g.distance);
            updateInputPair('ccsElevRange',    'ccsElevation',         g.elevationGain);
            updateInputPair('ccsElevNegRange', 'ccsElevationNegative', g.elevationLoss);
            document.getElementById('ccsGpxText').innerText =
                `Cargado: ${g.distance} km | +${g.elevationGain} m | -${g.elevationLoss} m`;
            document.getElementById('ccsProfileCard').classList.add('ccs-profile-card--visible');
            renderElevationProfile('elevationChart', g.trackData);
            updateCalculation();
        } catch (err) {
            document.getElementById('ccsGpxText').innerText = `⚠ Error: ${err.message}`;
        }
    };
    reader.readAsText(file);
}
