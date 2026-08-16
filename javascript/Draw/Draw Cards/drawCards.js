/**
 * ============================================================
 * DRAW CARDS
 * Covers: the Draw screen's "All Matches" tab, Current Round
 * tab (with swipe navigation and scoring-mode toggle), the
 * Match Score entry screen (Points/Wins scoring, swipe between
 * courts), and the Draw FAB menu.
 *
 * Depends on shared helpers defined in playerCards.js:
 * buildCardMarkup(), showLoadingState().
 * Depends on functions defined in drawGenerator.js:
 * generateNRoundsAndPreview() (called from playerCards.js's
 * handleBuildDraw, not from this file).
 * Load order: playerCards.js must load before this file.
 * ============================================================
 */

// ---------- ALL MATCHES TAB ----------

async function renderDrawCards(payload) {
  console.log('Calling renderDrawCards');
  showLoadingState('active-draw-list', 'Loading draw...');

  const container = document.getElementById('active-draw-list');
  const placeholder = document.getElementById('placeholder-view-draw');
  if (!container) {
    console.error("DOM Element '#active-draw-list' not found!");
    return;
  }

  const activeEventId = payload.activeEventId;
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  const currentDrawVersion = activeEvent.CurrentDrawVersion;
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  let matches = await window.fetchDrawFromFirestore(activeEventId, currentDrawVersion);
  window.cachedUserUniverse.draw = matches;

  // For Progressive games, only show matches with a result, plus the current round
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent.GameID);
  const isProgressive = gameProfile?.GamesGroup === 'Progressive';
  if (isProgressive) {
    const currentRound = parseInt(activeEvent.CurrentRound) || 1;
    matches = matches.filter(m => {
      const hasResult = m.Team1WinLoss && m.Team2WinLoss;
      const isCurrentRound = parseInt(m.Round) === currentRound;
      return hasResult || isCurrentRound;
    });
  }

  // ...rest of the function unchanged, just uses this filtered `matches` from here on

  const players = window.cachedUserUniverse.players && window.cachedUserUniverse.players.length > 0
    ? window.cachedUserUniverse.players
    : await window.fetchPlayersFromFirestore(activeEventId, currentPlayerVersion);
  window.cachedUserUniverse.players = players;

  if (matches.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = '';
    return;
  }

  // 2. Build a PlayerID -> Name lookup
  const playerMap = {};
  players.forEach(p => {
    playerMap[p.PlayerID] = p.FirstName;
  });

  // 3. Validate every player ID referenced in the draw resolves to a known player
  let allPlayersMatched = true;
  matches.forEach(m => {
    [m.Team1Player1, m.Team1Player2, m.Team2Player1, m.Team2Player2].forEach(pid => {
      if (!playerMap[pid]) {
        console.error("Unmatched PlayerID in draw:", pid, "on match", m.MatchID);
        allPlayersMatched = false;
      }
    });
  });

  if (!allPlayersMatched) {
    console.error("Draw not rendered — one or more PlayerIDs did not match the Players list.");
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h4>Draw data error — player mismatch detected</h4>
      </div>
    `;
    return;
  }

  if (placeholder) placeholder.style.display = 'none';

  // 4. Sort by Round asc, then Court asc
  matches.sort((a, b) => {
    const roundDiff = (parseInt(a.Round) || 0) - (parseInt(b.Round) || 0);
    if (roundDiff !== 0) return roundDiff;
    return (parseInt(a.Court) || 0) - (parseInt(b.Court) || 0);
  });

  // 5. Group into round sections and build cards
  let html = '';
  let currentRound = null;

  matches.forEach(m => {
    if (m.Round !== currentRound) {
      currentRound = m.Round;
      html += `<div class="event-section-title">Round ${currentRound}</div>`;
    }

    const iconAsset = courts[0]['court-' + m.Court] || '🏟️';

    const team1 = formatTeamNames([
      playerMap[m.Team1Player1], playerMap[m.Team1Player2],
      playerMap[m.Team1Player3], playerMap[m.Team1Player4]
    ]);
    const team2 = formatTeamNames([
      playerMap[m.Team2Player1], playerMap[m.Team2Player2],
      playerMap[m.Team2Player3], playerMap[m.Team2Player4]
    ]);

    const isComplete = m.Team1WinLoss && m.Team2WinLoss;
    const hasRealScore = (parseInt(m.Team1Score) || 0) > 0 || (parseInt(m.Team2Score) || 0) > 0;

    let metaLine;
    if (isComplete && hasRealScore) {
      metaLine = `Score ${m.Team1Score} - ${m.Team2Score} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    } else if (isComplete) {
      // Wins-mode result — no score was ever entered, just show W/L
      const team1Result = m.Team1WinLoss === 'Win' ? 'W' : 'L';
      const team2Result = m.Team2WinLoss === 'Win' ? 'W' : 'L';
      metaLine = `Result ${team1Result} - ${team2Result} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    } else {
      const duprDelta = Math.abs((parseFloat(m.Team1AvgDUPR) || 0) - (parseFloat(m.Team2AvgDUPR) || 0)).toFixed(2);
      metaLine = `DUPR Diff ${duprDelta} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    }

    const contentHtml = `
      <h4>${team1} vs. ${team2}</h4>
      <p class="card-meta-line">${metaLine}</p>
    `;

    const onClickAttr = `onclick="openMatchScoreView('${m.MatchID}')"`;
    html += buildCardMarkup({ iconAsset, contentHtml, onClickAttr });
  });

  container.innerHTML = html;
  console.log(`Successfully rendered ${matches.length} draw card(s) across rounds.`);
}

