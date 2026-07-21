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

function renderPlayerCards(payload) {
  console.log('Calling renderPlayerCards');
  const activeEvent = (payload.events || []).find(
    e => String(e.EventID || e.eventId) === String(payload.activeEventId)
  );
  const currentVersion = activeEvent ? activeEvent.CurrentPlayerVersion : null;

  renderEntityCards({
    containerId: 'active-players-list',
    entityName: 'players',
    records: payload.players,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Players Found',
    extraFilter: (player) => String(player.PlayerVersion) === String(currentVersion),
    sortFn: (a, b) => {
      const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
      if (duprDiff !== 0) return duprDiff;

      // Tiebreaker: fall back to RandomNumber, ascending
      return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
    },
    getIcon: (player, index) => {
      const seedNumber = index + 1;
      const seedUrl = playerSeeds[0]['seed-' + seedNumber];
      return seedUrl || '🎾';
    },
    getContentHtml: (player) => {
      return `
        <h3>${player.Name || 'Unnamed Player'} ${player.FirstName ? '(' + player.FirstName + ')' : ''}</h3>
        <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
      `;
    },
    getOnClick: (player) => `viewPlayerDetail('${player.PlayerID}')`
  });
}

function renderDrawCards(payload) {
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
  // Assumes an Events field named CurrentDrawVersion, mirroring CurrentPlayerVersion.
  const currentDrawVersion = activeEvent ? activeEvent.CurrentDrawVersion : null;

  // 1. Filter to active event + current draw version
  const matches = (payload.draw || []).filter(m =>
    String(m.EventID) === String(activeEventId) &&
    String(m.DrawVersion) === String(currentDrawVersion)
  );

  if (matches.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = '';
    return;
  }

  // 2. Build a PlayerID -> Name lookup (filtered to current player version)
  const playerMap = buildPlayerMap(payload);

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
        <h3>Draw data error — player mismatch detected</h3>
      </div>
    `;
    return;
  }

  if (placeholder) placeholder.style.display = 'none';

  // 4. Group into round sections and build cards
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
      playerMap[p.PlayerID] = p.FirstName;
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

  document.getElementById('team1-players').innerText =
    `${playerMap[match.Team1Player1] || '?'} & ${playerMap[match.Team1Player2] || '?'}`;
  document.getElementById('team2-players').innerText =
    `${playerMap[match.Team2Player1] || '?'} & ${playerMap[match.Team2Player2] || '?'}`;

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

    // Ignore mostly-vertical gestures (normal scrolling)
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) {
      goToNextMatch(); // swipe left -> next court
    } else {
      goToPreviousMatch(); // swipe right -> previous court
    }
  });
}

// Register the swipe listener once, on app startup
window.addEventListener("DOMContentLoaded", () => {
  initMatchSwipeHandlers();
});

let scoreSaveTimer = null;
function scheduleScoreSave(match) {
  clearTimeout(scoreSaveTimer);
  scoreSaveTimer = setTimeout(() => saveMatchScore(match), 1000);
}

function saveMatchScore(match) {
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'matchScoreUpdate',
      matchId: match.MatchID,
      Team1Score: match.Team1Score,
      Team2Score: match.Team2Score
    })
  })
    .then(res => res.json())
    .then(result => {
      if (!result.success) console.error("Score save failed:", result.error);
    })
    .catch(err => console.error("Score save request failed:", err));
}
