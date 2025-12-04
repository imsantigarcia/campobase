// charts.js
/**
 * Módulo de Visualización de Gráficas
 * Autor: Campo Base (Asistente CTO)
 * Responsabilidad: Dibujar el perfil de elevación.
 */
let chartInstance = null;

export function renderElevationProfile(canvasId, dataPoints) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = dataPoints.map(p => p.x);
    const data = dataPoints.map(p => p.y);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 139, 250, 0.6)');
    gradient.addColorStop(1, 'rgba(59, 139, 250, 0.0)');

    chartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Altitud (m)',
                data: data,
                borderColor: '#3b8bfa',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (c) => `Km: ${c[0].label}`,
                        label: (c) => `Altitud: ${c.raw} m`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: 'Distancia (km)' }, ticks: { maxTicksLimit: 10 } },
                y: { title: { display: true, text: 'Elevación (m)' } }
            }
        }
    });

    return chartInstance;
}