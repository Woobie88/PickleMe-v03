window.analyticsChartInstance = null;
window.analyticsScreenIndex = 0; // 0=unique, 1=max, 2=draw quality (DUPR gap), 3=court frequency, 4=byes, 5=wins/losses, 6=points
window.analyticsRawData = [];

// ---------- DUPR GAP CLASSIFICATION (Draw Quality) ----------
// NEW — shared bucket definitions so compute + render + tooltip all agree on
// the same boundaries, labels, and colors. Boundaries follow the same
// competitiveness bands used to reason about the draw generator's deltas:
// ~0.2 = coin-flip, ~0.4 = competitive, ~0.8 = favors stronger side, above = lopsided.
const DUPR_GAP_BUCKETS = [
  { key: 'coinflip',    max: 0.2,      label: 'Coin-flip (≤0.2)',            color: '#00E676' },
  { key: 'competitive', max: 0.4,      label: 'Competitive (0.2–0.4)',       color: '#3b82f6' },
  { key: 'favors',      max: 0.8,      label: 'Favors stronger side (0.4–0.8)', color: '#f59e0b' },
  { key: 'lopsided',    max: Infinity, label: 'Lopsided (0.8+)',             color: '#ef4444' }
];

function classifyDuprGap(gap) {
  return DUPR_GAP_BUCKETS.find(b => gap <= b.max) || DUPR_GAP_BUCKETS[DUPR_GAP_BUCKETS.length - 1];
}

function initGapBuckets() {
  const obj = {};
  DUPR_GAP_BUCKETS.forEach(b => { obj[b.key] = { count: 0, rounds: [] }; });
  return obj;
}

function teamAvgDuprFromIds(ids, playersById) {
  const vals = ids.map(pid => parseFloat(playersById[pid]?.DUPR) || 0);
  return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
}

