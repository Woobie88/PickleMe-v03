// Render function — populates fields, gates Promote/Relegate to Ladder Scramble only
function renderPairingMethodScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('pm-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';

  // --- Pairing Method toggle (mirrors Generate Draw) ---
  const partnerAllocationMethod = activeEvent.PairingMethod;

  document.querySelectorAll('#pairing-method-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === partnerAllocationMethod);
  });
  window.pmPairingMethodValue = partnerAllocationMethod;

  // --- Smarter default for Pairing Method Starts From Round ---
  const matches = window.cachedUserUniverse.draw || [];
  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))];
  const highestCompleteRound = allRounds.filter(r => isRoundComplete(matches, r)).reduce((max, r) => Math.max(max, r), 0);
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;
  const startRoundValue = Math.max(highestCompleteRound, currentRound) + 1; // CHANGED — added +1

  document.getElementById('pm-start-round-value').innerText = startRoundValue;
  document.getElementById('pm-start-round-hidden').value = startRoundValue;
}


async function handleRedivisionConfirm() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  const roundsValue = parseInt(document.getElementById('rd-rounds-hidden').value) || 1;
  const livesValue = parseInt(document.getElementById('rd-lives-hidden').value) || 1;
  const startRoundValue = parseInt(document.getElementById('rd-start-round-hidden').value) || 1;
  const promoteValue = parseInt(document.getElementById('rd-promote-hidden')?.value) || 2;

  window.rdConfig = {
    numberOfRounds: roundsValue,
    startRound: startRoundValue,
    promoteCount: promoteValue
  };

  activeEvent.NumberofRound = roundsValue;
  activeEvent.Lives = livesValue;
  activeEvent.RedivisionStartRound = startRoundValue;
  activeEvent.RedivisionPromoteCount = promoteValue;

  await Promise.all([
    window.updateEventFieldInFirestore(activeEventId, 'NumberofRound', roundsValue),
    window.updateEventFieldInFirestore(activeEventId, 'Lives', livesValue),
    window.updateEventFieldInFirestore(activeEventId, 'RedivisionStartRound', startRoundValue),
    window.updateEventFieldInFirestore(activeEventId, 'RedivisionPromoteCount', promoteValue)
  ]);

  navigateToScreen('redivision-teams');
}

