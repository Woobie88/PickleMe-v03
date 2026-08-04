function showLoadingState(containerId, message = 'Loading...') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="inline-loading-state">
      <div class="inline-spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function buildCardMarkup({ iconAsset, contentHtml, onClickAttr = '', cardId = null }) {
  const iconMarkup = iconAsset.startsWith('http')
    ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images" loading="lazy">`
    : `<span class="card-icon">${iconAsset}</span>`;

  const idAttr = cardId ? `data-card-id="${cardId}"` : '';

  return `
    <div class="app-card" ${idAttr} ${onClickAttr}>
      <div class="card-icon-wrapper">${iconMarkup}</div>
      <div class="card-content">${contentHtml}</div>
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

function renderCheckInView(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  // Build a fixed DUPR-based seed ranking ONCE, across ALL players — independent of bye-order grouping
  const duprRanked = [...players].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const seedRankMap = {};
  duprRanked.forEach((p, idx) => {
    seedRankMap[p.PlayerID] = idx + 1;
  });

  const manualPlayers = players
    .filter(p => p.byeOrder !== undefined && p.byeOrder !== null && p.byeOrder !== '')
    .sort((a, b) => (parseInt(a.byeOrder) || 0) - (parseInt(b.byeOrder) || 0));

  const randomPlayers = players.filter(p => p.byeOrder === undefined || p.byeOrder === null || p.byeOrder === '');

  randomPlayers.sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const manualContainer = document.getElementById('manual-bye-list');
  const randomContainer = document.getElementById('random-bye-list');

  function buildPlayerCardMarkup(player) {
    const seedNumber = seedRankMap[player.PlayerID]; // fixed, based on DUPR rank only
    const seedUrl = playerSeeds[0]['seed-' + seedNumber];
    const iconAsset = seedUrl || '🎾';

    const contentHtml = `
      <h3>${player.Name || 'Unnamed Player'} ${player.FirstName ? '(' + player.FirstName + ')' : ''}</h3>
      <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
    `;

    return buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID });
  }

  manualContainer.innerHTML = manualPlayers.length === 0
    ? `<div class="no-data-placeholder" id="manual-bye-empty"><h3>Nil</h3></div>`
    : manualPlayers.map(p => buildPlayerCardMarkup(p)).join('');

  randomContainer.innerHTML = randomPlayers.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players</h3></div>`
    : randomPlayers.map(p => buildPlayerCardMarkup(p)).join('');

  enableCheckInDragDrop();
}
function enableCheckInDragDrop() {
  const manualList = document.getElementById('manual-bye-list');
  const randomList = document.getElementById('random-bye-list');
  const containers = [manualList, randomList];

  containers.forEach(container => {
    container.querySelectorAll('.app-card[data-card-id]').forEach(card => {
      let isDragging = false, longPressTimer = null;
      let placeholder = null;

      card.addEventListener('touchstart', () => {
        console.log("touchstart fired, card:", card.dataset.cardId);
        longPressTimer = setTimeout(() => {
          console.log("Long press activated");
          isDragging = true;
          card.classList.add('dragging');
          if (navigator.vibrate) navigator.vibrate(30);

          const rect = card.getBoundingClientRect();

          placeholder = document.createElement('div');
          placeholder.className = 'app-card';
          placeholder.style.opacity = '0.2';
          placeholder.style.height = card.offsetHeight + 'px';
          card.parentNode.insertBefore(placeholder, card.nextSibling);

          document.body.appendChild(card);
          card.style.position = 'fixed';
          card.style.width = rect.width + 'px';
          card.style.left = rect.left + 'px';
          card.style.top = rect.top + 'px';
          card.style.zIndex = 1000;
        }, 350);
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!isDragging) { clearTimeout(longPressTimer); return; }
        e.preventDefault();
        const touch = e.touches[0];
        card.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
        card.style.top = (touch.clientY - card.offsetHeight / 2) + 'px';
      
        // AUTO-SCROLL: if dragging near the top or bottom edge of the scrollable area, scroll automatically
        const scrollContainer = document.querySelector('.app-container');
        const edgeThreshold = 80; // px from edge that triggers scrolling
        const scrollSpeed = 12;
      
        if (scrollContainer) {
          if (touch.clientY < edgeThreshold) {
            scrollContainer.scrollTop -= scrollSpeed;
          } else if (touch.clientY > window.innerHeight - edgeThreshold) {
            scrollContainer.scrollTop += scrollSpeed;
          }
        }
      
        card.style.display = 'none';
        const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        card.style.display = '';
      
        const targetContainer = elBelow?.closest('#manual-bye-list, #random-bye-list');
        if (!targetContainer) return;
      
        const targetCard = elBelow.closest('.app-card[data-card-id]');
      
        if (targetCard && targetCard !== placeholder) {
          const box = targetCard.getBoundingClientRect();
          const midY = box.top + box.height / 2;
          if (touch.clientY < midY) {
            targetContainer.insertBefore(placeholder, targetCard);
          } else {
            targetContainer.insertBefore(placeholder, targetCard.nextSibling);
          }
        } else if (!targetContainer.querySelector('.app-card[data-card-id]')) {
          targetContainer.innerHTML = '';
          targetContainer.appendChild(placeholder);
        }
      }, { passive: false });

      card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (!isDragging) return;
        isDragging = false;

        card.classList.remove('dragging');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.width = '';
        card.style.zIndex = '';

        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.insertBefore(card, placeholder);
          placeholder.remove();
        }

        window.suppressNextCardClick = true;
        commitCheckInOrder();
      });
    });
  });
}

