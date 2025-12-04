// gpx.js
/**
 * Módulo de Manejo de Archivos GPX.
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Parsear el XML, calcular métricas GPX y trackData.
 */
import { getDistanceFromLatLonInKm } from './utils.js'; // Importamos la fórmula de distancia

/**
 * Parsea el XML del GPX y devuelve los datos clave.
 */
export function parseGPX(xmlData) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");
    const points = xmlDoc.getElementsByTagName("trkpt");
    
    if (points.length === 0) {
        throw new Error("No se encontraron puntos de track (trkpt) en el GPX.");
    }

    let totalDist = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let trackData = []; 
    
    const ELEVATION_THRESHOLD = 5; 
    const samplingRate = Math.ceil(points.length / 500);

    // Primer Punto
    const lat0 = parseFloat(points[0].getAttribute("lat"));
    const lon0 = parseFloat(points[0].getAttribute("lon"));
    const eleTag0 = points[0].getElementsByTagName("ele")[0];
    const ele0 = eleTag0 ? parseFloat(eleTag0.textContent) : 0;
    
    let lastLat = lat0;
    let lastLon = lon0;
    let lastEle = ele0;
    let anchorEle = ele0;

    trackData.push({x: 0, y: lastEle});

    for (let i = 1; i < points.length; i++) {
        const lat = parseFloat(points[i].getAttribute("lat"));
        const lon = parseFloat(points[i].getAttribute("lon"));
        const eleTag = points[i].getElementsByTagName("ele")[0];
        const ele = eleTag ? parseFloat(eleTag.textContent) : lastEle;

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
    
    trackData.push({ x: parseFloat(totalDist.toFixed(2)), y: Math.round(lastEle) });

    return {
        distance: parseFloat(totalDist.toFixed(1)),
        elevationGain: Math.round(elevationGain),
        elevationLoss: Math.round(elevationLoss),
        trackData,
        lat0,
        lon0
    };
}