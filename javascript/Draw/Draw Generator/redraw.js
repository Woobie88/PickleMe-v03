/**
 * ============================================================
 * REDRAW ENGINE
 * Reworks matchups/byes from a given start round onward, using
 * a fairness-based bye distribution (fewest-byes-so-far, stable
 * tiebreak) that's robust across any number of prior redraws
 * and roster changes. Does NOT touch Team/Division/Pool
 * assignments — those stay exactly as they are.
 * ============================================================
 */

// ---------- SCREEN: Redraw Details ----------

function renderRedrawScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('rw-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';

  const livesSupported = gameProfile?.Lives === 'Yes';
  const livesGroup = document.getElementById('rw-lives-group');
  if (livesSupported) {
    livesGroup.style.display = '';
    const livesValue = parseInt(activeEvent?.Lives) || 1;
    document.getElementById('rw-lives-value').innerText = livesValue;
    document.getElementById('rw-lives-hidden').value = livesValue;
  } else {
    livesGroup.style.display = 'none';
  }

  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));
  const anyExcluded = players.some(p => p.playerExclude === 'Yes');
  const computedDefault = anyExcluded ? 'No' : 'Yes';
  const currentValue = activeEvent.AllPlayersPresent || computedDefault;

  document.querySelectorAll('#rw-all-present-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
  });
  window.rwAllPlayersPresentValue = currentValue;

  const matches = window.cachedUserUniverse.draw || [];
  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))];
  const highestCompleteRound = allRounds.filter(r => isRoundComplete(matches, r)).reduce((max, r) => Math.max(max, r), 0);
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;
  const startRoundValue = Math.max(highestCompleteRound, currentRound) + 1;

  document.getElementById('rw-start-round-value').innerText = startRoundValue;
  document.getElementById('rw-start-round-hidden').value = startRoundValue;

  const btn = document.getElementById('rw-confirm-btn');
  if (btn) btn.innerText = window.rwAllPlayersPresentValue === 'Yes' ? 'Build Draw' : 'Next';
}