async function commitCheckInOrder() {
  const manualCards = Array.from(document.getElementById('manual-bye-list').querySelectorAll('.app-card[data-card-id]'));
  const randomCards = Array.from(document.getElementById('random-bye-list').querySelectorAll('.app-card[data-card-id]'));

  const manualIds = manualCards.map(c => c.dataset.cardId);
  const randomIds = randomCards.map(c => c.dataset.cardId);

  const payload = window.cachedUserUniverse;
  const updates = [];

  manualIds.forEach((pid, idx) => {
    const player = payload.players.find(p => p.PlayerID === pid);
    if (player) player.byeOrder = idx + 1;
    updates.push({ playerId: pid, byeOrder: idx + 1 });
  });

  randomIds.forEach(pid => {
    const player = payload.players.find(p => p.PlayerID === pid);
    if (player) player.byeOrder = null;
    updates.push({ playerId: pid, byeOrder: null });
  });

  try {
    await Promise.all(updates.map(u => window.updatePlayerByeOrderInFirestore(u.playerId, u.byeOrder)));
    console.log("Bye order saved to Firestore.");
  } catch (err) {
    console.error("Failed to save bye order:", err);
  }

  renderCheckInView(payload); // re-render to show updated sequence numbers
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

function switchPlayersTab(tabId) {
  document.querySelectorAll('#screen-players .top-tab-bar .tab-item').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('#screen-players .tab-viewport .tab-view').forEach(view => view.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');

  if (tabId === 'checkin') {
    renderCheckInView(window.cachedUserUniverse);
  } else if (tabId === 'availability') {
    renderAvailabilityView(window.cachedUserUniverse);
  }
}

function enableDragReorder(containerId, onReorderComplete) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let draggedEl = null, isDragging = false, startY = 0;

  container.addEventListener('click', (e) => {
    if (window.suppressNextCardClick) {
      e.stopImmediatePropagation();
      e.preventDefault();
      window.suppressNextCardClick = false;
    }
  }, true);

  container.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    let longPressTimer = null;

    card.addEventListener('touchstart', (e) => {
      longPressTimer = setTimeout(() => {
        isDragging = true;
        draggedEl = card;
        card.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(30);
      }, 350);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!isDragging) { clearTimeout(longPressTimer); return; }
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      draggedEl.style.transform = `translateY(${touchY - startY}px)`;

      const siblings = Array.from(container.querySelectorAll('.app-card:not(.dragging)'));
      for (const sib of siblings) {
        const box = sib.getBoundingClientRect();
        const mid = box.top + box.height / 2;
        if (touchY < mid && sib.previousElementSibling === draggedEl) {
          container.insertBefore(draggedEl, sib);
          draggedEl.style.transform = ''; startY = touchY; break;
        }
        if (touchY > mid && sib.nextElementSibling === draggedEl) {
          container.insertBefore(draggedEl, sib.nextElementSibling);
          draggedEl.style.transform = ''; startY = touchY; break;
        }
      }
    }, { passive: false });

    card.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
      if (!isDragging) return;
      isDragging = false;
      draggedEl.classList.remove('dragging');
      draggedEl.style.transform = '';
      window.suppressNextCardClick = true;

      const newOrder = Array.from(container.querySelectorAll('.app-card')).map(c => c.dataset.cardId);
      onReorderComplete(newOrder);
      draggedEl = null;
    });
  });
}

