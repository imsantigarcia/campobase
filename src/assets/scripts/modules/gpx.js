import { getDistanceFromLatLonInKm } from './utils.js';

export function parseGPX(xmlData) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");
    const points = xmlDoc.getElementsByTagName("trkpt");

    if (points.length === 0) throw new Error("No se encontraron puntos en el GPX");

    let totalDist = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let trackData = []; // Para la gráfica
    
    // Configuración de muestreo
    const ELEVATION_THRESHOLD = 5;
    const samplingRate = Math.ceil(points.length / 500);

    let lastLat = parseFloat(points[0].getAttribute("lat"));
    let lastLon = parseFloat(points[0].getAttribute("lon"));
    let lastEle = getElevation(points[0]);
    let anchorEle = lastEle;

    trackData.push({ x: 0, y: lastEle });

    for (let i = 1; i < points.length; i++) {
        const lat = parseFloat(points[i].getAttribute("lat"));
        const lon = parseFloat(points[i].getAttribute("lon"));
        const ele = getElevation(points[i], lastEle);

        const distSeg = getDistanceFromLatLonInKm(lastLat, lastLon, lat, lon);
        totalDist += distSeg;

        const diff = ele - anchorEle;
        if (Math.abs(diff) >= ELEVATION_THRESHOLD) {
            if (diff > 0) elevationGain += diff;
            else elevationLoss += Math.abs(diff);
            anchorEle = ele;
        }

        if (i % samplingRate === 0) {
            trackData.push({ x: parseFloat(totalDist.toFixed(2)), y: Math.round(ele) });
        }

        lastLat = lat;
        lastLon = lon;
        lastEle = ele;
    }

    // Asegurar último punto
    trackData.push({ x: parseFloat(totalDist.toFixed(2)), y: Math.round(lastEle) });

    return {
        distance: parseFloat(totalDist.toFixed(1)),
        elevationGain: Math.round(elevationGain),
        elevationLoss: Math.round(elevationLoss),
        trackData
    };
}

function getElevation(point, fallback = 0) {
    const eleTag = point.getElementsByTagName("ele")[0];
    return eleTag ? parseFloat(eleTag.textContent) : fallback;
}