function computeAnalyticsPlayerCounts(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  const playersById = {}; // NEW — lookup for DUPR values when classifying gaps
  payload.players.forEach(p => { playersById[p.PlayerID] = p; });

  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))].sort((a, b) => a - b);

  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent.GameID);
  const isProgressive = gameProfile?.GamesGroup === 'Progressive';
  const currentRound = parseInt(activeEvent.CurrentRound) || 1;

  return players.map(player => {
    const partnerCounts = {};
    const opponentCounts = {};
    const partnerRounds = {};
    const opponentRounds = {};
    const roundResults = {};
    const roundPoints = {};
    const roundsPlayed = new Set();
    const courtCounts = {}; // { courtNumber: count }
    const courtDetails = {}; // { courtNumber: [{ round, partnerName }, ...] }
    const partnerGapBuckets = initGapBuckets(); // NEW
    const opponentGapBuckets = initGapBuckets(); // NEW
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

      roundsPlayed.add(round);

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

      const isDummyRound = isProgressive && round > currentRound;
      if (isDummyRound) return;

      myTeam.forEach(pid => {
        if (pid !== player.PlayerID) {
          partnerCounts[pid] = (partnerCounts[pid] || 0) + 1;
          if (!partnerRounds[pid]) partnerRounds[pid] = [];
          partnerRounds[pid].push(round);
        }
      });
      oppTeam.forEach(pid => {
        opponentCounts[pid] = (opponentCounts[pid] || 0) + 1;
        if (!opponentRounds[pid]) opponentRounds[pid] = [];
        opponentRounds[pid].push(round);
      });

      // court frequency tracking, same dummy-round exclusion as partner/opponent
      const court = parseInt(m.Court) || 0;
      const partnerId = myTeam.find(pid => pid !== player.PlayerID);
      const partnerName = partnerId ? getPlayerNameById(partnerId) : 'Bye';

      courtCounts[court] = (courtCounts[court] || 0) + 1;
      if (!courtDetails[court]) courtDetails[court] = [];
      courtDetails[court].push({ round, partnerName });

      // NEW — DUPR gap classification for draw-quality analysis.
      // Partner gap: individual-to-individual, same basis as the draw
      // generator's partnerDuprGapWeight. Opponent gap: team-average-to-
      // team-average, same basis as opponentDuprGapWeight.
      if (partnerId) {
        const myDupr = parseFloat(player.DUPR) || 0;
        const partnerDupr = parseFloat(playersById[partnerId]?.DUPR) || 0;
        const partnerBucket = classifyDuprGap(Math.abs(myDupr - partnerDupr));
        partnerGapBuckets[partnerBucket.key].count++;
        partnerGapBuckets[partnerBucket.key].rounds.push(round);
      }

      const myTeamDupr = teamAvgDuprFromIds(myTeam, playersById);
      const oppTeamDupr = teamAvgDuprFromIds(oppTeam, playersById);
      const opponentBucket = classifyDuprGap(Math.abs(myTeamDupr - oppTeamDupr));
      opponentGapBuckets[opponentBucket.key].count++;
      opponentGapBuckets[opponentBucket.key].rounds.push(round);
    });

    const byeRounds = allRounds.filter(r => !roundsPlayed.has(r));

    return {
      player,
      uniquePartners: Object.keys(partnerCounts).length,
      uniqueOpponents: Object.keys(opponentCounts).length,
      maxSamePartner: Math.max(0, ...Object.values(partnerCounts)),
      maxSameOpponent: Math.max(0, ...Object.values(opponentCounts)),
      wins, losses, pointsFor, pointsAgainst,
      partnerCounts,
      opponentCounts,
      partnerRounds,
      opponentRounds,
      roundResults,
      roundPoints,
      roundsPlayed,
      byeRounds,
      courtCounts,
      courtDetails,
      partnerGapBuckets, // NEW
      opponentGapBuckets // NEW
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
    window.analyticsChartInstance = null;
  }

  if (sorted.length === 0) {
    console.log("Analytics: no players/matches to chart yet.");
    return;
  }

  let datasets, heading;
  const isQualityScreen = window.analyticsScreenIndex === 2; // NEW

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
  } else if (window.analyticsScreenIndex === 2) { // NEW — Draw Quality: DUPR Gap Distribution
    heading = 'DUPR Gap Analysis';
    datasets = [];

    // Partner stack — solid bucket colors
    DUPR_GAP_BUCKETS.forEach(b => {
      datasets.push({
        label: `Partners: ${b.label}`,
        data: sorted.map(d => d.partnerGapBuckets[b.key].count),
        backgroundColor: b.color,
        stack: 'partners',
        bucketKey: b.key,
        metricType: 'partner'
      });
    });

    // Opponent stack — same bucket colors at reduced opacity, so the two
    // stacks read as a matched pair per player while staying visually distinct
    DUPR_GAP_BUCKETS.forEach(b => {
      datasets.push({
        label: `Opponents: ${b.label}`,
        data: sorted.map(d => d.opponentGapBuckets[b.key].count),
        backgroundColor: `${b.color}99`,
        stack: 'opponents',
        bucketKey: b.key,
        metricType: 'opponent'
      });
    });
  } else if (window.analyticsScreenIndex === 3) { // CHANGED — was 2, shifted for new Draw Quality screen
    heading = 'Court Frequency';
    const allCourts = [...new Set(sorted.flatMap(d => Object.keys(d.courtCounts).map(Number)))].sort((a, b) => a - b);
    const courtColors = ['#00E676', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa', '#ec4899', '#06b6d4', '#84cc16'];

    datasets = allCourts.map((court, idx) => ({
      label: `Court ${court}`,
      data: sorted.map(d => d.courtCounts[court] || 0),
      backgroundColor: courtColors[idx % courtColors.length]
    }));
  } else if (window.analyticsScreenIndex === 4) { // CHANGED — was 3
    heading = 'Byes';
    datasets = [
      { label: 'Games Played', data: sorted.map(d => d.roundsPlayed.size), backgroundColor: '#3b82f6' },
      { label: 'Byes', data: sorted.map(d => d.byeRounds.length), backgroundColor: '#facc15' }
    ];
  } else if (window.analyticsScreenIndex === 5) { // CHANGED — was 4
    heading = 'Game Wins & Losses';
    datasets = [
      { label: 'Wins', data: sorted.map(d => d.wins), backgroundColor: '#00E676' },
      { label: 'Losses', data: sorted.map(d => d.losses), backgroundColor: '#ef4444' }
    ];
  } else if (window.analyticsScreenIndex === 6) { // CHANGED — was 5
    heading = 'Game Points For & Against';
    datasets = [
      { label: 'Points For', data: sorted.map(d => d.pointsFor), backgroundColor: '#00E676' },
      { label: 'Points Against', data: sorted.map(d => d.pointsAgainst), backgroundColor: '#ef4444' }
    ];
  }

  document.getElementById('analytics-heading').innerText = heading;

  // CHANGED — canvas-drawn legend text was rendering near-black regardless of
  // the configured color (confirmed via pixel inspection: config said #f8fafc,
  // actual drawn pixels were near-black), so the built-in legend is hidden for
  // this screen and replaced with a real HTML legend below, which has no such
  // dependency on Chart.js's internal text-color handling.
  const legendConfig = isQualityScreen
    ? { display: false }
    : { display: true, position: 'top' };

  window.analyticsChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: legendConfig,
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

              } else if (window.analyticsScreenIndex === 2) { // NEW — Draw Quality tooltip: round numbers in this gap bucket
                const bucketKey = ctx.dataset.bucketKey;
                const metricType = ctx.dataset.metricType;
                const buckets = metricType === 'partner' ? entry.partnerGapBuckets : entry.opponentGapBuckets;
                const rounds = (buckets[bucketKey]?.rounds || []).slice().sort((a, b) => a - b);
                return rounds.length > 0 ? rounds.map(r => `Round ${r}`) : ['No matches in this range'];

              } else if (window.analyticsScreenIndex === 3) { // CHANGED — was 2
                const court = parseInt(ctx.dataset.label.replace('Court ', ''));
                const details = entry.courtDetails[court] || [];
                if (details.length === 0) return ['No games on this court'];
                return details
                  .sort((a, b) => a.round - b.round)
                  .map(d => `Round ${d.round}: with ${d.partnerName}`);

              } else if (window.analyticsScreenIndex === 4) { // CHANGED — was 3
                if (isFirstDataset) {
                  const rounds = [...entry.roundsPlayed].sort((a, b) => a - b);
                  return rounds.length > 0 ? rounds.map(r => `Round ${r}`) : ['No games yet'];
                } else {
                  return entry.byeRounds.length > 0
                    ? entry.byeRounds.map(r => `Round ${r}`)
                    : ['No byes'];
                }
              } else if (window.analyticsScreenIndex === 5) { // CHANGED — was 4
                const rounds = Object.keys(entry.roundResults).map(Number).sort((a, b) => a - b);
                const lines = rounds.map(r => `Round ${r}: ${entry.roundResults[r]}`);
                return lines.length > 0 ? lines : ['No results yet'];

              } else if (window.analyticsScreenIndex === 6) { // CHANGED — was 5
                const rounds = Object.keys(entry.roundPoints).map(Number).sort((a, b) => a - b);
                const lines = rounds.map(r => `Round ${r}: ${entry.roundPoints[r].for} - ${entry.roundPoints[r].against}`);
                return lines.length > 0 ? lines : ['No scores yet'];
              }

              return `${ctx.dataset.label}: ${ctx.parsed.x}`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          stacked: isQualityScreen // NEW
        }
        // y-axis intentionally left unstacked — it's the category (player) axis
        // here, and marking it stacked caused the Partners/Opponents bars to
        // overlap instead of rendering as two separate grouped bars per player
      }
    }
  });

  // NEW — HTML legend for the Draw Quality screen, replacing the canvas-drawn
  // one whose text color wasn't rendering correctly
  if (isQualityScreen) {
    renderQualityLegendHTML(window.analyticsChartInstance);
  } else {
    hideQualityLegendHTML();
  }
}