// ---------- SHARED DRAW/MATCH HELPERS ----------

function buildPlayerMap(payload) {
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(payload.activeEventId)
  );
  const currentPlayerVersion = activeEvent ? activeEvent.CurrentPlayerVersion : null;

  const playerMap = {};
  (payload.players || []).forEach(p => {
    if (String(p.PlayerVersion) === String(currentPlayerVersion)) {
      playerMap[p.PlayerID] = {
        name: p.FirstName,
        dupr: p.DUPR
      };
    }
  });
  return playerMap;
}

function formatTeamNames(playerNames) {
  // playerNames = array of names, already resolved, filtered of any nulls
  const names = playerNames.filter(n => n); // drop any null/undefined entries
  if (names.length === 0) return '?';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function calculateTeamAvgDupr(playerMap, pid1, pid2) {
  const d1 = parseFloat(playerMap[pid1]?.dupr);
  const d2 = parseFloat(playerMap[pid2]?.dupr);

  const values = [d1, d2].filter(v => !isNaN(v));
  if (values.length === 0) return 'N/A';

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return avg.toFixed(2);
}

// ---------- SCORING MODE TOGGLE (Points / Wins / None) ----------

function renderScoringToggle(currentValue) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const options = gameProfile?.Scoring || ['Points', 'Wins', 'None']; // fallback if a game has no Scoring array defined

  const container = document.getElementById('scoring-toggle');
  if (!container) return;

  container.innerHTML = options.map(opt =>
    `<button class="scoring-option ${opt === currentValue ? 'active' : ''}" data-value="${opt}" onclick="setScoringMode('${opt}')">${opt}</button>`
  ).join('');
}

function setScoringMode(newValue) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  // Update UI + local cache immediately
  activeEvent.Scoring = newValue;
  renderScoringToggle(newValue);

  // Persist to Firestore
  window.updateScoringModeInFirestore(activeEventId, newValue)
    .then(() => console.log("Scoring mode updated in Firestore:", newValue))
    .catch(err => console.error("Failed to update scoring mode:", err));
}

// ---------- MATCH SCORE ENTRY SCREEN ----------

function openMatchScoreView(matchId) {
  const payload = window.cachedUserUniverse;
  const match = (payload.draw || []).find(m => m.MatchID === matchId);
  if (!match) {
    console.error("Match not found:", matchId);
    return;
  }

  // Build the full sorted list of this round's matches, for swipe navigation
  const roundMatches = (payload.draw || [])
    .filter(m =>
      String(m.EventID) === String(match.EventID) &&
      String(m.DrawVersion) === String(match.DrawVersion) &&
      String(m.Round) === String(match.Round)
    )
    .sort((a, b) => (parseInt(a.Court) || 0) - (parseInt(b.Court) || 0));

  window.currentRoundMatches = roundMatches;
  window.currentMatchIndex = roundMatches.findIndex(m => m.MatchID === matchId);

  renderMatchScoreView();
  navigateToScreen('match-detail');
}

