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

// Player detail cards
window.currentPlayerDetailId = null;
window.currentPlayerDetailIndex = 0; // 0=edit, 1=summary, 2=matches

function viewPlayerDetail(playerId) {
  window.currentPlayerDetailId = playerId;
  window.currentPlayerDetailIndex = 0;
  renderPlayerDetailView();
  navigateToScreen('player-detail');
}

function renderPlayerDetailView() {
  const idx = window.currentPlayerDetailIndex;
  if (idx === 0) renderPlayerEditView();
  else if (idx === 1) renderPlayerSummaryView();
  else renderPlayerMatchesView();
}

function goToNextPlayerDetailScreen() {
  if (window.currentPlayerDetailIndex < 2) {
    window.currentPlayerDetailIndex++;
    renderPlayerDetailView();
  } else {
    // Already on the Draw screen (index 2) — swiping forward exits to Player Roster
    navigateToScreen('players');
  }
}

function goToPreviousPlayerDetailScreen() {
  if (window.currentPlayerDetailIndex > 0) {
    window.currentPlayerDetailIndex--;
    renderPlayerDetailView();
  } else {
    // Already on the Edit screen (index 0) — swiping back exits to Player Roster
    navigateToScreen('players');
  }
}

function initPlayerDetailSwipeHandlers() {
  const container = document.getElementById('screen-player-detail');
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

    if (deltaX < 0) goToNextPlayerDetailScreen(); // swipe left = next
    else goToPreviousPlayerDetailScreen(); // swipe right = back
  });
}

// Player details -- name, dupr, etc
function renderPlayerEditView() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  const container = document.getElementById('player-detail-content');
  if (!player) { container.innerHTML = `<div class="no-data-placeholder"><h3>Player Not Found</h3></div>`; return; }

  container.innerHTML = `
    <div class="welcome-banner"><h2>Edit Player</h2></div>
    <div class="detail-view-container">
      <div class="detail-form-group">
        <label>Name</label>
        <input type="text" class="detail-input" value="${player.Name || ''}" oninput="handlePlayerFieldEdit('Name', this.value)">
      </div>
      <div class="detail-form-group">
        <label>First Name</label>
        <input type="text" class="detail-input" value="${player.FirstName || ''}" oninput="handlePlayerFieldEdit('FirstName', this.value)">
      </div>
      <div class="detail-form-group">
        <label>DUPR ID</label>
        <input type="text" class="detail-input" value="${player.DUPRId || ''}" oninput="handlePlayerFieldEdit('DUPRId', this.value)">
      </div>
      <div class="detail-form-group">
        <label>DUPR Rating</label>
        <input type="number" step="0.01" class="detail-input" value="${player.DUPR || ''}" oninput="handlePlayerFieldEdit('DUPR', parseFloat(this.value) || 0)">
      </div>
    </div>
  `;
}

let playerFieldSaveTimer = null;
function handlePlayerFieldEdit(field, value) {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  if (player) player[field] = value;

  clearTimeout(playerFieldSaveTimer);
  playerFieldSaveTimer = setTimeout(() => {
    window.updatePlayerFieldInFirestore(window.currentPlayerDetailId, field, value)
      .then(() => console.log(`Saved ${field}`))
      .catch(err => console.error(`Failed to save ${field}:`, err));
  }, 600);
}

