function calculatePlayerStats(playerId, matches) {
  let games = 0, wins = 0, losses = 0;
  let pointsFor = 0, pointsAgainst = 0, expPointsFor = 0, expPointsAgainst = 0;

  matches.forEach(m => {
    // Only count completed matches
    if (!m.Team1WinLoss || !m.Team2WinLoss) return;

    const onTeam1 = m.Team1Player1 === playerId || m.Team1Player2 === playerId;
    const onTeam2 = m.Team2Player1 === playerId || m.Team2Player2 === playerId;
    if (!onTeam1 && !onTeam2) return;

    games++;

    const myScore = onTeam1 ? parseFloat(m.Team1Score) || 0 : parseFloat(m.Team2Score) || 0;
    const oppScore = onTeam1 ? parseFloat(m.Team2Score) || 0 : parseFloat(m.Team1Score) || 0;
    const myExpScore = onTeam1 ? parseFloat(m.ExpectedTeam1Score) || 0 : parseFloat(m.ExpectedTeam2Score) || 0;
    const oppExpScore = onTeam1 ? parseFloat(m.ExpectedTeam2Score) || 0 : parseFloat(m.ExpectedTeam1Score) || 0;

    const myWinLoss = onTeam1 ? m.Team1WinLoss : m.Team2WinLoss;
    if (myWinLoss === 'Win') wins++;
    else if (myWinLoss === 'Loss') losses++;

    pointsFor += myScore;
    pointsAgainst += oppScore;
    expPointsFor += myExpScore;
    expPointsAgainst += oppExpScore;
  });

  return { games, wins, losses, pointsFor, pointsAgainst, expPointsFor, expPointsAgainst };
}

function calculateLadderPoints(stats, ladderScoringMode) {
  const { games, wins, pointsFor, pointsAgainst, expPointsFor, expPointsAgainst } = stats;

  if (ladderScoringMode === 'Wins') {
    if (games === 0) return 0;
    return Math.round((wins / games) * 100);
  }

  if (ladderScoringMode === 'Margin') {
    const totalPoints = pointsFor + pointsAgainst;
    if (totalPoints === 0) return 0;
    return Math.round((pointsFor / totalPoints) * 100);
  }

  if (ladderScoringMode === 'Overs') {
    const totalPoints = pointsFor + pointsAgainst;
    const totalExpPoints = expPointsFor + expPointsAgainst;
    const actualRatio = totalPoints === 0 ? 0 : pointsFor / totalPoints;
    const expectedRatio = totalExpPoints === 0 ? 0 : expPointsFor / totalExpPoints;
    return Math.round((actualRatio - expectedRatio) * 100);
  }

  return 0;
}

async function renderStandingsView(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  renderLadderScoringToggle(activeEvent);

  const currentDrawVersion = activeEvent.CurrentDrawVersion;
  const matches = window.cachedUserUniverse.draw && window.cachedUserUniverse.draw.length > 0
    ? window.cachedUserUniverse.draw
    : await window.fetchDrawFromFirestore(activeEventId, currentDrawVersion);
  window.cachedUserUniverse.draw = matches;

  const players = window.cachedUserUniverse.players && window.cachedUserUniverse.players.length > 0
    ? window.cachedUserUniverse.players
    : await window.fetchPlayersFromFirestore(activeEventId, activeEvent.CurrentPlayerVersion);
  window.cachedUserUniverse.players = players;

  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const standings = players.map(player => {
    const stats = calculatePlayerStats(player.PlayerID, matches);
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player, stats, points };
  });

  // Sort: points descending, tiebreaker seed ascending
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(a.player.Seed) || 999) - (parseFloat(b.player.Seed) || 999);
  });

  const container = document.getElementById('standings-list');
  if (!container) return;

  if (standings.length === 0) {
    container.innerHTML = `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`;
    return;
  }

  let html = '';
  standings.forEach((entry, index) => {
    const rank = index + 1;
    const iconAsset = ladderRankings[0]['rank-' + rank] || '🏅';
    const iconMarkup = `<img src="${iconAsset}" alt="Rank ${rank}" class="card-icon-images-small" loading="lazy">`;

    const contentHtml = `
      <h3>${entry.player.FirstName || 'Unnamed'} (Seed: ${entry.player.Seed || '?'})</h3>
      <p class="card-meta-line">Gm: ${entry.stats.games} || Wins: ${entry.stats.wins} || Loss: ${entry.stats.losses}</p>
    `;

    html += `
      <div class="app-card">
        <div class="card-icon-wrapper">
          ${iconMarkup}
        </div>
        <div class="card-content">
          ${contentHtml}
        </div>
        <div class="points-badge">${entry.points}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderLadderScoringToggle(activeEvent) {
  const block = document.getElementById('ladder-scoring-block');
  if (!block) return;

  const scoringMode = activeEvent.Scoring || 'Points';
  if (scoringMode !== 'Points') {
    block.style.display = 'none';
    return;
  }
  block.style.display = 'flex';

  const currentValue = activeEvent.LadderScoring || 'Margin';
  document.querySelectorAll('#ladder-scoring-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
  });
}

function setLadderScoringMode(newValue) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  activeEvent.LadderScoring = newValue;

  // Re-run the full standings render so points/order update immediately
  renderStandingsView(window.cachedUserUniverse);

  window.updateLadderScoringInFirestore(activeEventId, newValue)
    .then(() => console.log("LadderScoring updated in Firestore:", newValue))
    .catch(err => console.error("Failed to update LadderScoring:", err));
}