function renderMatchScoreView() {
  const matches = window.currentRoundMatches;
  const idx = window.currentMatchIndex;
  const match = matches ? matches[idx] : null;
  if (!match) return;

  const playerMap = buildPlayerMap(window.cachedUserUniverse);

  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(window.cachedUserUniverse.activeEventId)
  );
  const scoringMode = (activeEvent && activeEvent.Scoring) || 'Points';

  document.getElementById('match-round-court-heading').innerText =
    `Round ${match.Round} — Court ${match.Court}`;

  document.getElementById('team1-label').innerText = `Team ${match.Team1}`;
  document.getElementById('team2-label').innerText = `Team ${match.Team2}`;

  document.getElementById('team1-players').innerText = formatTeamNames([
    playerMap[match.Team1Player1]?.name, playerMap[match.Team1Player2]?.name,
    playerMap[match.Team1Player3]?.name, playerMap[match.Team1Player4]?.name
  ]);
  document.getElementById('team2-players').innerText = formatTeamNames([
    playerMap[match.Team2Player1]?.name, playerMap[match.Team2Player2]?.name,
    playerMap[match.Team2Player3]?.name, playerMap[match.Team2Player4]?.name
  ]);

  document.getElementById('team1-dupr').innerText =
    `Avg DUPR: ${calculateTeamAvgDupr(playerMap, match.Team1Player1, match.Team1Player2)}`;
  document.getElementById('team2-dupr').innerText =
    `Avg DUPR: ${calculateTeamAvgDupr(playerMap, match.Team2Player1, match.Team2Player2)}`;

  const team1Controls = document.getElementById('team1-controls');
  const team2Controls = document.getElementById('team2-controls');

  if (scoringMode === 'Points') {
    team1Controls.innerHTML = `
      <div class="score-control">
        <button class="score-btn" onclick="updateMatchScore(1, -1)">−</button>
        <span id="team1-score-value" class="score-value">0</span>
        <button class="score-btn" onclick="updateMatchScore(1, 1)">+</button>
      </div>
    `;
    team2Controls.innerHTML = `
      <div class="score-control">
        <button class="score-btn" onclick="updateMatchScore(2, -1)">−</button>
        <span id="team2-score-value" class="score-value">0</span>
        <button class="score-btn" onclick="updateMatchScore(2, 1)">+</button>
      </div>
    `;
    document.getElementById('team1-score-value').innerText = match.Team1Score || 0;
    document.getElementById('team2-score-value').innerText = match.Team2Score || 0;

  } else if (scoringMode === 'Wins') {
    const team1Selected = match.Team1WinLoss === 'Win';
    const team2Selected = match.Team2WinLoss === 'Win';

    team1Controls.innerHTML = `
      <button class="win-btn ${team1Selected ? 'selected' : ''}" id="team1-win-btn" onclick="setMatchWinner(1)">WIN</button>
    `;
    team2Controls.innerHTML = `
      <button class="win-btn ${team2Selected ? 'selected' : ''}" id="team2-win-btn" onclick="setMatchWinner(2)">WIN</button>
    `;

  } else {
    // None — show nothing
    team1Controls.innerHTML = '';
    team2Controls.innerHTML = '';
  }
}

function updateMatchScore(team, delta) {
  const matches = window.currentRoundMatches;
  const idx = window.currentMatchIndex;
  const match = matches ? matches[idx] : null;
  if (!match) return;

  const field = team === 1 ? 'Team1Score' : 'Team2Score';
  const updated = Math.max(0, (parseInt(match[field]) || 0) + delta);
  match[field] = updated;

  document.getElementById(`team${team}-score-value`).innerText = updated;

  // Derive Win/Loss from the current scores whenever they differ
  const t1 = parseInt(match.Team1Score) || 0;
  const t2 = parseInt(match.Team2Score) || 0;

  if (t1 > t2) {
    match.Team1WinLoss = 'Win';
    match.Team2WinLoss = 'Loss';
  } else if (t2 > t1) {
    match.Team1WinLoss = 'Loss';
    match.Team2WinLoss = 'Win';
  } else {
    // Scores tied (e.g. 0-0 before anyone's scored, or a genuine tie) — not yet a completed result
    match.Team1WinLoss = '';
    match.Team2WinLoss = '';
  }

  scheduleScoreSave(match);
  refreshStandingsIfVisible();
}

