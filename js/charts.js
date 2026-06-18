// charts.js — Chart.js wrappers for WC2026 Analytics

const COLORS = {
  home: '#1a3a8f',
  away: '#d63b1f',
  homeLight: 'rgba(26,58,143,0.15)',
  awayLight: 'rgba(214,59,31,0.15)',
  grid: 'rgba(0,0,0,0.06)',
  text: '#666'
};

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 11 } } },
    y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 11 } } }
  }
};

function destroyChart(id) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();
}

// Horizontal comparison bar for two teams
function renderStatsBar(canvasId, labels, homeVals, awayVals, homeLabel, awayLabel) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: homeLabel, data: homeVals, backgroundColor: COLORS.home, borderRadius: 4 },
        { label: awayLabel, data: awayVals, backgroundColor: COLORS.away, borderRadius: 4 }
      ]
    },
    options: { ...BASE_OPTIONS, plugins: { legend: { display: false } } }
  });
}

// Doughnut for phases of play
function renderPhasesDonut(canvasId, phaseData, colorSet) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Object.keys(phaseData).map(k => k.replace(/([A-Z])/g, ' $1').trim());
  const values = Object.values(phaseData);
  const palette = colorSet === 'home'
    ? ['#1a3a8f','#2651c2','#3264f5','#5a84f7','#7fa3f9','#a4c0fb','#c8d8fd']
    : ['#d63b1f','#e55234','#ef7055','#f48e77','#f8ab9b','#fbc8bf','#fde4e0'];
  new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: palette, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } }
      }
    }
  });
}

// Radar for team style comparison (multi-match aggregate)
function renderStyleRadar(canvasId, homeVals, awayVals, homeLabel, awayLabel, homeRaw) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = ['Possession', 'xG', 'Pass Accuracy', 'Line Breaks', 'Pressing', 'Distance'];
  const units  = ['%', '', '%', '', '', ' km'];
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        { label: homeLabel, data: homeVals, backgroundColor: COLORS.homeLight, borderColor: COLORS.home, borderWidth: 2, pointRadius: 3 },
        { label: awayLabel, data: awayVals, backgroundColor: COLORS.awayLight, borderColor: COLORS.away, borderWidth: 2, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (homeRaw && ctx.datasetIndex === 0) {
                const raw = homeRaw[ctx.dataIndex];
                const u   = units[ctx.dataIndex] || '';
                const fmt = typeof raw === 'number' && !Number.isInteger(raw) ? raw.toFixed(2) : raw;
                return ` ${ctx.dataset.label}: ${fmt}${u}`;
              }
              return ` ${ctx.dataset.label}: ${ctx.raw}`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0, max: 100,
          grid: { color: COLORS.grid },
          ticks: { display: false },
          pointLabels: { font: { size: 11 }, color: COLORS.text }
        }
      }
    }
  });
}

// Physical top-speed horizontal bar
function renderSpeedChart(canvasId, players) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: players.map(p => p.name),
      datasets: [{
        data: players.map(p => p.speed),
        backgroundColor: players.map(p => p.team === 'home' ? COLORS.home : COLORS.away),
        borderRadius: 4
      }]
    },
    options: {
      ...BASE_OPTIONS,
      indexAxis: 'y',
      scales: {
        x: { min: 25, grid: { color: COLORS.grid }, ticks: { color: COLORS.text, font: { size: 11 } } },
        y: { grid: { color: 'transparent' }, ticks: { color: COLORS.text, font: { size: 11 } } }
      }
    }
  });
}

// Out-of-possession grouped bar
function renderDefenseBar(canvasId, homeVals, awayVals) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = ['Total Pressures', 'Direct Pressures', 'Forced Turnovers', 'Second Balls', 'Tackles'];
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Home', data: homeVals, backgroundColor: COLORS.home, borderRadius: 4 },
        { label: 'Away', data: awayVals, backgroundColor: COLORS.away, borderRadius: 4 }
      ]
    },
    options: { ...BASE_OPTIONS }
  });
}
