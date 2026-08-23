window.analyticsCurrentMetric = 'partners';
window.analyticsChartInstance = null;

function computeAnalyticsPlayerCounts(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  return players.map(player => {
    const partners = new Set();
    const opponents = new Set();

    matches.forEach(m => {
      const t1 = [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4].filter(Boolean);
      const t2 = [m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4].filter(Boolean);
      const onT1 = t1.includes(player.PlayerID);
      const onT2 = t2.includes(player.PlayerID);
      if (!onT1 && !onT2) return;

      const myTeam = onT1 ? t1 : t2;
      const oppTeam = onT1 ? t2 : t1;

      myTeam.forEach(pid => { if (pid !== player.PlayerID) partners.add(pid); });
      oppTeam.forEach(pid => opponents.add(pid));
    });

    return {
      player,
      uniquePartners: partners.size,
      uniqueOpponents: opponents.size
    };
  });
}

function renderAnalyticsCards(payload) {
  const data = computeAnalyticsPlayerCounts(payload);
  const metricKey = window.analyticsCurrentMetric === 'partners' ? 'uniquePartners' : 'uniqueOpponents';
  const metricLabel = window.analyticsCurrentMetric === 'partners' ? 'Unique Partners' : 'Unique Opponents';

  const sorted = [...data].sort((a, b) => b[metricKey] - a[metricKey]);

  const labels = sorted.map(d => d.player.FirstName || 'Unnamed');
  const values = sorted.map(d => d[metricKey]);

  const canvas = document.getElementById('analytics-chart-canvas');
  if (!canvas) return;

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy(); // must destroy before re-creating, or Chart.js throws on canvas reuse
  }

  window.analyticsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: metricLabel,
        data: values,
        backgroundColor: '#00E676' // matches your app's accent color
      }]
    },
    options: {
      indexAxis: 'y', // makes it horizontal
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function setAnalyticsMetric(metric) {
  window.analyticsCurrentMetric = metric;

  document.querySelectorAll('#analytics-metric-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === metric);
  });

  renderAnalyticsCards(window.cachedUserUniverse);
}