function setMatchWinner(team) {
  const matches = window.currentRoundMatches;
  const idx = window.currentMatchIndex;
  const match = matches ? matches[idx] : null;
  if (!match) return;

  if (team === 1) {
    match.Team1WinLoss = 'Win';
    match.Team2WinLoss = 'Loss';
  } else {
    match.Team1WinLoss = 'Loss';
    match.Team2WinLoss = 'Win';
  }

  renderMatchScoreView();
  scheduleWinLossSave(match);
  refreshStandingsIfVisible();
}

function saveMatchWinLoss(match) {
  window.updateMatchWinLossInFirestore(match.MatchID, match.Team1WinLoss, match.Team2WinLoss)
    .then(() => console.log("Win/Loss saved to Firestore."))
    .catch(err => console.error("Win/Loss save failed:", err));
}

let scoreSaveTimer = null;
function scheduleScoreSave(match) {
  clearTimeout(scoreSaveTimer);
  scoreSaveTimer = setTimeout(() => saveMatchScore(match), 1000);
}

function saveMatchScore(match) {
  window.updateMatchScoreInFirestore(match.MatchID, match.Team1Score, match.Team2Score, match.Team1WinLoss, match.Team2WinLoss)
    .then(() => {
      console.log("Score saved successfully to Firestore.");
    })
    .catch(err => {
      console.error("Score save failed:", err);
    });
}

// --- Swipe between courts in the same round ---
function goToNextMatch() {
  if (window.currentMatchIndex < window.currentRoundMatches.length - 1) {
    window.currentMatchIndex++;
    renderMatchScoreView();
  } else {
    // Already at the last court in this round — exit back to Current Round
    exitToCurrentRoundScreen();
  }
}

function goToPreviousMatch() {
  if (window.currentMatchIndex > 0) {
    window.currentMatchIndex--;
    renderMatchScoreView();
  } else {
    // Already at the first court in this round — exit back to Current Round
    exitToCurrentRoundScreen();
  }
}

function exitToCurrentRoundScreen() {
  navigateToScreen('draw');
  switchDrawTab('current-round');
}

function initMatchSwipeHandlers() {
  const container = document.getElementById('screen-match-detail');
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

    if (deltaX < 0) {
      goToNextMatch();
    } else {
      goToPreviousMatch();
    }
  });
}

// ---------- DRAW SCREEN FAB MENU ----------

function toggleFabMenu() {
  const menu = document.getElementById('draw-fab-menu');
  const plusIcon = document.getElementById('fab-plus-icon');
  const xIcon = document.getElementById('fab-x-icon');
  const label = document.getElementById('fab-main-label');

  console.log("label element found:", label); // ADD THIS temporarily

  const isOpen = menu.classList.toggle('open');

  plusIcon.style.display = isOpen ? 'none' : 'block';
  xIcon.style.display = isOpen ? 'block' : 'none';
  label.style.display = isOpen ? 'none' : 'block';
}

function handleFabAction(action) {
  toggleFabMenu();

  switch (action) {
    case 'redivision':
      navigateToScreen('redivision');
      break;
    case 'add-match':
      console.log('Add Match tapped');
      break;
    case 'redraw':
      console.log('Redraw tapped');
      break;
    case 'substitution': // NEW
      navigateToScreen('player-substitution');
      break;
    case 'player-available': // NEW
      console.log('Player Available tapped — routing not yet wired up');
      break;
    case 'result-refresh': // NEW
      console.log('Draw Refresh tapped — routing not yet wired up');
      break;
  }
}

// ---------- DRAW SCREEN TABS ----------

function switchDrawTab(tabId) {
  document.querySelectorAll('#screen-draw .top-tab-bar .tab-item').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('#screen-draw .tab-viewport .tab-view').forEach(view => {
    view.classList.remove('active');
  });

  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');
}

// ---------- CURRENT ROUND TAB ----------