// Player match summary
function renderPlayerSummaryView() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  const matches = window.cachedUserUniverse.draw || [];
  const container = document.getElementById('player-detail-content');
  if (!player) return;

  let games = 0, byes = 0;
  const partners = {}, opponents = {};
  const allRounds = new Set(matches.map(m => m.Round));
  const roundsPlayed = new Set();

  matches.forEach(m => {
    const t1 = [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4].filter(Boolean);
    const t2 = [m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4].filter(Boolean);
    const onT1 = t1.includes(player.PlayerID);
    const onT2 = t2.includes(player.PlayerID);
    if (!onT1 && !onT2) return;

    games++;
    roundsPlayed.add(m.Round);
    const myTeam = onT1 ? t1 : t2;
    const oppTeam = onT1 ? t2 : t1;
    myTeam.forEach(pid => { if (pid !== player.PlayerID) partners[pid] = (partners[pid] || 0) + 1; });
    oppTeam.forEach(pid => { opponents[pid] = (opponents[pid] || 0) + 1; });
  });

  allRounds.forEach(r => { if (!roundsPlayed.has(r)) byes++; });

  const uniquePartners = Object.keys(partners).length;
  const uniqueOpponents = Object.keys(opponents).length;
  const maxSamePartner = Math.max(0, ...Object.values(partners));
  const maxSameOpponent = Math.max(0, ...Object.values(opponents));

  container.innerHTML = `
    <div class="welcome-banner"><h2>${player.Name || 'Unnamed'} — Summary</h2></div>
    <div class="detail-view-container">
      <div class="detail-form-group"><label>Games</label><div class="detail-readonly">${games}</div></div>
      <div class="detail-form-group"><label>Byes</label><div class="detail-readonly">${byes}</div></div>
      <div class="detail-form-group"><label>Unique Partners</label><div class="detail-readonly">${uniquePartners}</div></div>
      <div class="detail-form-group"><label>Unique Opponents</label><div class="detail-readonly">${uniqueOpponents}</div></div>
      <div class="detail-form-group"><label>Max Same Partner</label><div class="detail-readonly">${maxSamePartner}</div></div>
      <div class="detail-form-group"><label>Max Same Opponent</label><div class="detail-readonly">${maxSameOpponent}</div></div>
    </div>
  `;
}

// Player matches
function renderPlayerMatchesView() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  const matches = window.cachedUserUniverse.draw || [];
  const container = document.getElementById('player-detail-content');
  if (!player) return;

  const playerMap = {};
  (window.cachedUserUniverse.players || []).forEach(p => { playerMap[p.PlayerID] = p.FirstName; });

  const playerMatches = matches.filter(m => {
    const all = [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4, m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4];
    return all.includes(player.PlayerID);
  });

  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))].sort((a, b) => a - b);

  let html = `<div class="welcome-banner"><h2>${player.Name || 'Unnamed'} — Draw</h2></div><div class="card-grid">`;

  allRounds.forEach(round => {
    html += `<div class="event-section-title">Round ${round}</div>`;
    const match = playerMatches.find(m => parseInt(m.Round) === round);

    if (match) {
      const iconAsset = courts[0]['court-' + match.Court] || '🏟️';
      const allTeam1 = [match.Team1Player1, match.Team1Player2, match.Team1Player3, match.Team1Player4];
      const onTeam1 = allTeam1.includes(player.PlayerID);
      const myTeamIds = onTeam1 ? allTeam1 : [match.Team2Player1, match.Team2Player2, match.Team2Player3, match.Team2Player4];
      const oppTeamIds = onTeam1 ? [match.Team2Player1, match.Team2Player2, match.Team2Player3, match.Team2Player4] : allTeam1;

      const myTeamNames = formatTeamNames(myTeamIds.map(id => playerMap[id]));
      const oppTeamNames = formatTeamNames(oppTeamIds.map(id => playerMap[id]));

      const isComplete = match.Team1WinLoss && match.Team2WinLoss;
      const myScore = onTeam1 ? match.Team1Score : match.Team2Score;
      const oppScore = onTeam1 ? match.Team2Score : match.Team1Score;
      const metaLine = isComplete ? `Score ${myScore} - ${oppScore}` : `Court ${match.Court}`;

      const contentHtml = `<h4>${myTeamNames} vs. ${oppTeamNames}</h4><p class="card-meta-line">${metaLine}</p>`;
      const onClickAttr = `onclick="openMatchScoreView('${match.MatchID}')"`;
      html += buildCardMarkup({ iconAsset, contentHtml, onClickAttr });
    } else {
      const contentHtml = `<h4>Bye</h4><p class="card-meta-line">No match this round</p>`;
      html += buildCardMarkup({ iconAsset: byeImage, contentHtml });
    }
  });

  html += `</div>`;
  container.innerHTML = html;
}
