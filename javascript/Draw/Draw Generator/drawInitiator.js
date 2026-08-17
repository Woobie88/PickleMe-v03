// NOTE: this function appears to be dead code — switchGenerateDrawTab (above)
// calls the generalized renderAvailabilityView() instead, which already covers
// the Generate Draw screen's Available tab via its container-ID parameters.
// Kept as-is since it was present in the source file, but likely safe to remove.
function renderGenerateDrawDetails(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('gd-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';
  // gd-game-type row removed entirely — no longer set

  // --- Number Of Rounds / Round Limit ---
  const isProgressive = gameProfile?.GamesGroup === 'Progressive';
  const roundsSupported = gameProfile?.Rounds === 'Yes' || isProgressive;

  let roundsValue = roundsSupported ? (parseInt(activeEvent?.NumberofRound) || 1) : 1;

  document.getElementById('gd-rounds-value').innerText = roundsValue;
  document.getElementById('gd-rounds-hidden').value = roundsValue;

  const roundsLabel = document.querySelector('#gd-rounds-group label');
  if (roundsLabel) {
    roundsLabel.innerText = isProgressive ? 'Round Limit' : 'Number Of Rounds';
  }

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

  // --- Number Of Teams / Pools / Divisions ---
  const grouping = gameProfile?.Grouping || 'None';
  const groupingLabels = {
    'Teams': 'Number Of Teams',
    'Pools': 'Number Of Pools',
    'Divisions': 'Number Of Divisions'
  };

  const teamsGroup = document.getElementById('gd-teams-group');
  const teamsLabel = document.getElementById('gd-teams-label');

  if (groupingLabels[grouping]) {
    teamsGroup.style.display = '';
    teamsLabel.innerText = groupingLabels[grouping];

    const teamsValue = Math.max(2, parseInt(activeEvent?.NumberOfTeams) || 2);
    document.getElementById('gd-teams-value').innerText = teamsValue;
    document.getElementById('gd-teams-hidden').value = teamsValue;

    if ((parseInt(activeEvent?.NumberOfTeams) || 0) < 2) {
      activeEvent.NumberOfTeams = teamsValue;
      window.updateEventFieldInFirestore(activeEventId, 'NumberOfTeams', teamsValue);
    }
  } else {
    teamsGroup.style.display = 'none';
  }

  ensureTeamsDefaultForGame(activeEventId, gameProfile);

  // --- NEW: All Players Present toggle ---
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  const anyExcluded = players.some(p => p.playerExclude === 'Yes');
  const computedDefault = anyExcluded ? 'No' : 'Yes';

  // Use a stored override if the organizer already explicitly set one this session; otherwise use the computed default
  const currentValue = activeEvent.AllPlayersPresent || computedDefault;

  document.querySelectorAll('#gd-all-present-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
  });

  window.gdAllPlayersPresentValue = currentValue; // stored for handleTeamsNext/routing decision later

  updateDetailsNextButtonLabel();
}

function updateDetailsNextButtonLabel() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const grouping = gameProfile?.Grouping || 'None';
  const needsTeamsScreen = ['Teams', 'Pools', 'Pairs', 'Divisions'].includes(grouping);

  const btn = document.getElementById('gd-details-next-btn'); // needs an id on the button — see HTML note below
  if (!btn) return;

  if (needsTeamsScreen) {
    btn.innerText = 'Next';
  } else {
    btn.innerText = window.gdAllPlayersPresentValue === 'Yes' ? 'Build Draw' : 'Next';
  }
}