async function renderCurrentRoundView(payload) {
  showLoadingState('current-round-list', 'Loading current round...');

  const activeEventId = payload.activeEventId;
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

  renderScoringToggle(activeEvent.Scoring || 'None');

  // Initialize the round tracker only once per event load
  window.currentRoundNumber = parseInt(activeEvent.CurrentRound) || 1;

  const currentDrawVersion = activeEvent.CurrentDrawVersion;

  const matches = window.cachedUserUniverse.draw && window.cachedUserUniverse.draw.length > 0
    ? window.cachedUserUniverse.draw
    : await window.fetchDrawFromFirestore(activeEventId, currentDrawVersion);
  window.cachedUserUniverse.draw = matches;

  const players = window.cachedUserUniverse.players && window.cachedUserUniverse.players.length > 0
    ? window.cachedUserUniverse.players
    : await window.fetchPlayersFromFirestore(activeEventId, activeEvent.CurrentPlayerVersion);
  window.cachedUserUniverse.players = players;

  const playerMap = {};
  players.forEach(p => { playerMap[p.PlayerID] = p.FirstName; });

  const roundMatches = matches
    .filter(m => parseInt(m.Round) === window.currentRoundNumber)
    .sort((a, b) => (parseInt(a.Court) || 0) - (parseInt(b.Court) || 0));

  document.getElementById('current-round-heading').innerText = `Round ${window.currentRoundNumber}`;

  const container = document.getElementById('current-round-list');
  const placeholder = document.getElementById('placeholder-view-current-round');

  if (roundMatches.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = '';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  let html = '';
  roundMatches.forEach(m => {
    const iconAsset = courts[0]['court-' + m.Court] || '🏟️';
    const team1 = formatTeamNames([
      playerMap[m.Team1Player1], playerMap[m.Team1Player2],
      playerMap[m.Team1Player3], playerMap[m.Team1Player4]
    ]);
    const team2 = formatTeamNames([
      playerMap[m.Team2Player1], playerMap[m.Team2Player2],
      playerMap[m.Team2Player3], playerMap[m.Team2Player4]
    ]);

    const isComplete = m.Team1WinLoss && m.Team2WinLoss;
    const hasRealScore = (parseInt(m.Team1Score) || 0) > 0 || (parseInt(m.Team2Score) || 0) > 0;

    let metaLine;
    if (isComplete && hasRealScore) {
      metaLine = `Score ${m.Team1Score} - ${m.Team2Score} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    } else if (isComplete) {
      // Wins-mode result — no score was ever entered, just show W/L
      const team1Result = m.Team1WinLoss === 'Win' ? 'W' : 'L';
      const team2Result = m.Team2WinLoss === 'Win' ? 'W' : 'L';
      metaLine = `Result ${team1Result} - ${team2Result} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    } else {
      const duprDelta = Math.abs((parseFloat(m.Team1AvgDUPR) || 0) - (parseFloat(m.Team2AvgDUPR) || 0)).toFixed(2);
      metaLine = `DUPR Diff ${duprDelta} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    }

    const contentHtml = `
      <h4>${team1} vs. ${team2}</h4>
      <p class="card-meta-line">${metaLine}</p>
    `;
    const onClickAttr = `onclick="openMatchScoreView('${m.MatchID}')"`;
    html += buildCardMarkup({ iconAsset, contentHtml, onClickAttr });
  });

  container.innerHTML = html;
}

async function goToNextRound() {
  const matches = window.cachedUserUniverse.draw || [];
  const maxRound = Math.max(...matches.map(m => parseInt(m.Round) || 0), window.currentRoundNumber);

  if (window.currentRoundNumber >= maxRound) return;

  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent.GameID);
  const isProgressive = gameProfile?.GamesGroup === 'Progressive';

  const nextRoundNumber = window.currentRoundNumber + 1;

  if (isProgressive) {
    const nextRoundAlreadyHasResults = isRoundComplete(matches, nextRoundNumber); // NEW

    if (!nextRoundAlreadyHasResults) {
      if (!isRoundComplete(matches, window.currentRoundNumber)) {
        alert("Enter results for every match in this round before advancing.");
        return;
      }

      showLoadingState('current-round-list', 'Advancing to next round...');

      const nextRoundDummyMatches = matches.filter(m => parseInt(m.Round) === nextRoundNumber);
      const players = window.cachedUserUniverse.players;

      const updatedMatches = advanceProgressiveRound(
        activeEvent.GameID, matches, nextRoundDummyMatches, players, nextRoundNumber,
        activeEventId, activeEvent.CurrentDrawVersion, window.currentUserEmail
      );

      if (!updatedMatches) {
        alert("Could not generate the next round — check the console for details.");
        renderCurrentRoundView(window.cachedUserUniverse);
        return;
      }

      try {
        await Promise.all(updatedMatches.map(m =>
          window.updateMatchFieldsInFirestore(m.MatchID, {
            Team1Player1: m.Team1Player1, Team1Player2: m.Team1Player2,
            Team2Player1: m.Team2Player1, Team2Player2: m.Team2Player2,
            Team1AvgDUPR: m.Team1AvgDUPR, Team2AvgDUPR: m.Team2AvgDUPR,
            DUPRMatchDelta: m.DUPRMatchDelta,
            Team1WinProb: m.Team1WinProb, Team2WinProb: m.Team2WinProb,
            ExpectedTeam1Score: m.ExpectedTeam1Score, ExpectedTeam2Score: m.ExpectedTeam2Score
          })
        ));

        updatedMatches.forEach(updated => {
          const idx = window.cachedUserUniverse.draw.findIndex(m => m.MatchID === updated.MatchID);
          if (idx !== -1) window.cachedUserUniverse.draw[idx] = { ...window.cachedUserUniverse.draw[idx], ...updated };
        });

        console.log(`Advanced to Round ${nextRoundNumber} — next round's matches written to Firestore.`);
      } catch (err) {
        console.error("Failed to write advanced round to Firestore:", err);
        alert("Failed to save the next round — check the console for details.");
        renderCurrentRoundView(window.cachedUserUniverse);
        return;
      }
    } else {
      console.log(`Round ${nextRoundNumber} already has results — skipping recalculation, just navigating.`); // NEW
    }
  }

  window.currentRoundNumber++;
  updateLocalCurrentRoundCache();
  renderCurrentRoundView(window.cachedUserUniverse);
  persistCurrentRound();
}

function goToPreviousRound() {
  if (window.currentRoundNumber > 1) {
    window.currentRoundNumber--;
    updateLocalCurrentRoundCache();
    renderCurrentRoundView(window.cachedUserUniverse);
    persistCurrentRound();
  }
}

function updateLocalCurrentRoundCache() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (activeEvent) {
    activeEvent.CurrentRound = window.currentRoundNumber;
  }
}