// ---------- HTML LEGEND (Draw Quality screen) ----------
// NEW — plain DOM legend, styled with real CSS instead of canvas-drawn text,
// so it always matches --text-main with no dependency on Chart.js internals.

function renderQualityLegendHTML(chart) {
  const canvas = document.getElementById('analytics-chart-canvas');
  if (!canvas) return;

  let legendEl = document.getElementById('analytics-quality-legend');
  if (!legendEl) {
    legendEl = document.createElement('div');
    legendEl.id = 'analytics-quality-legend';
    legendEl.style.display = 'flex';
    legendEl.style.flexWrap = 'wrap';
    legendEl.style.gap = '10px 16px';
    legendEl.style.marginBottom = '10px';
    legendEl.style.fontSize = '0.8rem';
    canvas.parentNode.insertBefore(legendEl, canvas);
  }

  legendEl.innerHTML = '';
  window.qualityBucketHidden = window.qualityBucketHidden || {};

  DUPR_GAP_BUCKETS.forEach(b => {
    const isHidden = !!window.qualityBucketHidden[b.key];

    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '6px';
    item.style.cursor = 'pointer';
    item.style.color = 'var(--text-main)';
    item.style.opacity = isHidden ? '0.4' : '1';
    item.style.userSelect = 'none';

    const swatch = document.createElement('span');
    swatch.style.display = 'inline-block';
    swatch.style.width = '12px';
    swatch.style.height = '12px';
    swatch.style.borderRadius = '3px';
    swatch.style.backgroundColor = b.color;
    swatch.style.flexShrink = '0';

    const label = document.createElement('span');
    label.textContent = b.label;

    item.appendChild(swatch);
    item.appendChild(label);

    item.addEventListener('click', () => {
      window.qualityBucketHidden[b.key] = !window.qualityBucketHidden[b.key];
      chart.data.datasets.forEach((ds, idx) => {
        if (ds.bucketKey === b.key) {
          if (window.qualityBucketHidden[b.key]) chart.hide(idx); else chart.show(idx);
        }
      });
      chart.update();
      renderQualityLegendHTML(chart); // refresh dimmed/active styling
    });

    legendEl.appendChild(item);
  });

  legendEl.style.display = 'flex';
}

function hideQualityLegendHTML() {
  const legendEl = document.getElementById('analytics-quality-legend');
  if (legendEl) legendEl.style.display = 'none';
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

    if (deltaX < 0 && window.analyticsScreenIndex < 6) { // CHANGED — was < 5, now 7 screens (0-6)
      window.analyticsScreenIndex++;
      renderAnalyticsCards(window.cachedUserUniverse);
    } else if (deltaX > 0 && window.analyticsScreenIndex > 0) {
      window.analyticsScreenIndex--;
      renderAnalyticsCards(window.cachedUserUniverse);
    }
  });
}
