window.analyticsChartInstance = null;
window.analyticsScreenIndex = 0; // 0=unique, 1=max, 2=wins/losses, 3=points, 4=byes
window.analyticsRawData = [];

function computeAnalyticsPlayerCounts(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))].sort((a, b) => a - b); // NEW

  return players.map(player => {
    const partnerCounts = {};
    const opponentCounts = {};
    const roundResults = {};
    const roundPoints = {};
    const roundsPlayed = new Set(); // NEW
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    matches.forEach(m => {
      const t1 = [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4].filter(Boolean);
      const t2 = [m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4].filter(Boolean);
      const onT1 = t1.includes(player.PlayerID);
      const onT2 = t2.includes(player.PlayerID);
      if (!onT1 && !onT2) return;

      const myTeam = onT1 ? t1 : t2;
      const oppTeam = onT1 ? t2 : t1;
      const round = parseInt(m.Round) || 0;
      roundsPlayed.add(round); // NEW — tracked regardless of scoring mode/result

      if (onT1) {
        if (m.Team1WinLoss === 'Win') { wins++; roundResults[round] = 'Win'; }
        else if (m.Team1WinLoss === 'Loss') { losses++; roundResults[round] = 'Loss'; }
        const forScore = Number(m.Team1Score) || 0;
        const againstScore = Number(m.Team2Score) || 0;
        pointsFor += forScore;
        pointsAgainst += againstScore;
        roundPoints[round] = { for: forScore, against: againstScore };
      }

      if (onT2) {
        if (m.Team2WinLoss === 'Win') { wins++; roundResults[round] = 'Win'; }
        else if (m.Team2WinLoss === 'Loss') { losses++; roundResults[round] = 'Loss'; }
        const forScore = Number(m.Team2Score) || 0;
        const againstScore = Number(m.Team1Score) || 0;
        pointsFor += forScore;
        pointsAgainst += againstScore;
        roundPoints[round] = { for: forScore, against: againstScore };
      }

      myTeam.forEach(pid => {
        if (pid !== player.PlayerID) partnerCounts[pid] = (partnerCounts[pid] || 0) + 1;
      });
      oppTeam.forEach(pid => {
        opponentCounts[pid] = (opponentCounts[pid] || 0) + 1;
      });
    });

    const byeRounds = allRounds.filter(r => !roundsPlayed.has(r)); // NEW

    return {
      player,
      uniquePartners: Object.keys(partnerCounts).length,
      uniqueOpponents: Object.keys(opponentCounts).length,
      maxSamePartner: Math.max(0, ...Object.values(partnerCounts)),
      maxSameOpponent: Math.max(0, ...Object.values(opponentCounts)),
      wins, losses, pointsFor, pointsAgainst,
      partnerCounts,
      opponentCounts,
      roundResults,
      roundPoints,
      byeRounds // NEW
    };
  });
}

function getPlayerNameById(pid) {
  const p = window.analyticsRawData.find(d => d.player.PlayerID === pid);
  return p ? (p.player.FirstName || 'Unnamed') : pid;
}