function persistCurrentRound() {
  const activeEventId = window.cachedUserUniverse.activeEventId;

  window.updateCurrentRoundInFirestore(activeEventId, window.currentRoundNumber)
    .then(() => console.log("CurrentRound updated in Firestore:", window.currentRoundNumber))
    .catch(err => console.error("Failed to update CurrentRound:", err));
}

function initCurrentRoundSwipeHandlers() {
  const container = document.getElementById('view-current-round');
  console.log("Current round container found:", container); // ADD THIS
  if (!container) return;

  let startX = 0, startY = 0;

  container.addEventListener('touchstart', (e) => {
    console.log("Current round touchstart fired"); // ADD THIS
    startX = e.changedTouches[0].screenX;
    startY = e.changedTouches[0].screenY;
  });

  container.addEventListener('touchend', (e) => {
    console.log("Current round touchend fired"); // ADD THIS
    const deltaX = e.changedTouches[0].screenX - startX;
    const deltaY = e.changedTouches[0].screenY - startY;
    console.log(`deltaX: ${deltaX}, deltaY: ${deltaY}`); // ADD THIS

    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) {
      goToNextRound(); // swipe left -> next round
    } else {
      goToPreviousRound(); // swipe right -> previous round
    }
  });
}

// Player substitution
function renderPlayerSubstitutionScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const roundNumber = window.currentRoundNumber || parseInt(activeEvent?.CurrentRound) || 1;

  document.getElementById('sub-round-heading').innerText = `Round ${roundNumber} Substitution`;

  const matches = (payload.draw || []).filter(m => parseInt(m.Round) === roundNumber);
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const activePlayers = (payload.players || [])
    .filter(p => String(p.PlayerVersion) === String(currentPlayerVersion))
    .filter(p => p.playerExclude !== 'Yes');

  const playerLookup = {};
  activePlayers.forEach(p => { playerLookup[p.PlayerID] = p; });

  // Build seed rank map (matches your existing pattern elsewhere)
  const duprRanked = [...activePlayers].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });
  const seedRankMap = {};
  duprRanked.forEach((p, idx) => { seedRankMap[p.PlayerID] = idx + 1; });

  function buildSubCard(player, extraAttrs = '') {
    const seedNumber = seedRankMap[player.PlayerID];
    const seedUrl = playerSeeds[0]['seed-' + seedNumber];
    const iconAsset = seedUrl || '🎾';

    const contentHtml = `
      <h3>${player.Name || 'Unnamed Player'} ${player.FirstName ? '(' + player.FirstName + ')' : ''}</h3>
      <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
    `;

    const iconMarkup = iconAsset.startsWith('http')
      ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images" loading="lazy">`
      : `<span class="card-icon">${iconAsset}</span>`;

    return `
      <div class="app-card" data-card-id="${player.PlayerID}" ${extraAttrs}>
        <div class="card-icon-wrapper">${iconMarkup}</div>
        <div class="card-content">${contentHtml}</div>
        <span class="card-arrow">→</span>
      </div>
    `;
  }

  // Match players — track which match/field slot each occupies
  const matchPlayersHtml = [];
  const inMatchIds = new Set();

  matches.sort((a, b) => (parseInt(a.Court) || 0) - (parseInt(b.Court) || 0));

  matches.forEach(m => {
    const slots = [
      ['Team1Player1', m.Team1Player1], ['Team1Player2', m.Team1Player2],
      ['Team1Player3', m.Team1Player3], ['Team1Player4', m.Team1Player4],
      ['Team2Player1', m.Team2Player1], ['Team2Player2', m.Team2Player2],
      ['Team2Player3', m.Team2Player3], ['Team2Player4', m.Team2Player4]
    ];
    slots.forEach(([field, pid]) => {
      if (!pid) return;
      const player = playerLookup[pid];
      if (!player) return;
      inMatchIds.add(pid);
      matchPlayersHtml.push(buildSubCard(player, `data-match-id="${m.MatchID}" data-field="${field}"`));
    });
  });

  document.getElementById('sub-match-players-list').innerHTML = matchPlayersHtml.length > 0
    ? matchPlayersHtml.join('')
    : `<div class="no-data-placeholder"><h3>No Matches This Round</h3></div>`;

  // Bye players — anyone active but not in any match this round
  const byePlayers = activePlayers.filter(p => !inMatchIds.has(p.PlayerID));
  document.getElementById('sub-bye-players-list').innerHTML = byePlayers.length > 0
    ? byePlayers.map(p => buildSubCard(p)).join('')
    : `<div class="no-data-placeholder"><h3>No Byes This Round</h3></div>`;

  enableSubstitutionLongPress();
}

