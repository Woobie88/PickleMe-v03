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
  const sorted = [...data].sort((a, b) => (a.player.FirstName || '').localeCompare(b.player.FirstName || ''));

  const labels = sorted.map(d => d.player.FirstName || 'Unnamed');
  const partnerValues = sorted.map(d => d.uniquePartners);
  const opponentValues = sorted.map(d => d.uniqueOpponents);

  const canvas = document.getElementById('analytics-chart-canvas');
  if (!canvas) return;

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy();
  }

  if (sorted.length === 0) {
    console.log("Analytics: no players/matches to chart yet.");
    return;
  }

  window.analyticsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Unique Partners',
          data: partnerValues,
          backgroundColor: '#00E676'
        },
        {
          label: 'Unique Opponents',
          data: opponentValues,
          backgroundColor: '#3b82f6'
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false, // CRITICAL — lets the chart actually fill the sized container instead of collapsing
      plugins: {
        legend: { display: true, position: 'top' }
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