async function ensureTeamsDefaultForGame(activeEventId, gameProfile) {
  const grouping = gameProfile?.Grouping || 'None';
  const groupingRequiresField = ['Teams', 'Pools', 'Divisions'].includes(grouping);

  if (!groupingRequiresField) {
    const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
    if (activeEvent && activeEvent.NumberOfTeams !== 1) {
      activeEvent.NumberOfTeams = 1;
      await window.updateEventFieldInFirestore(activeEventId, 'NumberOfTeams', 1);
    }
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

function adjustGdTeams(direction) {
  const hiddenInput = document.getElementById('gd-teams-hidden');
  const displaySpan = document.getElementById('gd-teams-value');

  let current = parseInt(hiddenInput.value) || 2;
  current = Math.max(2, current + direction); // minimum 2 — already correct

  hiddenInput.value = current;
  displaySpan.innerText = current;

  saveGdTeams(current);
}

async function saveGdTeams(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  if (activeEvent) activeEvent.NumberOfTeams = value;

  try {
    await window.updateEventFieldInFirestore(activeEventId, 'NumberOfTeams', value);
  } catch (err) {
    console.error("Failed to save NumberOfTeams:", err);
  }
}

// DETERMINE NEXT ACTION FROM INITIAL DRAW CONDITIONS
function handleDetailsNext() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const grouping = gameProfile?.Grouping || 'None';
  const needsTeamsScreen = ['Teams', 'Pools', 'Pairs', 'Divisions'].includes(grouping);

  if (needsTeamsScreen) {
    navigateToScreen('generate-draw-teams');
  } else {
    routeToAvailabilityOrBuild();
  }
}

function routeToAvailabilityOrBuild() {
  if (window.gdAllPlayersPresentValue === 'Yes') {
    handleBuildDraw(); // bypass Availability entirely
  } else {
    navigateToScreen('generate-draw-available');
  }
}

// RENDER TEAMS / DIVISIONS
window.gdDraftType = '3rr'; // default, per spec

function computePlayersPerGroup(numPlayers, numGroups) {
  const base = Math.floor(numPlayers / numGroups);
  const remainder = numPlayers % numGroups;
  const counts = new Array(numGroups).fill(base);
  // ASSUMPTION: remainder players go to the first (highest) groups — flag if this should be reversed
  for (let i = 0; i < remainder; i++) {
    counts[i] += 1;
  }
  return counts;
}

function buildDraftPickOrder(numberOfGroups, playersPerGroup) {
  const maxRounds = Math.max(...playersPerGroup);
  const order = [];

  for (let round = 0; round < maxRounds; round++) {
    let direction;
    if (window.gdDraftType === 'snake') {
      direction = (round % 2 === 0) ? 'F' : 'B';
    } else {
      // 3rd Round Reversal: R1 forward, R2 backward, R3 also backward (no reversal), then resume alternating
      if (round === 0) direction = 'F';
      else if (round === 1) direction = 'B';
      else direction = (round % 2 === 0) ? 'B' : 'F';
    }

    let groupOrder = [...Array(numberOfGroups).keys()];
    if (direction === 'B') groupOrder = groupOrder.reverse();

    groupOrder.forEach(groupIdx => {
      if (round < playersPerGroup[groupIdx]) {
        order.push(groupIdx);
      }
    });
  }

  return order;
}

function setGdDraftType(type) {
  window.gdDraftType = type;
  document.querySelectorAll('#gd-draft-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === type);
  });
  renderGenerateDrawTeams(window.cachedUserUniverse); // re-render assignment with new draft order
}

function renderGenerateDrawTeams(payload, ids = {}) {
  const {
    headingId = 'gd-teams-screen-heading',
    draftToggleBlockId = 'gd-draft-toggle-block',
    draftToggleId = 'gd-draft-toggle',
    groupsListId = 'gd-teams-groups-list',
    nextBtnId = 'gd-teams-next-btn',
    allPlayersPresentVar = 'gdAllPlayersPresentValue'
  } = ids;

  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const grouping = gameProfile?.Grouping || 'None';
  const draftSupported = gameProfile?.Draft === 'Yes';

  const groupLabels = { 'Teams': 'Team', 'Pools': 'Pool', 'Divisions': 'Division', 'Pairs': 'Pair' };
  const groupLabel = groupLabels[grouping] || 'Team';

  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || [])
    .filter(p => String(p.PlayerVersion) === String(currentPlayerVersion))
    .filter(p => p.playerExclude !== 'Yes');

  const duprSorted = [...players].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const numberOfGroups = grouping === 'Pairs'
    ? Math.floor(duprSorted.length / 2)
    : (parseInt(activeEvent?.NumberOfTeams) || 2);

  const headingEl = document.getElementById(headingId);
  if (headingEl) headingEl.innerText = groupLabel + 's';

  const draftToggleBlock = document.getElementById(draftToggleBlockId);
  if (draftSupported) {
    draftToggleBlock.style.display = 'flex';
    document.querySelectorAll(`#${draftToggleId} .scoring-option`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === window.gdDraftType);
    });
  } else {
    draftToggleBlock.style.display = 'none';
  }

  const playersPerGroup = computePlayersPerGroup(duprSorted.length, numberOfGroups);
  const groups = Array.from({ length: numberOfGroups }, () => []);

  if (grouping === 'Pairs') {
    const pairs = buildTopBottomPairs(duprSorted);
    pairs.forEach((pair, idx) => { groups[idx] = pair; });
  } else if (draftSupported) {
    const pickOrder = buildDraftPickOrder(numberOfGroups, playersPerGroup);
    pickOrder.forEach((groupIdx, pickIdx) => { groups[groupIdx].push(duprSorted[pickIdx]); });
  } else {
    let cursor = 0;
    playersPerGroup.forEach((count, groupIdx) => {
      groups[groupIdx] = duprSorted.slice(cursor, cursor + count);
      cursor += count;
    });
  }

  renderGroupsUI(groups, groupLabel, players, { groupsListId, nextBtnId, allPlayersPresentVar });

  // heading/draft-toggle already handled above; headingId already set
}

function updateTeamsNextButtonLabel() {
  const btn = document.getElementById('gd-teams-next-btn'); // needs an id — see HTML note below
  if (!btn) return;

  btn.innerText = window.gdAllPlayersPresentValue === 'Yes' ? 'Build Draw' : 'Next';
}