window.subOutSelection = null; // { playerId, matchId, field }
window.subInSelection = null;  // { playerId }

function enableSubstitutionLongPress() {
  document.querySelectorAll('#sub-match-players-list .app-card[data-card-id]').forEach(card => {
    attachSubLongPress(card, 'out');
  });
  document.querySelectorAll('#sub-bye-players-list .app-card[data-card-id]').forEach(card => {
    attachSubLongPress(card, 'in');
  });
}

function attachSubLongPress(card, type) {
  let longPressTimer = null;

  card.addEventListener('touchstart', () => {
    longPressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      toggleSubSelection(card, type);
    }, 350);
  }, { passive: true });

  card.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer);
  }, { passive: true });

  card.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
    window.suppressNextCardClick = true;
  });
}

function toggleSubSelection(card, type) {
  const playerId = card.dataset.cardId;

  if (type === 'out') {
    // Deselect if tapping the same card again
    if (window.subOutSelection?.playerId === playerId) {
      card.classList.remove('sub-out');
      window.subOutSelection = null;
      return;
    }
    // Clear any previous sub-out selection
    document.querySelectorAll('#sub-match-players-list .app-card.sub-out').forEach(c => c.classList.remove('sub-out'));
    card.classList.add('sub-out');
    window.subOutSelection = {
      playerId,
      matchId: card.dataset.matchId,
      field: card.dataset.field
    };
  } else {
    if (window.subInSelection?.playerId === playerId) {
      card.classList.remove('sub-in');
      window.subInSelection = null;
      return;
    }
    document.querySelectorAll('#sub-bye-players-list .app-card.sub-in').forEach(c => c.classList.remove('sub-in'));
    card.classList.add('sub-in');
    window.subInSelection = { playerId };
  }

  // Once both are selected, perform the swap
  if (window.subOutSelection && window.subInSelection) {
    performSubstitution();
  }
}