function renderAnalyticsCards(payload) {
  const data = computeAnalyticsPlayerCounts(payload);
  window.analyticsRawData = data;

  const sorted = [...data].sort((a, b) => (a.player.FirstName || '').localeCompare(b.player.FirstName || ''));
  const labels = sorted.map(d => d.player.FirstName || 'Unnamed');

  const canvas = document.getElementById('analytics-chart-canvas');
  if (!canvas) return;

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy();
  }

  if (sorted.length === 0) {
    console.log("Analytics: no players/matches to chart yet.");
    return;
  }

  let datasets, heading;

  if (window.analyticsScreenIndex === 0) {
    heading = 'Unique Partners & Opponents';
    datasets = [
      { label: 'Unique Partners', data: sorted.map(d => d.uniquePartners), backgroundColor: '#00E676' },
      { label: 'Unique Opponents', data: sorted.map(d => d.uniqueOpponents), backgroundColor: '#3b82f6' }
    ];
  } else if (window.analyticsScreenIndex === 1) {
    heading = 'Max Same Partner & Opponent';
    datasets = [
      { label: 'Max Partner', data: sorted.map(d => d.maxSamePartner), backgroundColor: '#f59e0b' },
      { label: 'Max Opponent', data: sorted.map(d => d.maxSameOpponent), backgroundColor: '#ef4444' }
    ];
  } else if (window.analyticsScreenIndex === 2) {
    heading = 'Game Wins & Losses';
    datasets = [
      { label: 'Wins', data: sorted.map(d => d.wins), backgroundColor: '#00E676' },
      { label: 'Losses', data: sorted.map(d => d.losses), backgroundColor: '#ef4444' }
    ];
  } else if (window.analyticsScreenIndex === 3) {
    heading = 'Game Points For & Against';
    datasets = [
      { label: 'Points For', data: sorted.map(d => d.pointsFor), backgroundColor: '#00E676' },
      { label: 'Points Against', data: sorted.map(d => d.pointsAgainst), backgroundColor: '#ef4444' }
    ];
  } else if (window.analyticsScreenIndex === 4) { // NEW
    heading = 'Byes';
    datasets = [
      { label: 'Byes', data: sorted.map(d => d.byeRounds.length), backgroundColor: '#64748b' } // slate — neutral, byes aren't inherently good or bad
    ];
  }

  document.getElementById('analytics-heading').innerText = heading;

  window.analyticsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label(ctx) {
              const entry = sorted[ctx.dataIndex];
              const isFirstDataset = ctx.datasetIndex === 0;

              if (window.analyticsScreenIndex === 0) {
                const countsMap = isFirstDataset ? entry.partnerCounts : entry.opponentCounts;
                const lines = Object.entries(countsMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pid, count]) => `${getPlayerNameById(pid)}: ${count}`);
                return lines.length > 0 ? lines : ['No games yet'];

              } else if (window.analyticsScreenIndex === 1) {
                const countsMap = isFirstDataset ? entry.partnerCounts : entry.opponentCounts;
                const maxValue = isFirstDataset ? entry.maxSamePartner : entry.maxSameOpponent;
                const namesAtMax = Object.entries(countsMap)
                  .filter(([pid, count]) => count === maxValue)
                  .map(([pid]) => getPlayerNameById(pid));
                return namesAtMax.length > 0 ? [`${maxValue}x: ${namesAtMax.join(', ')}`] : ['No repeats yet'];

              } else if (window.analyticsScreenIndex === 3) {
                const rounds = Object.keys(entry.roundResults).map(Number).sort((a, b) => a - b);
                const lines = rounds.map(r => `Round ${r}: ${entry.roundResults[r]}`);
                return lines.length > 0 ? lines : ['No results yet'];

              } else if (window.analyticsScreenIndex === 4) {
                const rounds = Object.keys(entry.roundPoints).map(Number).sort((a, b) => a - b);
                const lines = rounds.map(r => `Round ${r}: ${entry.roundPoints[r].for} - ${entry.roundPoints[r].against}`);
                return lines.length > 0 ? lines : ['No scores yet'];

              // Inside renderAnalyticsCards, replace the screenIndex === 4 block:

              } else if (window.analyticsScreenIndex === 2) {
                heading = 'Byes By Round';
                // Scatter needs its own Chart.js call — different axis/data shape than the bar charts
                renderByesScatterChart(sorted, labels);
                return; // skip the shared bar-chart builder below entirely for this screen
              }

              return `${ctx.dataset.label}: ${ctx.parsed.x}`;
            }
          }
        }
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

function initAnalyticsSwipeHandlers() {
  const container = document.getElementById('screen-analytics');
  if (!container) return;
  let startX = 0, startY = 0;

  container.addEventListener('touchstart', (e) => {
    startX = e.changedTouches[0].screenX;
    startY = e.changedTouches[0].screenY;
  });

  container.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].screenX - startX;
    const deltaY = e.changedTouches[0].screenY - startY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0 && window.analyticsScreenIndex < 4) { // CHANGED — was < 3
      window.analyticsScreenIndex++;
      renderAnalyticsCards(window.cachedUserUniverse);
    } else if (deltaX > 0 && window.analyticsScreenIndex > 0) {
      window.analyticsScreenIndex--;
      renderAnalyticsCards(window.cachedUserUniverse);
    }
  });
}

window.analyticsByeScatterInstance = null;

function renderByesScatterChart(sorted, labels) {
  const canvas = document.getElementById('analytics-chart-canvas');
  if (!canvas) return;

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy();
    window.analyticsChartInstance = null;
  }

  document.getElementById('analytics-heading').innerText = 'Byes By Round';

  // Each point: x = round number, y = player index (so players line up on their own row)
  const points = [];
  sorted.forEach((entry, playerIdx) => {
    entry.byeRounds.forEach(round => {
      points.push({ x: round, y: playerIdx });
    });
  });

  window.analyticsChartInstance = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Bye',
        data: points,
        backgroundColor: '#64748b',
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const playerName = labels[ctx.parsed.y] || 'Unnamed';
              return `${playerName} — Round ${ctx.parsed.x}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Round' },
          ticks: { stepSize: 1 }
        },
        y: {
          type: 'category',
          labels,
          title: { display: false },
          ticks: { autoSkip: false, font: { size: 10 } }
        }
      }
    }
  });
}