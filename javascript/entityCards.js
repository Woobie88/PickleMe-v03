function buildCardMarkup({ iconAsset, contentHtml, onClickAttr = '' }) {
  const iconMarkup = iconAsset.startsWith('http')
    ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images-small" loading="lazy">`
    : `<span class="card-icon">${iconAsset}</span>`;

  return `
    <div class="app-card" ${onClickAttr}>
      <div class="card-icon-wrapper">
        ${iconMarkup}
      </div>
      <div class="card-content">
        ${contentHtml}
      </div>
      <span class="card-arrow">→</span>
    </div>
  `;
}

function renderEntityCards(options) {
  const {
    containerId,
    entityName, // e.g. 'players', 'draw', 'byes'
    records,
    activeEventId,
    eventIdField = 'EventID',
    emptyMessage = 'No records found',
    getIcon,
    getContentHtml,
    getOnClick,
    extraFilter = () => true,
    sortFn = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`DOM Element '#${containerId}' not found!`);
    return;
  }

  const placeholder = entityName
    ? document.getElementById(`placeholder-view-${entityName}`)
    : null;

  // 1. Filter down to the active event, plus any extra caller-supplied condition
  let filtered = (records || []).filter(record => {
    const recordEventId = record[eventIdField] || record.eventId;
    const matchesEvent = String(recordEventId) === String(activeEventId);
    return matchesEvent && extraFilter(record);
  });

  // 1b. Apply optional sort
  if (sortFn) {
    filtered = filtered.sort(sortFn);
  }

  // 2. Empty state
  if (filtered.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = `
      <div class="no-data-placeholder">
        <h3>${emptyMessage}</h3>
      </div>
    `;
    return;
  }

  // Hide placeholder since we have cards to show
  if (placeholder) placeholder.style.display = 'none';

  // 3. Build cards
  let cardsHtml = '';
  filtered.forEach((record, index) => {
    const iconAsset = getIcon(record, index);
    const contentHtml = getContentHtml(record);
    const onClickAttr = getOnClick ? `onclick="${getOnClick(record)}"` : '';
    cardsHtml += buildCardMarkup({ iconAsset, contentHtml, onClickAttr });
  });

  container.innerHTML = cardsHtml;
  console.log(`Successfully rendered ${filtered.length} card(s) into #${containerId}.`);
}

async function renderPlayerCards(payload) {
  console.log('Calling renderPlayerCards');

  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(payload.activeEventId)
  );

  if (!activeEvent) {
    console.error("No active event found — cannot load players.");
    return;
  }

  const currentVersion = activeEvent.CurrentPlayerVersion;

  const players = await window.fetchPlayersFromFirestore(payload.activeEventId, currentVersion);
  window.cachedUserUniverse.players = players; // keep local cache in sync

  renderEntityCards({
    containerId: 'active-players-list',
    entityName: 'players',
    records: players,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Players Found',
    extraFilter: () => true, // filtering by event/version already done in the Firestore query
    sortFn: (a, b) => {
      const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
      if (duprDiff !== 0) return duprDiff;
      return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
    },
    getIcon: (player, index) => {
      const seedNumber = index + 1;
      const seedUrl = playerSeeds[0]['seed-' + seedNumber];
      return seedUrl || '🎾';
    },
    getCardId: (player) => player.PlayerID,
    getContentHtml: (player) => `
      <h3>${player.Name || 'Unnamed Player'}</h3>
      <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
    `,
    getOnClick: (player) => `viewPlayerDetail('${player.PlayerID}')`
  });

  enableDragReorder('active-players-list', (newOrderIds) => {
    newOrderIds.forEach((pid, idx) => {
      const player = players.find(p => p.PlayerID === pid);
      if (player) player.Seed = idx + 1;
    });
    saveNewSeedOrder(newOrderIds, payload.activeEventId);
  });
}

