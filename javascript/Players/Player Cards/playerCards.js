/**
 * ============================================================
 * PLAYER CARDS
 * Covers: shared card-building utilities, the Players screen
 * (roster, seed ranking), Check In (manual/random bye order),
 * Availability (excluded/included players), and the Generate
 * Draw screen's Details/Available tabs (draw config + reuses
 * Availability rendering).
 * ============================================================
 */

// ---------- SHARED UTILITIES (used by both Player Cards and Draw Cards) ----------

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

// ---------- CHECK IN (manual/random bye order) ----------

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

// ---------- PLAYERS SCREEN (roster list) ----------

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
}

function switchPlayersTab(tabId) {
  document.querySelectorAll('#screen-players .top-tab-bar .tab-item').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('#screen-players .tab-viewport .tab-view').forEach(view => view.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');

  if (tabId === 'checkin') {
    renderCheckInView(window.cachedUserUniverse);
  } else if (tabId === 'availability') {
    renderAvailabilityView(window.cachedUserUniverse); // uses defaults: 'unavailable-list', 'available-list'
  }
}

// ---------- AVAILABILITY (excluded / included players) ----------
// Generalized so both the Players screen and the Generate Draw screen's
// Available tab can call this with their own container IDs.

function renderAvailabilityView(payload, unavailableContainerId = 'unavailable-list', availableContainerId = 'available-list') {
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

  const unavailableContainer = document.getElementById(unavailableContainerId);
  const availableContainer = document.getElementById(availableContainerId);

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
    ? `<div class="no-data-placeholder"><h3>Nil</h3></div>`
    : unavailablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  availableContainer.innerHTML = availablePlayers.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players</h3></div>`
    : availablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  enableAvailabilityDragDrop(unavailableContainerId, availableContainerId);
}

function enableAvailabilityDragDrop(unavailableContainerId = 'unavailable-list', availableContainerId = 'available-list') {
  const unavailableList = document.getElementById(unavailableContainerId);
  const availableList = document.getElementById(availableContainerId);
  const containers = [unavailableList, availableList];
  const containerSelector = `#${unavailableContainerId}, #${availableContainerId}`;

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

        const targetContainer = elBelow?.closest(containerSelector);
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
        commitAvailabilityStatus(unavailableContainerId, availableContainerId);
      });
    });
  });
}

async function commitAvailabilityStatus(unavailableContainerId = 'unavailable-list', availableContainerId = 'available-list') {
  const unavailableIds = Array.from(document.getElementById(unavailableContainerId).querySelectorAll('.app-card[data-card-id]')).map(c => c.dataset.cardId);
  const availableIds = Array.from(document.getElementById(availableContainerId).querySelectorAll('.app-card[data-card-id]')).map(c => c.dataset.cardId);

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

  renderAvailabilityView(payload, unavailableContainerId, availableContainerId);
}

// ---------- GENERATE DRAW SCREEN: Details + Available tabs ----------
// (Teams tab, if any, and the actual draw generation call live in
// drawGenerator.js / drawCards.js — this covers the config UI only.)

function switchGenerateDrawTab(tabId) {
  document.querySelectorAll('#screen-generate-draw .top-tab-bar .tab-item').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('#screen-generate-draw .tab-viewport .tab-view').forEach(view => view.classList.remove('active'));

  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('view-' + tabId).classList.add('active');

  if (tabId === 'gd-details') {
    renderGenerateDrawDetails(window.cachedUserUniverse);
  } else if (tabId === 'gd-available') {
    renderAvailabilityView(window.cachedUserUniverse, 'gd-unavailable-list', 'gd-available-list');
  }
}

// NOTE: this function appears to be dead code — switchGenerateDrawTab (above)
// calls the generalized renderAvailabilityView() instead, which already covers
// the Generate Draw screen's Available tab via its container-ID parameters.
// Kept as-is since it was present in the source file, but likely safe to remove.
function renderGenerateDrawAvailabilityView(payload) {
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

  const unavailableContainer = document.getElementById('gd-unavailable-list');
  const availableContainer = document.getElementById('gd-available-list');

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
    ? `<div class="no-data-placeholder"><h3>Nil</h3></div>`
    : unavailablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  availableContainer.innerHTML = availablePlayers.length === 0
    ? `<div class="no-data-placeholder"><h3>No Players</h3></div>`
    : availablePlayers.map(p => buildAvailabilityPlayerCard(p)).join('');

  // NOTE: enableGenerateDrawAvailabilityDragDrop() is called here but is not
  // defined anywhere in the source file — calling this function as-is will throw.
  enableGenerateDrawAvailabilityDragDrop();
}

function renderGenerateDrawDetails(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('gd-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';
  document.getElementById('gd-game-type').innerText = gameProfile?.GamesGroup || '—';

  // --- Number Of Rounds ---
  const roundsSupported = gameProfile?.Rounds === 'Yes';
  let roundsValue;

  if (roundsSupported) {
    roundsValue = parseInt(activeEvent?.NumberofRound) || 1;
  } else {
    roundsValue = 1;
  }

  document.getElementById('gd-rounds-value').innerText = roundsValue;
  document.getElementById('gd-rounds-hidden').value = roundsValue;

  // Rounds field is always visible, but only editable when the game supports it
  document.querySelectorAll('#gd-rounds-group .score-btn').forEach(btn => {
    btn.disabled = !roundsSupported;
    btn.style.opacity = roundsSupported ? '1' : '0.4';
  });

  // --- Number Of Lives ---
  const livesSupported = gameProfile?.Lives === 'Yes';
  const livesGroup = document.getElementById('gd-lives-group');

  if (livesSupported) {
    livesGroup.style.display = '';
    const livesValue = parseInt(activeEvent?.Lives) || 1;
    document.getElementById('gd-lives-value').innerText = livesValue;
    document.getElementById('gd-lives-hidden').value = livesValue;
  } else {
    livesGroup.style.display = 'none';
  }
}

function adjustGdRounds(direction) {
  const hiddenInput = document.getElementById('gd-rounds-hidden');
  const displaySpan = document.getElementById('gd-rounds-value');

  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);

  hiddenInput.value = current;
  displaySpan.innerText = current;

  saveGdRounds(current);
}

function adjustGdLives(direction) {
  const hiddenInput = document.getElementById('gd-lives-hidden');
  const displaySpan = document.getElementById('gd-lives-value');

  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);

  hiddenInput.value = current;
  displaySpan.innerText = current;

  saveGdLives(current);
}

async function saveGdRounds(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  if (activeEvent) activeEvent.NumberofRound = value;

  try {
    await window.updateEventFieldInFirestore(activeEventId, 'NumberofRound', value);
  } catch (err) {
    console.error("Failed to save NumberofRound:", err);
  }
}

async function saveGdLives(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  if (activeEvent) activeEvent.Lives = value;

  try {
    await window.updateEventFieldInFirestore(activeEventId, 'Lives', value);
  } catch (err) {
    console.error("Failed to save Lives:", err);
  }
}

// ---------- BUTTON CALL: kicks off draw generation (defined in drawGenerator.js) ----------
async function handleBuildDraw() {
  const numberOfRounds = parseInt(document.getElementById('gd-rounds-hidden').value) || 1;

  try {
    const matches = await generateNRoundsAndPreview(numberOfRounds);
    alert(`Draw generated successfully — ${matches.length} matches created.`);
    navigateToScreen('dashboard');
  } catch (err) {
    console.error("Draw generation failed:", err);
    alert("Draw generation failed — check the console for details.");
  }
}