async function performSubstitution() {
  const { matchId, field, playerId: outPlayerId } = window.subOutSelection;
  const inPlayerId = window.subInSelection.playerId;

  try {
    const match = window.cachedUserUniverse.draw.find(m => m.MatchID === matchId);
    if (!match) throw new Error("Match not found");

    match[field] = inPlayerId;
    recalculateMatchScoreFields(match); // NEW

    await window.updateMatchFieldsInFirestore(matchId, {
      [field]: inPlayerId,
      Team1AvgDUPR: match.Team1AvgDUPR,
      Team2AvgDUPR: match.Team2AvgDUPR,
      DUPRMatchDelta: match.DUPRMatchDelta,
      Team1WinProb: match.Team1WinProb,
      Team2WinProb: match.Team2WinProb,
      ExpectedTeam1Score: match.ExpectedTeam1Score,
      ExpectedTeam2Score: match.ExpectedTeam2Score
    });

    console.log(`Substituted ${outPlayerId} out, ${inPlayerId} in — DUPR and expected scores recalculated.`);

    window.subOutSelection = null;
    window.subInSelection = null;
    renderPlayerSubstitutionScreen(window.cachedUserUniverse);
  } catch (err) {
    console.error("Substitution failed:", err);
    alert("Substitution failed — check the console for details.");
    window.subOutSelection = null;
    window.subInSelection = null;
  }
}

function initPlayerSubstitutionSwipeHandlers() {
  const container = document.getElementById('screen-player-substitution');
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

    // Only one exit destination — any decisive horizontal swipe takes you back
    navigateToScreen('draw');
    switchDrawTab('current-round');
  });
}

function getPlayersFromIds(ids) {
  return ids
    .filter(Boolean)
    .map(id => window.cachedUserUniverse.players.find(p => p.PlayerID === id))
    .filter(Boolean);
}

function recalculateMatchScoreFields(match) {
  const team1Players = getPlayersFromIds([match.Team1Player1, match.Team1Player2, match.Team1Player3, match.Team1Player4]);
  const team2Players = getPlayersFromIds([match.Team2Player1, match.Team2Player2, match.Team2Player3, match.Team2Player4]);

  const avg1 = teamAvgDupr(team1Players);
  const avg2 = teamAvgDupr(team2Players);
  const winProb1 = calculateWinProbability(avg1, avg2);

  match.Team1AvgDUPR = avg1;
  match.Team2AvgDUPR = avg2;
  match.DUPRMatchDelta = Math.abs(avg1 - avg2);
  match.Team1WinProb = winProb1;
  match.Team2WinProb = 1 - winProb1;
  ExpectedTeam1Score: winProb1 >= 0.5 ? 11 : Math.max(Math.round(winProb1 * 11 / (1 - winProb1)),9);
  ExpectedTeam2Score: winProb1 >= 0.5 ? Math.max(Math.round((1 - winProb1) * 11 / winProb1),9) : 11;


  return match;
}

function handleMatchDetailAction() {
  console.log("Match detail action tapped — placeholder, no longer routes to substitution");
}

function refreshStandingsIfVisible() {
  const standingsView = document.getElementById('view-standings');
  if (standingsView && standingsView.classList.contains('active')) {
    renderStandingsView(window.cachedUserUniverse);
  }
}

let winLossSaveTimer = null;
function scheduleWinLossSave(match) {
  clearTimeout(winLossSaveTimer);
  winLossSaveTimer = setTimeout(() => saveMatchWinLoss(match), 600);
}

// FAB menu visibility
const DRAW_MENU_ITEM_MAP = {
  AddMatch: 'fab-add-match-item',
  PlayerSub: 'fab-substitution-item',
  PlayerAvailable: 'fab-player-available-item',
  ReDraw: 'fab-redraw-item',
  PlayOffs: 'fab-playoffs-item',
  Redivisioning: 'fab-redivision-item',
  ResultRefresh: 'fab-result-refresh-item'
};

function updateDrawFabMenuVisibility() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);
  const menuOpt = gameProfile?.drawMenuOpt?.[0] || {};

  Object.entries(DRAW_MENU_ITEM_MAP).forEach(([optKey, elementId]) => {
    const item = document.getElementById(elementId);
    if (!item) return;

    const rawValue = menuOpt[optKey];
    const valueToCheck = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const isSupported = valueToCheck === 'Yes';
    item.style.display = isSupported ? 'flex' : 'none';
  });
}
