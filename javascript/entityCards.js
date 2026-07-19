function buildCardMarkup({ iconAsset, contentHtml, onClickAttr = '' }) {
  const iconMarkup = iconAsset.startsWith('http')
    ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images" loading="lazy">`
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
  const currentPlayerVersion = activeEvent ? activeEvent.CurrentPlayerVersion : null;
  const playerMap = {};
  (payload.players || []).forEach(p => {
    if (String(p.PlayerVersion) === String(currentPlayerVersion)) {
      playerMap[p.PlayerID] = p.FirstName;
    }
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
        <h3>Draw data error — player mismatch detected</h3>
      </div>
    `;
    return;
  }

  if (placeholder) placeholder.style.display = 'none';

  // 4. Sort by Round asc, then Court asc
  matches.forEach(m => {
    if (m.Round !== currentRound) {
      currentRound = m.Round;
      html += `<div class="event-section-title">Round ${currentRound}</div>`;
    }

    const iconAsset = courts[0]['court-' + m.Court] || '🏟️';

    const team1 = `${playerMap[m.Team1Player1]} & ${playerMap[m.Team1Player2]}`;
    const team2 = `${playerMap[m.Team2Player1]} & ${playerMap[m.Team2Player2]}`;

    const isComplete = m.Team1WinLoss && m.Team2WinLoss; // both populated = match finished

    let metaLine;
    if (isComplete) {
      metaLine = `Score ${m.Team1Score} - ${m.Team2Score} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    } else {
      const duprDelta = Math.abs((parseFloat(m.Team1AvgDUPR) || 0) - (parseFloat(m.Team2AvgDUPR) || 0)).toFixed(2);
      metaLine = `DUPR Diff ${duprDelta} || Exp Res. ${m.ExpectedTeam1Score} - ${m.ExpectedTeam2Score}`;
    }

    const contentHtml = `
      <h3>${team1} vs. ${team2}</h3>
      <p class="card-meta-line">${metaLine}</p>
    `;

    html += buildCardMarkup({ iconAsset, contentHtml });
  });

  container.innerHTML = html;
  console.log(`Successfully rendered ${matches.length} draw card(s) across rounds.`);
}
