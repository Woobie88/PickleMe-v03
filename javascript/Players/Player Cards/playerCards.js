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

function buildCardMarkup({ iconAsset, contentHtml, onClickAttr = '', cardId = null, extraClass = '' }) {
  const iconMarkup = iconAsset.startsWith('http')
    ? `<img src="${iconAsset}" alt="Icon" class="card-icon-images" loading="lazy">`
    : `<span class="card-icon">${iconAsset}</span>`;

  const idAttr = cardId ? `data-card-id="${cardId}"` : '';

  return `
    <div class="app-card ${extraClass}" ${idAttr} ${onClickAttr}>
      <div class="card-icon-wrapper">${iconMarkup}</div>
      <div class="card-content">${contentHtml}</div>
      <span class="card-arrow">→</span>
    </div>
  `;
}

function renderEntityCards(options) {
  const {
    containerId,
    entityName,
    records,
    activeEventId,
    eventIdField = 'EventID',
    emptyMessage = 'No records found',
    getIcon,
    getContentHtml,
    getOnClick,
    getExtraClass = () => '', // NEW
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
    const extraClass = getExtraClass(record); // NEW
    cardsHtml += buildCardMarkup({ iconAsset, contentHtml, onClickAttr, extraClass });
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
  const duprLimit = parseFloat(activeEvent["DUPR Limit"]) || 0;

  const players = await window.fetchPlayersFromFirestore(payload.activeEventId, currentVersion);
  window.cachedUserUniverse.players = players;

  function getPlayerIssue(player) {
    if (player.playerExclude === 'Yes') {
      return { type: 'unavailable', message: 'Player Unavailable' };
    }
    if (!player.DUPRId || player.DUPRId === 'Not Found') {
      return { type: 'warning', message: 'DUPR ID Not Found' };
    }
    if (duprLimit > 0 && (parseFloat(player.DUPR) || 0) < duprLimit) {
      return { type: 'warning', message: `Below Event DUPR Limit (${duprLimit})` };
    }
    return null;
  }

  renderEntityCards({
    containerId: 'active-players-list',
    entityName: 'players',
    records: players,
    activeEventId: payload.activeEventId,
    emptyMessage: 'No Players Found',
    extraFilter: () => true,
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
    getExtraClass: (player) => { // NEW
      const issue = getPlayerIssue(player);
      if (!issue) return '';
      return issue.type === 'unavailable' ? 'player-unavailable' : 'dupr-warning';
    },
    getContentHtml: (player) => {
      const issue = getPlayerIssue(player);
      const secondLine = issue
        ? issue.message
        : `${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}`;

      return `
        <h3>${player.Name || 'Unnamed Player'}</h3>
        <p class="card-meta-line">${secondLine}</p>
      `;
    },
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
  }
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

window.currentPlayerDetailId = null;
window.currentPlayerDetailIndex = 0;
window.playerDetailMinIndex = 0;   // NEW — lower bound for swiping
window.playerDetailExitScreen = 'players'; // NEW — where boundary swipes exit to

function viewPlayerDetail(playerId) {
  window.currentPlayerDetailId = playerId;
  window.currentPlayerDetailIndex = 0;
  window.playerDetailMinIndex = 0;
  window.playerDetailExitScreen = 'players';
  renderPlayerDetailView();
  navigateToScreen('player-detail');
}

// NEW — entry point from a Standings card tap
function viewPlayerResultsFromStandings(playerId) {
  window.currentPlayerDetailId = playerId;
  window.currentPlayerDetailIndex = 2; // starts on Results Summary
  window.playerDetailMinIndex = 2;     // can't swipe back past Results Summary
  window.playerDetailExitScreen = 'standings'; // special-cased below
  renderPlayerDetailView();
  navigateToScreen('player-detail');
}

function renderPlayerDetailView() {
  const idx = window.currentPlayerDetailIndex;
  if (idx === 0) renderPlayerEditView();
  else if (idx === 1) renderPlayerSummaryView();
  else if (idx === 2) renderPlayerResultsSummaryView();
  else renderPlayerMatchesView();
}

function exitPlayerDetail() {
  if (window.playerDetailExitScreen === 'standings') {
    navigateToScreen('draw');
    switchDrawTab('standings');
  } else {
    navigateToScreen(window.playerDetailExitScreen);
  }
}

function goToNextPlayerDetailScreen() {
  if (window.currentPlayerDetailIndex < 3) {
    window.currentPlayerDetailIndex++;
    renderPlayerDetailView();
  } else {
    exitPlayerDetail();
  }
}

function goToPreviousPlayerDetailScreen() {
  if (window.currentPlayerDetailIndex > window.playerDetailMinIndex) { // CHANGED — respects the entry floor
    window.currentPlayerDetailIndex--;
    renderPlayerDetailView();
  } else {
    exitPlayerDetail();
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

  const isUnavailable = player.playerExclude === 'Yes';

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

      <div class="detail-form-group">
        <label>Player Unavailable</label>
        <div class="scoring-toggle" id="player-unavailable-toggle">
          <button class="scoring-option ${!isUnavailable ? 'active' : ''}" data-value="No" onclick="handlePlayerUnavailableToggle('No')">No</button>
          <button class="scoring-option unavailable-yes-btn ${isUnavailable ? 'active' : ''}" data-value="Yes" onclick="handlePlayerUnavailableToggle('Yes')">Yes</button>
        </div>
        <p class="card-meta-line" id="player-unavailable-message" style="color: #ef4444; ${isUnavailable ? '' : 'display: none;'}">
          This player will not be available to play in the draw.
        </p>
      </div>
    </div>

    <div class="fab-wrapper">
      <div class="fab-container" onclick="handleDeletePlayer()">
        <div class="fab-circle" style="background-color: #ef4444;">
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" zoomAndPan="magnify" viewBox="0 0 768 767.999994" height="1024" preserveAspectRatio="xMidYMid meet" version="1.0"><path fill="currentColor" d="M 565.921875 92.082031 L 498.382812 92.082031 L 498.382812 84.855469 C 498.382812 63.867188 493.980469 44.421875 486.875 30 C 477.886719 11.753906 464.085938 0.421875 447.648438 0.421875 L 319.5625 0.421875 C 303.125 0.421875 289.316406 11.746094 280.335938 30 C 273.242188 44.421875 268.828125 63.867188 268.828125 84.855469 L 268.828125 92.082031 L 99.867188 92.082031 C 74.800781 92.082031 54.273438 115.316406 54.273438 143.707031 L 54.273438 195.316406 L 712.945312 195.316406 L 712.945312 143.707031 C 712.945312 115.316406 692.433594 92.082031 667.351562 92.082031 Z M 104.992188 231.398438 L 143.476562 715.917969 C 144.121094 745.179688 161.660156 762.726562 196.121094 768.535156 C 321.117188 768.535156 383.621094 768.535156 383.621094 768.535156 C 383.621094 768.535156 446.121094 768.535156 571.117188 768.535156 C 605.570312 762.71875 623.109375 745.179688 623.753906 715.917969 L 662.25 231.398438 Z M 365.5625 352.386719 C 365.5625 342.425781 373.636719 334.34375 383.609375 334.34375 C 393.574219 334.34375 401.660156 342.417969 401.660156 352.386719 L 401.660156 647.554688 C 401.660156 657.515625 393.585938 665.601562 383.609375 665.601562 C 373.644531 665.601562 365.5625 657.527344 365.5625 647.554688 Z M 505.507812 350.980469 C 506.285156 341.054688 514.964844 333.644531 524.890625 334.421875 C 534.816406 335.195312 542.242188 343.875 541.464844 353.796875 L 518.015625 648.957031 C 517.238281 658.878906 508.558594 666.300781 498.632812 665.515625 C 488.707031 664.738281 481.292969 656.058594 482.058594 646.136719 Z M 225.757812 353.796875 C 224.980469 343.875 232.402344 335.195312 242.328125 334.421875 C 252.257812 333.644531 260.9375 341.054688 261.710938 350.980469 L 285.160156 646.144531 C 285.9375 656.070312 278.523438 664.746094 268.597656 665.523438 C 258.671875 666.300781 249.992188 658.886719 249.214844 648.964844 Z M 462.292969 92.082031 L 304.929688 92.082031 L 304.929688 84.855469 C 304.929688 69.332031 307.882812 55.570312 312.628906 45.925781 C 315.488281 40.117188 318.039062 36.5 319.574219 36.5 L 447.65625 36.5 C 449.191406 36.5 451.734375 40.105469 454.601562 45.925781 C 459.347656 55.570312 462.300781 69.332031 462.300781 84.855469 L 462.300781 92.082031 Z M 462.292969 92.082031 " fill-opacity="1" fill-rule="evenodd"/></svg>
        </div>
        <span class="fab-label">DELETE PLAYER</span>
      </div>
    </div>
  `;
}

function handlePlayerUnavailableToggle(value) {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  if (player) player.playerExclude = value;

  document.querySelectorAll('#player-unavailable-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });

  const messageEl = document.getElementById('player-unavailable-message');
  if (messageEl) messageEl.style.display = value === 'Yes' ? '' : 'none';

  window.updatePlayerFieldInFirestore(window.currentPlayerDetailId, 'playerExclude', value)
    .then(() => console.log("playerExclude saved:", value))
    .catch(err => console.error("Failed to save playerExclude:", err));
}

// Player match summary
function renderPlayerSummaryView() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  const container = document.getElementById('player-detail-content');
  if (!player) return;

  const allPlayerStats = computeAnalyticsPlayerCounts(window.cachedUserUniverse);
  const myStats = allPlayerStats.find(d => d.player.PlayerID === player.PlayerID);

  if (!myStats) {
    container.innerHTML = `<div class="no-data-placeholder"><h3>No Match Data Yet</h3></div>`;
    return;
  }

  const n = allPlayerStats.length || 1;
  const avg = {
    games: allPlayerStats.reduce((s, d) => s + d.roundsPlayed.size, 0) / n,
    byes: allPlayerStats.reduce((s, d) => s + d.byeRounds.length, 0) / n,
    uniquePartners: allPlayerStats.reduce((s, d) => s + d.uniquePartners, 0) / n,
    uniqueOpponents: allPlayerStats.reduce((s, d) => s + d.uniqueOpponents, 0) / n,
    maxSamePartner: allPlayerStats.reduce((s, d) => s + d.maxSamePartner, 0) / n,
    maxSameOpponent: allPlayerStats.reduce((s, d) => s + d.maxSameOpponent, 0) / n
  };

  const myGames = myStats.roundsPlayed.size;
  const myByes = myStats.byeRounds.length;
  const byeRoundsList = [...myStats.byeRounds].sort((a, b) => a - b);

  function buildTile(iconKey, iconColor, iconBg, label, value, avgValue, direction = 'neutral') {
    let comparisonHtml = avgValue !== null && avgValue !== undefined
      ? `<span style="color: var(--text-muted);">avg ${avgValue.toFixed(1)}</span>`
      : '';

    if (direction !== 'neutral' && avgValue !== null && avgValue !== undefined) {
      const diff = value - avgValue;
      if (Math.abs(diff) > 0.05) {
        const isBetter = direction === 'higherIsBetter' ? diff > 0 : diff < 0;
        const color = isBetter ? '#00E676' : '#ef4444';
        const arrow = diff > 0 ? '▲' : '▼';
        comparisonHtml = `<span style="color: ${color};">${arrow} ${Math.abs(diff).toFixed(1)} vs avg</span>`;
      }
    }

    return `
      <div class="stat-tile">
        <div class="stat-tile-header">
          <div class="stat-tile-icon" style="background-color: ${iconBg}; color: ${iconColor};">${STAT_ICONS[iconKey]}</div>
          <div class="stat-tile-label">${label}</div>
        </div>
        <div class="stat-tile-value">${value}</div>
        <div class="stat-tile-comparison">${comparisonHtml}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="welcome-banner"><h2>${player.Name || 'Unnamed'} — Summary</h2></div>
    <div class="stat-dashboard-grid">
      ${buildTile('games', '#3b82f6', 'rgba(59,130,246,0.2)', 'Games', myGames, avg.games)}
      ${buildTile('byes', '#64748b', 'rgba(100,116,139,0.2)', 'Byes', myByes, avg.byes)}
      ${buildTile('uniquePartners', '#00E676', 'rgba(0,230,118,0.2)', 'Unique Partners', myStats.uniquePartners, avg.uniquePartners, 'higherIsBetter')}
      ${buildTile('uniqueOpponents', '#3b82f6', 'rgba(59,130,246,0.2)', 'Unique Opponents', myStats.uniqueOpponents, avg.uniqueOpponents, 'higherIsBetter')}
      ${buildTile('maxPartners', '#f59e0b', 'rgba(245,158,11,0.2)', 'Max Same Partner', myStats.maxSamePartner, avg.maxSamePartner, 'lowerIsBetter')}
      ${buildTile('maxOpponents', '#ef4444', 'rgba(239,68,68,0.2)', 'Max Same Opponent', myStats.maxSameOpponent, avg.maxSameOpponent, 'lowerIsBetter')}

      <div class="stat-tile stat-tile-wide">
        <div class="stat-tile-header">
          <div class="stat-tile-icon" style="background-color: rgba(100,116,139,0.2); color: #64748b;">${STAT_ICONS.byeRounds}</div>
          <div class="stat-tile-label">Bye Rounds</div>
        </div>
        <div class="stat-tile-value" style="font-size: 1.1rem;">${byeRoundsList.length > 0 ? byeRoundsList.join(', ') : 'None'}</div>
      </div>
    </div> 
    <div class="stat-tile stat-tile-wide">
      <div class="stat-tile-header">
        <div class="stat-tile-icon" style="background-color: rgba(100,116,139,0.2); color: #64748b;">${STAT_ICONS.matches}</div>
        <div class="stat-tile-label">Partners & Opponents</div>
      </div>
      <div style="padding: 16px; height: 400px; position: relative;">
        <canvas id="player-partner-opponent-chart"></canvas>
      </div>
    </div>   
  `;

  renderPlayerPartnerOpponentChart(myStats); // NEW
}

window.playerSummaryChartInstance = null;

function renderPlayerPartnerOpponentChart(myStats) {
  const canvas = document.getElementById('player-partner-opponent-chart');
  if (!canvas) return;

  if (window.playerSummaryChartInstance) {
    window.playerSummaryChartInstance.destroy();
    window.playerSummaryChartInstance = null;
  }

  // Combine partner + opponent IDs into one label set for the chart
  const allIds = new Set([...Object.keys(myStats.partnerCounts), ...Object.keys(myStats.opponentCounts)]);
  const idList = [...allIds];

  if (idList.length === 0) {
    return; // no partners/opponents yet, nothing to chart
  }

  const labels = idList.map(pid => {
    const p = window.cachedUserUniverse.players.find(pl => pl.PlayerID === pid);
    return p ? (p.FirstName || 'Unnamed') : pid;
  });

  window.playerSummaryChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Partner', data: idList.map(pid => myStats.partnerCounts[pid] || 0), backgroundColor: '#00E676' },
        { label: 'Opponent', data: idList.map(pid => myStats.opponentCounts[pid] || 0), backgroundColor: '#3b82f6' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label(ctx) {
              const pid = idList[ctx.dataIndex];
              const isPartner = ctx.datasetIndex === 0;
              const rounds = isPartner ? myStats.partnerRounds[pid] : myStats.opponentRounds[pid];
              return rounds && rounds.length > 0
                ? rounds.sort((a, b) => a - b).map(r => `Round ${r}`)
                : ['No games'];
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
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

      const team1Ids = [match.Team1Player1, match.Team1Player2, match.Team1Player3, match.Team1Player4];
      const team2Ids = [match.Team2Player1, match.Team2Player2, match.Team2Player3, match.Team2Player4];

      const team1Names = formatTeamNames(team1Ids.map(id => playerMap[id]));
      const team2Names = formatTeamNames(team2Ids.map(id => playerMap[id]));

      const isComplete = match.Team1WinLoss && match.Team2WinLoss;

      let metaLine;
      if (isComplete) {
        metaLine = `Score ${match.Team1Score} - ${match.Team2Score} || Exp Res. ${match.ExpectedTeam1Score} - ${match.ExpectedTeam2Score}`;
      } else {
        const duprDelta = Math.abs((parseFloat(match.Team1AvgDUPR) || 0) - (parseFloat(match.Team2AvgDUPR) || 0)).toFixed(2);
        metaLine = `DUPR Diff ${duprDelta} || Exp Res. ${match.ExpectedTeam1Score} - ${match.ExpectedTeam2Score}`;
      }

      const contentHtml = `<h4>${team1Names} vs. ${team2Names}</h4><p class="card-meta-line">${metaLine}</p>`;
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

// Delete player
async function handleDeletePlayer() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  if (!player) return;

  const confirmed = confirm(`Permanently delete ${player.Name || 'this player'}? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await window.deletePlayerInFirestore(player.PlayerID);

    // Remove from local cache
    window.cachedUserUniverse.players = window.cachedUserUniverse.players.filter(p => p.PlayerID !== player.PlayerID);

    alert("Player deleted successfully.");
    navigateToScreen('players');
  } catch (err) {
    console.error("Failed to delete player:", err);
    alert("Failed to delete player — check the console for details.");
  }
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

// Player results
function renderPlayerResultsSummaryView() {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === window.currentPlayerDetailId);
  const container = document.getElementById('player-detail-content');
  if (!player) return;

  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = window.cachedUserUniverse.draw || [];
  const allPlayers = window.cachedUserUniverse.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion)
  );

  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';
  const ranked = rankPlayersByLadderCriteria(allPlayers, matches, ladderScoringMode);

  const rank = ranked.findIndex(r => r.player.PlayerID === player.PlayerID) + 1;
  const entry = ranked.find(r => r.player.PlayerID === player.PlayerID);
  const stats = entry?.stats || { games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  const points = entry ? calculateLadderPoints(entry.stats, ladderScoringMode) : 0;

  const n = ranked.length || 1;
  const avgWins = ranked.reduce((s, r) => s + r.stats.wins, 0) / n;
  const avgPointsFor = ranked.reduce((s, r) => s + r.stats.pointsFor, 0) / n;
  const avgPointsAgainst = ranked.reduce((s, r) => s + r.stats.pointsAgainst, 0) / n;

  function buildTile(iconKey, iconColor, iconBg, label, value, avgValue = null, direction = 'neutral') {
    let comparisonHtml = '';
    if (avgValue !== null) {
      comparisonHtml = `<span style="color: var(--text-muted);">avg ${avgValue.toFixed(1)}</span>`;
      if (direction !== 'neutral') {
        const diff = value - avgValue;
        if (Math.abs(diff) > 0.05) {
          const isBetter = direction === 'higherIsBetter' ? diff > 0 : diff < 0;
          const color = isBetter ? '#00E676' : '#ef4444';
          const arrow = diff > 0 ? '▲' : '▼';
          comparisonHtml = `<span style="color: ${color};">${arrow} ${Math.abs(diff).toFixed(1)} vs avg</span>`;
        }
      }
    }

    return `
      <div class="stat-tile">
        <div class="stat-tile-header">
          <div class="stat-tile-icon" style="background-color: ${iconBg}; color: ${iconColor};">${STAT_ICONS[iconKey]}</div>
          <div class="stat-tile-label">${label}</div>
        </div>
        <div class="stat-tile-value">${value}</div>
        <div class="stat-tile-comparison">${comparisonHtml}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="welcome-banner"><h2>${player.Name || 'Unnamed'} — Results</h2></div>
    <div class="stat-dashboard-grid">
      <div class="stat-tile stat-tile-wide" style="align-items: center; text-align: center;">
        <div class="stat-tile-icon" style="background-color: rgba(100,116,139,0.2); color: #f59e0b;">${STAT_ICONS.rank}</div>
        <div class="stat-tile-label">Rank</div>
        <div class="stat-tile-value" style="font-size: 2.5rem; color: #f59e0b;">#${rank}</div>
      </div>

      ${buildTile('games', '#3b82f6', 'rgba(59,130,246,0.2)', 'Games Played', stats.games)}
      ${buildTile('points', '#f59e0b', 'rgba(245,158,11,0.2)', 'Points', points)}
      ${buildTile('wins', '#00E676', 'rgba(0,230,118,0.2)', 'Wins', stats.wins, avgWins, 'higherIsBetter')}
      ${buildTile('losses', '#ef4444', 'rgba(239,68,68,0.2)', 'Losses', stats.losses)}
      ${buildTile('pointsFor', '#00E676', 'rgba(0,230,118,0.2)', 'Points For', stats.pointsFor, avgPointsFor, 'higherIsBetter')}
      ${buildTile('pointsAgainst', '#ef4444', 'rgba(239,68,68,0.2)', 'Points Against', stats.pointsAgainst, avgPointsAgainst, 'lowerIsBetter')}
      <div class="stat-tile stat-tile-wide">
        <div class="stat-tile-header">
          <div class="stat-tile-icon" style="background-color: rgba(100,116,139,0.2); color: #64748b;">${STAT_ICONS.matches}</div>
          <div class="stat-tile-label">Partners & Opponents</div>
        </div>
        <div style="padding: 16px; height: 400px; position: relative;">
          <canvas id="player-win-loss-chart"></canvas>
        </div>
      </div> 
    </div>  
  `;

  renderPlayerWinLoss(stats); // NEW
}

function renderPlayerWinLoss(myStats) {
  console.log("stats are",myStats);
  const canvas = document.getElementById('player-win-loss-chart');
  if (!canvas) return;

  if (window.playerSummaryChartInstance) {
    window.playerSummaryChartInstance.destroy();
    window.playerSummaryChartInstance = null;
  }

  // Combine partner + opponent IDs into one label set for the chart
  const allIds = new Set([...Object.keys(myStats.partnerCounts), ...Object.keys(myStats.opponentCounts)]);
  const idList = [...allIds];

  if (idList.length === 0) {
    return; // no partners/opponents yet, nothing to chart
  }

  const labels = idList.map(pid => {
    const p = window.cachedUserUniverse.players.find(pl => pl.PlayerID === pid);
    return p ? (p.FirstName || 'Unnamed') : pid;
  });

  window.playerSummaryChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Partner', data: idList.map(pid => myStats.partnerCounts[pid] || 0), backgroundColor: '#00E676' },
        { label: 'Opponent', data: idList.map(pid => myStats.opponentCounts[pid] || 0), backgroundColor: '#ef4444' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label(ctx) {
              const pid = idList[ctx.dataIndex];
              const isPartner = ctx.datasetIndex === 0;
              const rounds = isPartner ? myStats.partnerRounds[pid] : myStats.opponentRounds[pid];
              return rounds && rounds.length > 0
                ? rounds.sort((a, b) => a - b).map(r => `Round ${r}`)
                : ['No games'];
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}