async function handlePairingMethodToggle(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  document.querySelectorAll('#pairing-method-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });

  window.rdAllPlayersPresentValue = value;
  activeEvent.AllPlayersPresent = value;
  await window.updateEventFieldInFirestore(activeEventId, 'AllPlayersPresent', value);

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

function renderRedivisionAvailabilityList(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  const duprSorted = [...players].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const container = document.getElementById('rd-availability-list');
  if (!container) return;

  container.innerHTML = duprSorted.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`
    : duprSorted.map((player, idx) => {
        const isUnavailable = player.playerExclude === 'Yes';
        const seedNumber = idx + 1; // CHANGED
        const seedUrl = playerSeeds[0]['seed-' + seedNumber]; // CHANGED
        const iconAsset = seedUrl || '🎾'; // CHANGED

        const contentHtml = `
          <h3>${player.Name || 'Unnamed Player'}</h3>
          <p class="card-meta-line">${isUnavailable ? 'Unavailable' : (player.DUPRId || 'N/A') + (player.DUPR ? ' || DUPR ' + player.DUPR : '')}</p>
        `;
        const extraClass = isUnavailable ? 'player-unavailable' : '';
        return buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID, extraClass });
      }).join('');

  enableRedivisionAvailabilityLongPress();
}

function enableRedivisionAvailabilityLongPress() {
  document.querySelectorAll('#rd-availability-list .app-card[data-card-id]').forEach(card => {
    let longPressTimer = null;

    card.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        togglePlayerExclude(card.dataset.cardId, renderRedivisionAvailabilityList); // Redivision version
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

  // Note: togglePlayerExclude re-renders via renderPlayerAvailabilityList by default —
  // needs a small tweak so it re-renders the RIGHT screen depending on context. See note below.
}

/**
 * Ladder Scramble redivision: every division simultaneously trades its
 * top `promoteCount` players upward and bottom `promoteCount` players
 * downward with its immediate neighbors, computed from each division's
 * CURRENT standings rank (before any movement is applied this round).
 * Top division only loses from the bottom (nowhere to send up).
 * Bottom division only loses from the top (nowhere to send down).
 *
 * divisionsRankedPlayers = array of arrays, index 0 = Division 1 (top),
 * each inner array already sorted best-to-worst by standings rank.
 */
function applyPromoteRelegate(divisionsRankedPlayers, promoteCount) {
  const numDivisions = divisionsRankedPlayers.length;
  const newDivisions = Array.from({ length: numDivisions }, () => []);

  divisionsRankedPlayers.forEach((divisionPlayers, divIdx) => {
    const n = divisionPlayers.length;
    const promoted = divIdx > 0 ? divisionPlayers.slice(0, promoteCount) : [];
    const relegated = divIdx < numDivisions - 1 ? divisionPlayers.slice(n - promoteCount) : [];
    const staying = divisionPlayers.slice(
      divIdx > 0 ? promoteCount : 0,
      divIdx < numDivisions - 1 ? n - promoteCount : n
    );

    newDivisions[divIdx].push(...staying);
    if (promoted.length > 0) newDivisions[divIdx - 1].push(...promoted);
    if (relegated.length > 0) newDivisions[divIdx + 1].push(...relegated);
  });

  console.log(`The new divisions are ${newDivisions}`);
  return newDivisions;
}

/**
 * ============================================================
 * REDIVISION TEAM/GROUP ASSIGNMENT ENGINES
 * One function per game's redivision rule. All read from
 * Standings (results-based rank), not DUPR — except Doubles
 * Pro's DRAW-time pairing, which stays DUPR-based; only its
 * REDIVISION uses standings.
 * ============================================================
 */

// ---------- SHARED: rank players by current Standings ----------

function getStandingsRankedPlayers(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion));

  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const standings = players.map(player => {
    const stats = calculatePlayerStats(player.PlayerID, matches); // reuses existing Standings logic
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player, points };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0); // DUPR as tiebreak
  });

  return standings.map(s => s.player);
}

// ---------- TOP-WITH-BOTTOM PAIRING (Doubles Pro: DUPR at draw, standings at redivision) ----------

function buildTopBottomPairs(sortedPlayersDesc) {
  const n = sortedPlayersDesc.length;
  const pairs = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([sortedPlayersDesc[i], sortedPlayersDesc[n - 1 - i]]);
  }
  return pairs;
}

function redivideDoublesProByStandings(payload) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const pairs = buildTopBottomPairs(rankedPlayers);
  return pairs.map(pair => pair); // array of [playerA, playerB] — one per team
}

// ---------- CONTIGUOUS-BLOCK DIVISIONS (Pools, redivision only) ----------

function redividePoolsByStandings(payload, numberOfGroups) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const playersPerGroup = computePlayersPerGroup(rankedPlayers.length, numberOfGroups); // reuses existing helper

  const groups = [];
  let cursor = 0;
  playersPerGroup.forEach(count => {
    groups.push(rankedPlayers.slice(cursor, cursor + count));
    cursor += count;
  });
  return groups;
}

// ---------- LADDER SCRAMBLE PROMOTE/RELEGATE (verified earlier) ----------

function applyPromoteRelegate(divisionsRankedPlayers, promoteCount) {
  const numDivisions = divisionsRankedPlayers.length;
  const newDivisions = Array.from({ length: numDivisions }, () => []);

  divisionsRankedPlayers.forEach((divisionPlayers, divIdx) => {
    const n = divisionPlayers.length;
    const promoted = divIdx > 0 ? divisionPlayers.slice(0, promoteCount) : [];
    const relegated = divIdx < numDivisions - 1 ? divisionPlayers.slice(n - promoteCount) : [];
    const staying = divisionPlayers.slice(
      divIdx > 0 ? promoteCount : 0,
      divIdx < numDivisions - 1 ? n - promoteCount : n
    );

    newDivisions[divIdx].push(...staying);
    if (promoted.length > 0) newDivisions[divIdx - 1].push(...promoted);
    if (relegated.length > 0) newDivisions[divIdx + 1].push(...relegated);
  });

  return newDivisions;
}

/**
 * Ranks players WITHIN each of their current divisions by standings,
 * then applies the promote/relegate movement.
 */
function redivideLadderScrambleByStandings(payload, promoteCount) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const rankedPlayers = getStandingsRankedPlayers(payload); // full event ranking, but we need per-division sub-rank

  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const numberOfDivisions = parseInt(activeEvent.NumberOfTeams) || 2;

  // Group currently-ranked players by their EXISTING Team (division) number, preserving overall rank order within each
  const divisionsMap = {};
  rankedPlayers.forEach(p => {
    const team = p.Team || 1;
    if (!divisionsMap[team]) divisionsMap[team] = [];
    divisionsMap[team].push(p);
  });

  const divisionsArray = [];
  for (let i = 1; i <= numberOfDivisions; i++) {
    divisionsArray.push(divisionsMap[i] || []);
  }

  return applyPromoteRelegate(divisionsArray, promoteCount);
}

// ---------- POOL FUSION (redivision = no-op, groups unchanged) ----------

function redividePoolFusion(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  const players = payload.players.filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));
  const numberOfGroups = parseInt(activeEvent.NumberOfTeams) || 2;

  const groups = Array.from({ length: numberOfGroups }, () => []);
  players.forEach(p => {
    const teamIdx = (parseInt(p.Team) || 1) - 1;
    if (groups[teamIdx]) groups[teamIdx].push(p);
  });

  return groups; // literally unchanged from current Team assignments
}

function adjustRdStartRound(direction) {
  const hiddenInput = document.getElementById('rd-start-round-hidden');
  const displaySpan = document.getElementById('rd-start-round-value');

  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);

  hiddenInput.value = current;
  displaySpan.innerText = current;

  saveRdStartRound(current);
}

async function saveRdStartRound(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  if (activeEvent) activeEvent.CurrentRound = value;

  try {
    await window.updateEventFieldInFirestore(activeEventId, 'CurrentRound', value);
  } catch (err) {
    console.error("Failed to save CurrentRound:", err);
  }
}

function renderGroupsUI(groups, groupLabel, allPlayersForSeedLookup, ids, useStandingsCards = false) {
  const { groupsListId, nextBtnId, allPlayersPresentVar } = ids;

  window.gdGroupAssignment = groups;

  const container = document.getElementById(groupsListId);
  let html = '';

  // Pre-compute standings rank/points ONCE if needed, so every group's cards can use it
  let rankByPlayerId = {}, statsByPlayerId = {}, pointsByPlayerId = {};
  if (useStandingsCards) {
    const activeEventId = window.cachedUserUniverse.activeEventId;
    const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
    const matches = window.cachedUserUniverse.draw || [];
    const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

    const standings = allPlayersForSeedLookup.map(player => {
      const stats = calculatePlayerStats(player.PlayerID, matches);
      const points = calculateLadderPoints(stats, ladderScoringMode);
      return { player, stats, points };
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0);
    });

    standings.forEach((entry, index) => {
      rankByPlayerId[entry.player.PlayerID] = index + 1;
      statsByPlayerId[entry.player.PlayerID] = entry.stats;
      pointsByPlayerId[entry.player.PlayerID] = entry.points;
    });
  }

  const duprSorted = [...allPlayersForSeedLookup].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  groups.forEach((groupPlayers, idx) => {
    const groupNumber = idx + 1;
    html += `<div class="event-section-title current">${groupLabel} ${groupNumber}</div>`;
    html += `<div class="card-grid" id="${groupsListId}-group-${groupNumber}" data-group-number="${groupNumber}">`;

    groupPlayers.forEach(player => {
      if (useStandingsCards) {
        // Ladder-style card — rank icon + points badge, matching the Standings screen exactly
        const rank = rankByPlayerId[player.PlayerID];
        const stats = statsByPlayerId[player.PlayerID] || { games: 0, wins: 0, losses: 0 };
        const points = pointsByPlayerId[player.PlayerID] || 0;
        const iconAsset = ladderRankings[0]['rank-' + rank] || '🏅';

        html += `
          <div class="app-card" data-card-id="${player.PlayerID}">
            <div class="card-icon-wrapper">
              <img src="${iconAsset}" alt="Rank ${rank}" class="card-icon-images" loading="lazy">
            </div>
            <div class="card-content">
              <h3>${player.FirstName || 'Unnamed'} (DUPR: ${player.DUPR || 'N/A'})</h3>
              <p class="card-meta-line">${stats.games} Games || ${stats.wins} Wins || ${stats.losses} Losses</p>
            </div>
            <div class="points-badge">${points}</div>
          </div>
        `;
      } else {
        // Existing plain DUPR-only card, unchanged — used for fresh draws
        const seedNumber = duprSorted.findIndex(p => p.PlayerID === player.PlayerID) + 1;
        const seedUrl = playerSeeds[0]['seed-' + seedNumber];
        const iconAsset = seedUrl || '🎾';

        const contentHtml = `
          <h3>${player.Name || 'Unnamed Player'}</h3>
          <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
        `;
        html += buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID });
      }
    });

    html += `</div>`;
  });

  container.innerHTML = html || `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`;

  enableTeamsDragDrop(groups.length, groupsListId);
  commitTeamsAssignment(groups.length, groupsListId);

  const btn = document.getElementById(nextBtnId);
  if (btn) {
    btn.innerText = window[allPlayersPresentVar] === 'Yes' ? 'Build Draw' : 'Next';
  }
}