function adjustRwLives(direction) {
  const hiddenInput = document.getElementById('rw-lives-hidden');
  const displaySpan = document.getElementById('rw-lives-value');
  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustRwStartRound(direction) {
  const hiddenInput = document.getElementById('rw-start-round-hidden');
  const displaySpan = document.getElementById('rw-start-round-value');
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(window.cachedUserUniverse.activeEventId));
  const matches = window.cachedUserUniverse.draw || [];
  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))];
  const highestCompleteRound = allRounds.filter(r => isRoundComplete(matches, r)).reduce((max, r) => Math.max(max, r), 0);
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;
  const minStartRound = Math.max(highestCompleteRound, currentRound) + 1;

  let current = parseInt(hiddenInput.value) || minStartRound;
  current = Math.max(minStartRound, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

async function handleRwAllPlayersPresentToggle(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  document.querySelectorAll('#rw-all-present-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });

  window.rwAllPlayersPresentValue = value;
  activeEvent.AllPlayersPresent = value;
  await window.updateEventFieldInFirestore(activeEventId, 'AllPlayersPresent', value);

  const btn = document.getElementById('rw-confirm-btn');
  if (btn) btn.innerText = value === 'Yes' ? 'Build Draw' : 'Next';

  if (value === 'Yes') {
    const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
    const players = window.cachedUserUniverse.players.filter(
      p => String(p.PlayerVersion) === String(currentPlayerVersion) && p.playerExclude === 'Yes'
    );
    await Promise.all(players.map(p => {
      p.playerExclude = 'No';
      return window.updatePlayerExcludeInFirestore(p.PlayerID, 'No');
    }));
  }
}

function handleRedrawConfirm() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  const livesValue = parseInt(document.getElementById('rw-lives-hidden')?.value) || 1;
  const startRoundValue = parseInt(document.getElementById('rw-start-round-hidden').value) || 1;

  window.rwConfig = { startRound: startRoundValue };

  activeEvent.Lives = livesValue;
  window.updateEventFieldInFirestore(activeEventId, 'Lives', livesValue);

  if (window.rwAllPlayersPresentValue === 'Yes') {
    handleRedrawBuild();
  } else {
    navigateToScreen('redraw-available');
  }
}

// ---------- SCREEN: Redraw Availability ----------

function renderRedrawAvailabilityList(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  const container = document.getElementById('rw-availability-list');
  if (!container) return;

  container.innerHTML = players.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`
    : players.map(player => {
        const isUnavailable = player.playerExclude === 'Yes';
        const contentHtml = `
          <h3>${player.Name || 'Unnamed Player'}</h3>
          <p class="card-meta-line">${isUnavailable ? 'Unavailable' : (player.DUPRId || 'N/A') + (player.DUPR ? ' || DUPR ' + player.DUPR : '')}</p>
        `;
        const extraClass = isUnavailable ? 'player-unavailable' : '';
        return buildCardMarkup({ iconAsset: '🎾', contentHtml, cardId: player.PlayerID, extraClass });
      }).join('');

  enableRedrawAvailabilityLongPress();
}

function enableRedrawAvailabilityLongPress() {
  document.querySelectorAll('#rw-availability-list .app-card[data-card-id]').forEach(card => {
    let longPressTimer = null;

    card.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        togglePlayerExclude(card.dataset.cardId, renderRedrawAvailabilityList);
      }, 350);
    }, { passive: true });

    card.addEventListener('touchmove', () => {
      clearTimeout(longPressTimer);
    }, { passive: true });

    card.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
      window.suppressNextCardClick = true;
    });
  });
}

// ---------- FAIRNESS-BASED BYE ENGINE (robust across any number of prior redraws) ----------

function getAllPlayersInRound(matches, round) {
  const ids = new Set();
  matches.filter(m => parseInt(m.Round) === round).forEach(m => {
    [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4,
     m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4]
      .filter(Boolean).forEach(pid => ids.add(pid));
  });
  return [...ids];
}

/**
 * Counts each currently-active player's ACTUAL byes so far, correctly
 * ignoring rounds that happened BEFORE a player ever joined (so new
 * arrivals start at 0, not falsely inflated). Departed players are
 * ignored entirely since they're not in currentActivePlayers.
 */
function buildByeFairnessState(currentActivePlayers, allExistingMatches, startRound) {
  const activeIds = currentActivePlayers.map(p => p.PlayerID);
  const byeCounts = {};
  activeIds.forEach(id => byeCounts[id] = 0);
  const tiebreakOrder = [];

  const relevantRounds = [...new Set(allExistingMatches.map(m => parseInt(m.Round)))]
    .filter(r => r < startRound)
    .sort((a, b) => a - b);

  const everAppeared = new Set();
  relevantRounds.forEach(round => {
    getAllPlayersInRound(allExistingMatches, round).forEach(pid => everAppeared.add(pid));
  });

  relevantRounds.forEach(round => {
    const playingIds = new Set(getAllPlayersInRound(allExistingMatches, round));

    activeIds.forEach(pid => {
      if (everAppeared.has(pid) && !playingIds.has(pid)) {
        byeCounts[pid]++;
        if (!tiebreakOrder.includes(pid)) tiebreakOrder.push(pid);
      }
    });
  });

  activeIds.forEach(pid => { if (!tiebreakOrder.includes(pid)) tiebreakOrder.push(pid); });
  return { byeCounts, tiebreakOrder };
}

/**
 * Greedily assigns byes each round to whoever currently has the FEWEST
 * byes so far, tiebreaking by stable order. Self-correcting regardless
 * of how many redraws have happened or how neededPerRound has varied.
 */
function generateFairByeSchedule(activeIds, byeCounts, tiebreakOrder, numberOfRounds, neededPerRound, startRound) {
  const byesByRound = {};
  const counts = { ...byeCounts };

  for (let i = 0; i < numberOfRounds; i++) {
    const round = startRound + i;
    const sorted = [...activeIds].sort((a, b) => {
      if (counts[a] !== counts[b]) return counts[a] - counts[b];
      return tiebreakOrder.indexOf(a) - tiebreakOrder.indexOf(b);
    });
    const byes = sorted.slice(0, neededPerRound);
    byes.forEach(pid => counts[pid]++);
    byesByRound[round] = byes;
  }

  return byesByRound;
}

// ---------- MAIN ENTRY POINT ----------

async function handleRedrawBuild() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent.GameID;
  const drawVersion = activeEvent.CurrentDrawVersion; // unchanged — no version bump for redraw

  const startRound = window.rwConfig.startRound;

  const allPlayers = window.cachedUserUniverse.players;
  const players = allPlayers.filter(p => p.playerExclude !== 'Yes');
  const courtsCount = Math.min(parseInt(activeEvent.NumberofCourts) || 1, Math.floor(players.length / 4) || 1);
  const userEmail = window.currentUserEmail;

  const existingMatches = window.cachedUserUniverse.draw || [];
  const historyBeforeRedraw = existingMatches.filter(m => parseInt(m.Round) < startRound);

  const targetRounds = [...new Set(existingMatches.filter(m => parseInt(m.Round) >= startRound).map(m => parseInt(m.Round)))];
  const numberOfRounds = targetRounds.length;

  if (numberOfRounds === 0) {
    alert("No existing rounds found from this start round onward — nothing to redraw.");
    return;
  }

  let newMatches;

  if (gameId === 'doubles-pro' || gameId === 'rx-sports') {
    newMatches = generateDoublesProDraw(players, courtsCount, activeEventId, drawVersion, userEmail, numberOfRounds, startRound, historyBeforeRedraw);

  } else if (gameId === 'teams' || gameId === 'pool-fusion') {
    const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 2;
    let allMatches = [...historyBeforeRedraw];
    newMatches = [];
    for (let i = 0; i < numberOfRounds; i++) {
      const roundNumber = startRound + i;
      const roundMatches = generateTeamsRoundDraw(players, allMatches, roundNumber, courtsCount, activeEventId, drawVersion, userEmail, numberOfTeams);
      newMatches.push(...roundMatches);
      allMatches = [...allMatches, ...roundMatches];
    }

  } else {
    const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 1;
    const clusteredGames = ['divisions', 'ladder-scramble', 'pools'];
    const isClustered = clusteredGames.includes(gameId);

    let byesByRound;

    if (isClustered) {
      // Per-team fairness — apply the same robust engine to each team's own players/history independently
      const teams = {};
      players.forEach(p => { (teams[p.Team] = teams[p.Team] || []).push(p); });

      const courtsPerTeam = courtsCount / numberOfTeams;
      byesByRound = {};

      Object.keys(teams).forEach(teamKey => {
        const teamPlayers = teams[teamKey];
        const teamActiveIds = teamPlayers.map(p => p.PlayerID);
        const teamNeeded = Math.max(0, teamPlayers.length - courtsPerTeam * 4);

        const { byeCounts, tiebreakOrder } = buildByeFairnessState(teamPlayers, existingMatches, startRound);
        byesByRound[teamKey] = generateFairByeSchedule(teamActiveIds, byeCounts, tiebreakOrder, numberOfRounds, teamNeeded, startRound);
      });

      // Reshape to match generateByeScheduleByTeam's expected {teamKey: {0: [...], 1: [...]}} 0-indexed format
      Object.keys(byesByRound).forEach(teamKey => {
        const reindexed = {};
        Object.keys(byesByRound[teamKey]).forEach(roundNum => {
          reindexed[parseInt(roundNum) - startRound] = byesByRound[teamKey][roundNum];
        });
        byesByRound[teamKey] = reindexed;
      });

    } else {
      const activeIds = players.map(p => p.PlayerID);
      const neededPerRound = Math.max(0, players.length - courtsCount * 4);
      const { byeCounts, tiebreakOrder } = buildByeFairnessState(players, existingMatches, startRound);
      byesByRound = generateFairByeSchedule(activeIds, byeCounts, tiebreakOrder, numberOfRounds, neededPerRound, startRound);
    }

    newMatches = generateMultipleRounds(
      players, historyBeforeRedraw, byesByRound, startRound, numberOfRounds, courtsCount,
      activeEventId, drawVersion, gameId, numberOfTeams, userEmail
    );
  }

  const staleMatches = existingMatches.filter(m => targetRounds.includes(parseInt(m.Round)));

  try {
    await Promise.all(staleMatches.map(m => window.deleteMatchInFirestore(m.MatchID)));
    await window.saveGeneratedDrawToFirestore(newMatches);

    window.cachedUserUniverse.draw = [
      ...existingMatches.filter(m => !targetRounds.includes(parseInt(m.Round))),
      ...newMatches
    ];

    activeEvent.CurrentRound = startRound;
    await window.updateEventFieldInFirestore(activeEventId, 'CurrentRound', startRound);
    window.currentRoundNumber = startRound;

    console.log(`Redraw complete — ${staleMatches.length} old match(es) removed, ${newMatches.length} new match(es) saved for rounds ${startRound}-${startRound + numberOfRounds - 1}.`);
    alert("Redraw complete.");
    navigateToScreen('draw');
  } catch (err) {
    console.error("Redraw failed:", err);
    alert("Redraw failed — check the console for details.");
  }
}