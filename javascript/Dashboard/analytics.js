window.analyticsChartInstance = null;
window.analyticsScreenIndex = 0; // 0 = unique counts, 1 = max repeat counts

function computeAnalyticsPlayerCounts(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  return players.map(player => {
    const partnerCounts = {};
    const opponentCounts = {};
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

      // Count wins and points for
      if (onT1) {
        if (m.Team1WinLoss === 'Win') {
            wins++;
        }
        else if (m.Team1WinLoss === 'Loss') {
             losses++;
        }
        pointsFor += Number(m.Team1Score) || 0;
        pointsAgainst += Number(m.Team2Score) || 0;
      }
      
      if (onT2) {
        if (m.Team2WinLoss === 'Win') {
            wins++;
        }
        else if (m.Team2WinLoss === 'Loss') {
             losses++;
        }
        pointsFor += Number(m.Team2Score) || 0;
        pointsAgainst += Number(m.Team1Score) || 0;
      }

      myTeam.forEach(pid => {
        if (pid !== player.PlayerID) partnerCounts[pid] = (partnerCounts[pid] || 0) + 1;
      });
      oppTeam.forEach(pid => {
        opponentCounts[pid] = (opponentCounts[pid] || 0) + 1;
      });
    });

    return {
      player,
      uniquePartners: Object.keys(partnerCounts).length,
      uniqueOpponents: Object.keys(opponentCounts).length,
      maxSamePartner: Math.max(0, ...Object.values(partnerCounts)),
      maxSameOpponent: Math.max(0, ...Object.values(opponentCounts)),
      wins: wins,
      losses: losses,
      pointsFor: pointsFor,
      pointsAgainst: pointsAgainst

    };
  });
}

function renderAnalyticsCards(payload) {
  const data = computeAnalyticsPlayerCounts(payload);
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
        { label: 'Unique Partners', data: sorted.map(d => d.uniquePartners), backgroundColor: '#00E676' }, // green — more variety is good
        { label: 'Unique Opponents', data: sorted.map(d => d.uniqueOpponents), backgroundColor: '#3b82f6' }  // blue — neutral counterpart
    ];
    } else if (window.analyticsScreenIndex === 1) {
    heading = 'Max Same Partner & Opponent';
    datasets = [
        { label: 'Max Partner', data: sorted.map(d => d.maxSamePartner), backgroundColor: '#f59e0b' }, // amber — repeats are a caution signal
        { label: 'Max Opponent', data: sorted.map(d => d.maxSameOpponent), backgroundColor: '#ef4444' }  // red — repeats you'd want to minimize most
    ];
    } else if (window.analyticsScreenIndex === 2) {
    heading = 'Game Wins & Losses';
    datasets = [
        { label: 'Wins', data: sorted.map(d => d.wins), backgroundColor: '#00E676' }, // CHANGED — green, matches your app's "good outcome" color everywhere else
        { label: 'Losses', data: sorted.map(d => d.losses), backgroundColor: '#ef4444' }  // CHANGED — red, matches your app's "bad/warning" color everywhere else
    ];
    } else if (window.analyticsScreenIndex === 3) {
    heading = 'Game Points For & Against';
    datasets = [
        { label: 'Points For', data: sorted.map(d => d.pointsFor), backgroundColor: '#00E676' }, // CHANGED — green, "for" is the positive number
        { label: 'Points Against', data: sorted.map(d => d.pointsAgainst), backgroundColor: '#ef4444' }  // CHANGED — red, "against" is the number you want lower
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

    if (deltaX < 0 && window.analyticsScreenIndex < 3) {
      window.analyticsScreenIndex++;
      renderAnalyticsCards(window.cachedUserUniverse);
    } else if (deltaX > 0 && window.analyticsScreenIndex > 0) {
      window.analyticsScreenIndex--;
      renderAnalyticsCards(window.cachedUserUniverse);
    }
  });
}