function renderAvailabilityView(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  const duprRanked = [...players].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const seedRankMap = {};
  duprRanked.forEach((p, idx) => {
    seedRankMap[p.PlayerID] = idx + 1;
  });

  const unavailablePlayers = players.filter(p => p.playerExclude === 'Yes');
  const availablePlayers = players.filter(p => p.playerExclude !== 'Yes');

  availablePlayers.sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const unavailableContainer = document.getElementById('unavailable-list');
  const availableContainer = document.getElementById('available-list');

  function buildAvailabilityPlayerCard(player) {
    const seedNumber = seedRankMap[player.PlayerID];
    const seedUrl = playerSeeds[0]['seed-' + seedNumber];
    const iconAsset = seedUrl || '🎾';

    const contentHtml = `
      <h3>${player.Name || 'Unnamed Player'} ${player.FirstName ? '(' + player.FirstName + ')' : ''}</h3>
      <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
    `;

    return buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID });
  }

  unavailableContainer.innerHTML = unavailablePlayers.length === 0
    ? `<div class="no-data-placeholder" id="unavailable-empty"><h3>Nil</h3></div>`
    : unavailablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  availableContainer.innerHTML = availablePlayers.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players</h3></div>`
    : availablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  enableAvailabilityDragDrop();
}

function enableAvailabilityDragDrop() {
  const unavailableList = document.getElementById('unavailable-list');
  const availableList = document.getElementById('available-list');
  const containers = [unavailableList, availableList];

  containers.forEach(container => {
    container.querySelectorAll('.app-card[data-card-id]').forEach(card => {
      let isDragging = false, longPressTimer = null;
      let placeholder = null;

      card.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => {
          isDragging = true;
          card.classList.add('dragging');
          if (navigator.vibrate) navigator.vibrate(30);

          const rect = card.getBoundingClientRect();

          placeholder = document.createElement('div');
          placeholder.className = 'app-card';
          placeholder.style.opacity = '0.2';
          placeholder.style.height = card.offsetHeight + 'px';
          card.parentNode.insertBefore(placeholder, card.nextSibling);

          document.body.appendChild(card);
          card.style.position = 'fixed';
          card.style.width = rect.width + 'px';
          card.style.left = rect.left + 'px';
          card.style.top = rect.top + 'px';
          card.style.zIndex = 1000;
        }, 350);
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!isDragging) { clearTimeout(longPressTimer); return; }
        e.preventDefault();
        const touch = e.touches[0];
        card.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
        card.style.top = (touch.clientY - card.offsetHeight / 2) + 'px';

        const scrollContainer = document.querySelector('.app-container');
        const edgeThreshold = 80;
        const scrollSpeed = 12;

        if (scrollContainer) {
          if (touch.clientY < edgeThreshold) {
            scrollContainer.scrollTop -= scrollSpeed;
          } else if (touch.clientY > window.innerHeight - edgeThreshold) {
            scrollContainer.scrollTop += scrollSpeed;
          }
        }

        card.style.display = 'none';
        const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        card.style.display = '';

        const targetContainer = elBelow?.closest('#unavailable-list, #available-list');
        if (!targetContainer) return;

        const targetCard = elBelow.closest('.app-card[data-card-id]');

        if (targetCard && targetCard !== placeholder) {
          const box = targetCard.getBoundingClientRect();
          const midY = box.top + box.height / 2;
          if (touch.clientY < midY) {
            targetContainer.insertBefore(placeholder, targetCard);
          } else {
            targetContainer.insertBefore(placeholder, targetCard.nextSibling);
          }
        } else if (!targetContainer.querySelector('.app-card[data-card-id]')) {
          targetContainer.innerHTML = '';
          targetContainer.appendChild(placeholder);
        }
      }, { passive: false });

      card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (!isDragging) return;
        isDragging = false;

        card.classList.remove('dragging');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.width = '';
        card.style.zIndex = '';

        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.insertBefore(card, placeholder);
          placeholder.remove();
        }

        window.suppressNextCardClick = true;
        commitAvailabilityStatus();
      });
    });
  });
}

async function commitAvailabilityStatus() {
  const unavailableIds = Array.from(document.getElementById('unavailable-list').querySelectorAll('.app-card[data-card-id]')).map(c => c.dataset.cardId);
  const availableIds = Array.from(document.getElementById('available-list').querySelectorAll('.app-card[data-card-id]')).map(c => c.dataset.cardId);

  const payload = window.cachedUserUniverse;
  const updates = [];

  unavailableIds.forEach(pid => {
    const player = payload.players.find(p => p.PlayerID === pid);
    if (player) player.playerExclude = 'Yes';
    updates.push({ playerId: pid, playerExclude: 'Yes' });
  });

  availableIds.forEach(pid => {
    const player = payload.players.find(p => p.PlayerID === pid);
    if (player) player.playerExclude = 'No';
    updates.push({ playerId: pid, playerExclude: 'No' });
  });

  try {
    await Promise.all(updates.map(u => window.updatePlayerExcludeInFirestore(u.playerId, u.playerExclude)));
    console.log("Player availability saved to Firestore.");
  } catch (err) {
    console.error("Failed to save player availability:", err);
  }

  renderAvailabilityView(payload);
}

function switchGenerateDrawTab(tabId) {
  document.querySelectorAll('#screen-generate-draw .top-tab-bar .tab-item').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('#screen-generate-draw .tab-viewport .tab-view').forEach(view => view.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');

  if (tabId === 'gd-available') {
    renderGenerateDrawAvailabilityView(window.cachedUserUniverse);
  }
}

async function renderDrawCards(payload) {
  console.log('Calling renderDrawCards');
  showLoadingState('active-draw-list', 'Loading draw...'); // NEW

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

    const team1 = formatTeamNames([
      playerMap[m.Team1Player1], playerMap[m.Team1Player2],
      playerMap[m.Team1Player3], playerMap[m.Team1Player4]
    ]);
    const team2 = formatTeamNames([
      playerMap[m.Team2Player1], playerMap[m.Team2Player2],
      playerMap[m.Team2Player3], playerMap[m.Team2Player4]
    ]);

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

function renderScoringToggle(currentValue) {
  document.querySelectorAll('.scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
  });
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
  refreshStandingsIfVisible(); // NEW
}

function saveMatchWinLoss(match) {
  window.updateMatchWinLossInFirestore(match.MatchID, match.Team1WinLoss, match.Team2WinLoss)
    .then(() => console.log("Win/Loss saved to Firestore."))
    .catch(err => console.error("Win/Loss save failed:", err));
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
  showLoadingState('current-round-list', 'Loading current round...'); // NEW
  
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
    updateLocalCurrentRoundCache(); // NEW — sync cache BEFORE render
    renderCurrentRoundView(window.cachedUserUniverse);
    persistCurrentRound();
  }
}

function goToPreviousRound() {
  if (window.currentRoundNumber > 1) {
    window.currentRoundNumber--;
    updateLocalCurrentRoundCache(); // NEW
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