// Persist assignment + move to the final Available screen
function handleTeamsNext() {
  routeToAvailabilityOrBuild();
}

// Generalized N-group drag engine
function enableTeamsDragDrop(numberOfGroups, groupsListId = 'gd-teams-groups-list') {
  const groupContainers = [];
  for (let i = 1; i <= numberOfGroups; i++) {
    const el = document.getElementById(`${groupsListId}-group-${i}`);
    if (el) groupContainers.push(el);
  }

  const containerSelector = groupContainers.map(c => `#${c.id}`).join(', ');

  groupContainers.forEach(container => {
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
          if (touch.clientY < edgeThreshold) scrollContainer.scrollTop -= scrollSpeed;
          else if (touch.clientY > window.innerHeight - edgeThreshold) scrollContainer.scrollTop += scrollSpeed;
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
          if (touch.clientY < midY) targetContainer.insertBefore(placeholder, targetCard);
          else targetContainer.insertBefore(placeholder, targetCard.nextSibling);
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
        commitTeamsAssignment(numberOfGroups, groupsListId);
      });
    });
  });
}

async function commitTeamsAssignment(numberOfGroups, groupsListId = 'gd-teams-groups-list') {
  const payload = window.cachedUserUniverse;
  const updates = [];

  for (let i = 1; i <= numberOfGroups; i++) {
    const container = document.getElementById(`${groupsListId}-group-${i}`);
    if (!container) continue;

    const cardIds = Array.from(container.querySelectorAll('.app-card[data-card-id]')).map(c => c.dataset.cardId);
    cardIds.forEach(pid => {
      const player = payload.players.find(p => p.PlayerID === pid);
      if (player) player.Team = i;
      updates.push(window.updatePlayerTeamInFirestore(pid, i));
    });
  }

  try {
    await Promise.all(updates);
    console.log("Team/Division assignments saved to Firestore.");
  } catch (err) {
    console.error("Failed to save team assignments:", err);
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

async function handleAllPlayersPresentToggle(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  document.querySelectorAll('#gd-all-present-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });

  window.gdAllPlayersPresentValue = value;
  activeEvent.AllPlayersPresent = value;
  await window.updateEventFieldInFirestore(activeEventId, 'AllPlayersPresent', value);

  // Overriding TO Yes clears every player's playerExclude back to No
  if (value === 'Yes') {
    const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
    const players = window.cachedUserUniverse.players.filter(
      p => String(p.PlayerVersion) === String(currentPlayerVersion) && p.playerExclude === 'Yes'
    );

    await Promise.all(players.map(p => {
      p.playerExclude = 'No';
      return window.updatePlayerExcludeInFirestore(p.PlayerID, 'No');
    }));

    console.log(`Cleared playerExclude for ${players.length} player(s) — All Players Present set to Yes.`);
  }
}

function renderPlayerAvailabilityList(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));

  const container = document.getElementById('gd-availability-list');
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

  enableAvailabilityLongPress();
}

function enableAvailabilityLongPress() {
  document.querySelectorAll('#gd-availability-list .app-card[data-card-id]').forEach(card => {
    let longPressTimer = null;

    card.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        togglePlayerExclude(card.dataset.cardId, renderPlayerAvailabilityList); // Generate Draw version
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

async function togglePlayerExclude(playerId, refreshFn) {
  const player = window.cachedUserUniverse.players.find(p => p.PlayerID === playerId);
  if (!player) return;

  const newValue = player.playerExclude === 'Yes' ? 'No' : 'Yes';
  player.playerExclude = newValue;

  try {
    await window.updatePlayerExcludeInFirestore(playerId, newValue);
  } catch (err) {
    console.error("Failed to update player availability:", err);
  }

  refreshFn(window.cachedUserUniverse); // CHANGED — caller decides what to re-render
}

function renderGroupsUI(groups, groupLabel, allPlayersForSeedLookup, ids) {
  const { groupsListId, nextBtnId, allPlayersPresentVar } = ids;

  window.gdGroupAssignment = groups;

  const duprSorted = [...allPlayersForSeedLookup].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const container = document.getElementById(groupsListId);
  let html = '';

  groups.forEach((groupPlayers, idx) => {
    const groupNumber = idx + 1;
    html += `<div class="event-section-title current">${groupLabel} ${groupNumber}</div>`;
    html += `<div class="card-grid" id="${groupsListId}-group-${groupNumber}" data-group-number="${groupNumber}">`;
    groupPlayers.forEach(player => {
      const seedNumber = duprSorted.findIndex(p => p.PlayerID === player.PlayerID) + 1;
      const seedUrl = playerSeeds[0]['seed-' + seedNumber];
      const iconAsset = seedUrl || '🎾';

      const contentHtml = `
        <h3>${player.Name || 'Unnamed Player'}</h3>
        <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
      `;
      html += buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID });
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