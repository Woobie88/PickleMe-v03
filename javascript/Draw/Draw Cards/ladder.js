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
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
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

  // --- Event-level player ranking (UNCHANGED — always computed flat, across everyone) ---
  const standings = players.map(player => {
    const stats = calculatePlayerStats(player.PlayerID, matches);
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player, stats, points };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0);
  });

  const rankByPlayerId = {};
  standings.forEach((entry, index) => {
    rankByPlayerId[entry.player.PlayerID] = index + 1;
  });

  const container = document.getElementById('standings-list');
  if (!container) return;

  if (standings.length === 0) {
    container.innerHTML = `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`;
    return;
  }

  function buildPlayerLadderCard(entry) {
    const rank = rankByPlayerId[entry.player.PlayerID];
    const iconAsset = ladderRankings[0]['rank-' + rank] || '🏅';
    const iconMarkup = `<img src="${iconAsset}" alt="Rank ${rank}" class="card-icon-images" loading="lazy">`;

    const contentHtml = `
      <h3>${entry.player.FirstName || 'Unnamed'} (DUPR: ${entry.player.DUPR || 'N/A'})</h3>
      <p class="card-meta-line">Game:  ${entry.stats.games} || Win: ${entry.stats.wins} || Loss: ${entry.stats.losses}</p>
    `;

    return `
      <div class="app-card">
        <div class="card-icon-wrapper">${iconMarkup}</div>
        <div class="card-content">${contentHtml}</div>
        <div class="points-badge">${entry.points}</div>
      </div>
    `;
  }

  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent.GameID);
  const grouping = gameProfile?.Grouping || 'None';

  let html = '';

  if (grouping === 'None') {
    // Unchanged — flat list, sorted by rank
    standings.forEach(entry => { html += buildPlayerLadderCard(entry); });

  } else if (grouping === 'Divisions' || grouping === 'Pools') {
    const label = grouping === 'Divisions' ? 'Division' : 'Pool';
    const numberOfGroups = parseInt(activeEvent.NumberOfTeams) || 1;

    for (let g = 1; g <= numberOfGroups; g++) {
      const groupEntries = standings.filter(entry => String(entry.player.Team) === String(g));
      if (groupEntries.length === 0) continue;

      html += `<div class="event-section-title current">${label} ${g}</div>`;
      groupEntries.forEach(entry => { html += buildPlayerLadderCard(entry); });
    }

  } else if (grouping === 'Teams' || grouping === 'Pairs') {
    const label = grouping === 'Teams' ? 'Team' : 'Pair';
    const numberOfGroups = grouping === 'Pairs'
      ? Math.ceil(players.length / 2)
      : (parseInt(activeEvent.NumberOfTeams) || 1);

    for (let g = 1; g <= numberOfGroups; g++) {
      const groupEntries = standings.filter(entry => String(entry.player.Team) === String(g));
      if (groupEntries.length === 0) continue;

      const teamStats = calculateTeamStats(g, matches);
      const teamScore = calculateLadderPoints(teamStats, ladderScoringMode);

      html += `
        <div class="event-section-title current" style="display: flex; justify-content: space-between; align-items: center;">
          <span>${label} ${g}</span>
          <span class="points-badge" style="min-width: 36px; height: 36px; font-size: 0.85rem;">${teamScore}</span>
        </div>
      `;
      groupEntries.forEach(entry => { html += buildPlayerLadderCard(entry); });
    }
  }

  container.innerHTML = html;
}

function renderLadderScoringToggle(activeEvent) {
  const block = document.getElementById('ladder-scoring-block');
  if (!block) return;

  const scoringMode = activeEvent.Scoring || 'Points';
  if (scoringMode !== 'Points' && scoringMode !== 'Wins') {
    block.style.display = 'none';
    return;
  }
  block.style.display = 'flex';

  // If the event's actual scoring is Wins, LadderScoring MUST be Wins too — no other mode makes sense
  const forcedValue = scoringMode === 'Wins' ? 'Wins' : null;
  const currentValue = forcedValue || activeEvent.LadderScoring || 'Margin';

  document.querySelectorAll('#ladder-scoring-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
    btn.disabled = !!forcedValue; // lock all buttons when forced
    btn.style.opacity = forcedValue ? '0.4' : '1';
  });

  // If the stored value doesn't match what's forced, correct it in Firestore
  if (forcedValue && activeEvent.LadderScoring !== forcedValue) {
    activeEvent.LadderScoring = forcedValue;
    window.updateLadderScoringInFirestore(activeEvent.EventID, forcedValue);
  }
}

function setLadderScoringMode(newValue) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  // Hard guard — Wins-mode events can never set LadderScoring to anything else
  if (activeEvent.Scoring === 'Wins' && newValue !== 'Wins') {
    console.warn('LadderScoring is locked to Wins because event Scoring is Wins.');
    return;
  }

  activeEvent.LadderScoring = newValue;
  renderStandingsView(window.cachedUserUniverse);

  window.updateLadderScoringInFirestore(activeEventId, newValue)
    .then(() => console.log("LadderScoring updated in Firestore:", newValue))
    .catch(err => console.error("Failed to update LadderScoring:", err));
}

/**
 * Computes the same shape of stats as calculatePlayerStats, but at the
 * TEAM level, using each match's Team1/Team2 fields (already populated
 * by both the standard clustered engine and Doubles Pro).
 */
function calculateTeamStats(teamNumber, matches) {
  let games = 0, wins = 0, losses = 0;
  let pointsFor = 0, pointsAgainst = 0, expPointsFor = 0, expPointsAgainst = 0;

  matches.forEach(m => {
    if (!m.Team1WinLoss || !m.Team2WinLoss) return; // only completed matches

    const onTeam1 = String(m.Team1) === String(teamNumber);
    const onTeam2 = String(m.Team2) === String(teamNumber);
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