async function renderDrawCards(payload) {
  console.log('Calling renderDrawCards');

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

  if (!activeEvent) {
    console.error("No active event found — cannot load draw.");
    return;
  }

  const currentDrawVersion = activeEvent.CurrentDrawVersion;
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  // 1. Fetch this round's matches + the current player roster, both from Firestore
  const matches = await window.fetchDrawFromFirestore(activeEventId, currentDrawVersion);
  window.cachedUserUniverse.draw = matches; // keep local cache in sync

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

    const team1 = `${playerMap[m.Team1Player1]} & ${playerMap[m.Team1Player2]}`;
    const team2 = `${playerMap[m.Team2Player1]} & ${playerMap[m.Team2Player2]}`;

    const isComplete = m.Team1WinLoss && m.Team2WinLoss;

    let metaLine;
    if (isComplete) {
      metaLine = `Score ${m.Team1Score} - ${m.Team2Score} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
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

  document.getElementById('match-round-court-heading').innerText =
    `Round ${match.Round} || Court ${match.Court}`;

  document.getElementById('team1-label').innerText = `Team ${match.Team1}`;
  document.getElementById('team2-label').innerText = `Team ${match.Team2}`;

  document.getElementById('team1-players').innerText =
  `${playerMap[match.Team1Player1]?.name || '?'} & ${playerMap[match.Team1Player2]?.name || '?'}`;
  document.getElementById('team2-players').innerText =
  `${playerMap[match.Team2Player1]?.name || '?'} & ${playerMap[match.Team2Player2]?.name || '?'}`;

  document.getElementById('team1-score-value').innerText = match.Team1Score || 0;
  document.getElementById('team2-score-value').innerText = match.Team2Score || 0;
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

  scheduleScoreSave(match);
}

// --- Swipe between courts in the same round ---
function goToNextMatch() {
  if (window.currentMatchIndex < window.currentRoundMatches.length - 1) {
    window.currentMatchIndex++;
    renderMatchScoreView();
  }
}

function goToPreviousMatch() {
  if (window.currentMatchIndex > 0) {
    window.currentMatchIndex--;
    renderMatchScoreView();
  }
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

let scoreSaveTimer = null;
function scheduleScoreSave(match) {
  clearTimeout(scoreSaveTimer);
  scoreSaveTimer = setTimeout(() => saveMatchScore(match), 1000);
}

function saveMatchScore(match) {
  window.updateMatchScoreInFirestore(match.MatchID, match.Team1Score, match.Team2Score)
    .then(() => {
      console.log("Score saved successfully to Firestore.");
    })
    .catch(err => {
      console.error("Score save failed:", err);
    });
}

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
  toggleFabMenu(); // close the menu after a selection

  switch (action) {
    case 'redivision':
      console.log('Redivision tapped');
      // wire up your actual logic here
      break;
    case 'add-match':
      console.log('Add Match tapped');
      break;
    case 'redraw':
      console.log('Redraw tapped');
      break;
  }
}

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

async function renderCurrentRoundView(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) return;

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
    const team1 = `${playerMap[m.Team1Player1]} & ${playerMap[m.Team1Player2]}`;
    const team2 = `${playerMap[m.Team2Player1]} & ${playerMap[m.Team2Player2]}`;

    const isComplete = m.Team1WinLoss && m.Team2WinLoss;
    let metaLine;
    if (isComplete) {
      metaLine = `Score ${m.Team1Score} - ${m.Team2Score} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
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

function goToNextRound() {
  const matches = window.cachedUserUniverse.draw || [];
  const maxRound = Math.max(...matches.map(m => parseInt(m.Round) || 0), window.currentRoundNumber);
  if (window.currentRoundNumber < maxRound) {
    window.currentRoundNumber++;
    renderCurrentRoundView(window.cachedUserUniverse);
    persistCurrentRound();
  }
}

function goToPreviousRound() {
  if (window.currentRoundNumber > 1) {
    window.currentRoundNumber--;
    renderCurrentRoundView(window.cachedUserUniverse);
    persistCurrentRound();
  }
}

function persistCurrentRound() {
  const activeEventId = window.cachedUserUniverse.activeEventId;

  window.updateCurrentRoundInFirestore(activeEventId, window.currentRoundNumber)
    .then(() => console.log("CurrentRound updated in Firestore:", window.currentRoundNumber))
    .catch(err => console.error("Failed to update CurrentRound:", err));

  // Keep the local cached event record in sync too, so re-navigating within the
  // same session doesn't re-read a stale value from window.cachedUserUniverse.events
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (activeEvent) {
    activeEvent.CurrentRound = window.currentRoundNumber;
  }
}

function initCurrentRoundSwipeHandlers() {
  const container = document.getElementById('view-current-round');
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
      goToNextRound(); // swipe left -> next round
    } else {
      goToPreviousRound(); // swipe right -> previous round
    }
  });
}

