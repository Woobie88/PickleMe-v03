/**
 * ============================================================
 * ADD MATCH
 * Manually builds match(es) for a specific round — creates new
 * documents if that round has no matches yet, or replaces the
 * entire round's matches if it already does (for anything less
 * than a full round rebuild, use Player Substitution instead).
 * ============================================================
 */

window.amConfig = { round: 1, totalCourts: 1, courtIndex: 0, selectionsPerCourt: [] };
window.amCurrentSelection = [];

// ---------- SCREEN: Round Selection ----------

function renderAddMatchRoundScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];

  const roundsWithScores = [...new Set(matches.filter(m => m.Team1WinLoss && m.Team2WinLoss).map(m => parseInt(m.Round)))];
  const lastRoundWithScore = roundsWithScores.reduce((max, r) => Math.max(max, r), 0);
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;

  const defaultRound = Math.max(currentRound, lastRoundWithScore + 1);

  document.getElementById('am-round-value').innerText = defaultRound;
  document.getElementById('am-round-hidden').value = defaultRound;
}

function adjustAmRound(direction) {
  const hiddenInput = document.getElementById('am-round-hidden');
  const displaySpan = document.getElementById('am-round-value');
  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function handleAddMatchRoundNext() {
  const round = parseInt(document.getElementById('am-round-hidden').value) || 1;

  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(window.cachedUserUniverse.activeEventId));
  const players = window.cachedUserUniverse.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );
  const totalCourts = Math.min(parseInt(activeEvent.NumberofCourts) || 1, Math.floor(players.length / 4) || 1);

  window.amConfig = { round, totalCourts, courtIndex: 0, selectionsPerCourt: [] };

  navigateToScreen('add-match-players');
}

// ---------- SCREEN: Player Selection (repeats once per court) ----------

function renderAddMatchPlayersScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const allActivePlayers = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  const standings = allActivePlayers.map(p => {
    const stats = calculatePlayerStats(p.PlayerID, matches);
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player: p, points };
  });
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0);
  });

  const rankByPlayerId = {};
  standings.forEach((entry, idx) => { rankByPlayerId[entry.player.PlayerID] = idx + 1; });

  const alreadySelectedIds = window.amConfig.selectionsPerCourt.flat().map(p => p.PlayerID);
  const availablePlayers = standings.filter(entry => !alreadySelectedIds.includes(entry.player.PlayerID));

  document.getElementById('am-players-heading').innerText = `Select Players — Court ${window.amConfig.courtIndex + 1}`;

  window.amCurrentSelection = [];

  const container = document.getElementById('am-players-list');
  container.innerHTML = availablePlayers.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players Available</h3></div>`
    : availablePlayers.map(entry => {
        const rank = rankByPlayerId[entry.player.PlayerID];
        const iconAsset = ladderRankings[0]['rank-' + rank] || '🏅';
        const contentHtml = `
          <h3>${entry.player.FirstName || 'Unnamed'} (DUPR: ${entry.player.DUPR || 'N/A'})</h3>
          <p class="card-meta-line">Rank ${rank} || ${entry.points} pts</p>
        `;
        return `
          <div class="app-card" data-card-id="${entry.player.PlayerID}">
            <div class="card-icon-wrapper"><img src="${iconAsset}" alt="Rank ${rank}" class="card-icon-images" loading="lazy"></div>
            <div class="card-content">${contentHtml}</div>
          </div>
        `;
      }).join('');

  enableAddMatchLongPress();
  updateAddMatchNextButton();
}

function enableAddMatchLongPress() {
  document.querySelectorAll('#am-players-list .app-card[data-card-id]').forEach(card => {
    let longPressTimer = null;

    card.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        toggleAmPlayerSelection(card);
      }, 350);
    }, { passive: true });

    card.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
    card.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
      window.suppressNextCardClick = true;
    });
  });
}

function toggleAmPlayerSelection(card) {
  const playerId = card.dataset.cardId;
  const idx = window.amCurrentSelection.indexOf(playerId);

  if (idx !== -1) {
    window.amCurrentSelection.splice(idx, 1);
  } else {
    if (window.amCurrentSelection.length >= 4) return;
    window.amCurrentSelection.push(playerId);
  }

  document.querySelectorAll('#am-players-list .app-card').forEach(c => {
    c.classList.remove('am-pair-1', 'am-pair-2');
  });
  window.amCurrentSelection.forEach((pid, i) => {
    const cardEl = document.querySelector(`#am-players-list .app-card[data-card-id="${pid}"]`);
    if (cardEl) cardEl.classList.add(i < 2 ? 'am-pair-1' : 'am-pair-2');
  });

  updateAddMatchNextButton();
}

function updateAddMatchNextButton() {
  const btn = document.getElementById('am-players-next-btn');
  const isLastCourt = window.amConfig.courtIndex === window.amConfig.totalCourts - 1;
  const readyToProceed = window.amCurrentSelection.length === 4;

  btn.disabled = !readyToProceed;
  btn.innerText = isLastCourt ? 'Add Match' : 'Next';
}

function handleAddMatchPlayersNext() {
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(window.cachedUserUniverse.activeEventId));
  const allPlayers = window.cachedUserUniverse.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion)
  );

  const selectedPlayers = window.amCurrentSelection.map(pid => allPlayers.find(p => p.PlayerID === pid));
  window.amConfig.selectionsPerCourt.push(selectedPlayers);

  const isLastCourt = window.amConfig.courtIndex === window.amConfig.totalCourts - 1;

  if (isLastCourt) {
    commitAddMatch();
  } else {
    window.amConfig.courtIndex++;
    renderAddMatchPlayersScreen(window.cachedUserUniverse);
  }
}

// ---------- COMMIT: create or replace the round's matches ----------

async function commitAddMatch() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const round = window.amConfig.round;
  const userEmail = window.currentUserEmail;

  const newMatches = window.amConfig.selectionsPerCourt.map((fourPlayers, idx) => {
    const teamA = [fourPlayers[0], fourPlayers[1]];
    const teamB = [fourPlayers[2], fourPlayers[3]];
    const courtNumber = idx + 1;

    return buildMatchRecord({ teamA, teamB, court: courtNumber }, idx, round, activeEventId, activeEvent.CurrentDrawVersion, userEmail);
  });

  const existingMatches = window.cachedUserUniverse.draw || [];
  const staleMatches = existingMatches.filter(m => parseInt(m.Round) === round);

  try {
    await Promise.all(staleMatches.map(m => window.deleteMatchInFirestore(m.MatchID)));
    await window.saveGeneratedDrawToFirestore(newMatches);

    window.cachedUserUniverse.draw = [
      ...existingMatches.filter(m => parseInt(m.Round) !== round),
      ...newMatches
    ];

    console.log(`Add Match complete — Round ${round}: ${staleMatches.length} old match(es) replaced with ${newMatches.length} new match(es).`);
    alert("Match(es) added successfully.");
    navigateToScreen('draw');
  } catch (err) {
    console.error("Add Match failed:", err);
    alert("Add Match failed — check the console for details.");
  }
}