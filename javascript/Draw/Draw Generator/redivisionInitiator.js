// Render function — populates fields, gates Promote/Relegate to Ladder Scramble only
function renderRedivisionScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('rd-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';

  // --- Rounds ---
  const isProgressive = gameProfile?.GamesGroup === 'Progressive';
  const roundsSupported = gameProfile?.Rounds === 'Yes' || isProgressive;
  let roundsValue = roundsSupported ? (parseInt(activeEvent?.NumberofRound) || 1) : 1;

  document.getElementById('rd-rounds-value').innerText = roundsValue;
  document.getElementById('rd-rounds-hidden').value = roundsValue;
  document.querySelectorAll('#rd-rounds-group .score-btn').forEach(btn => {
    btn.disabled = !roundsSupported;
    btn.style.opacity = roundsSupported ? '1' : '0.4';
  });

  // --- Lives ---
  const livesSupported = gameProfile?.Lives === 'Yes';
  const livesGroup = document.getElementById('rd-lives-group');
  if (livesSupported) {
    livesGroup.style.display = '';
    const livesValue = parseInt(activeEvent?.Lives) || 1;
    document.getElementById('rd-lives-value').innerText = livesValue;
    document.getElementById('rd-lives-hidden').value = livesValue;
  } else {
    livesGroup.style.display = 'none';
  }

  // --- Number Of Teams/Pools/Divisions — visible but LOCKED on Redivision ---
  const grouping = gameProfile?.Grouping || 'None';
  const groupingLabels = {
    'Teams': 'Number Of Teams',
    'Pools': 'Number Of Pools',
    'Divisions': 'Number Of Divisions'
  };
  const teamsGroup = document.getElementById('rd-teams-group');
  const teamsLabel = document.getElementById('rd-teams-label');

  if (groupingLabels[grouping]) {
    teamsGroup.style.display = '';
    teamsLabel.innerText = groupingLabels[grouping];
    const teamsValue = parseInt(activeEvent?.NumberOfTeams) || 2;
    document.getElementById('rd-teams-value').innerText = teamsValue;
    document.getElementById('rd-teams-hidden').value = teamsValue;

    // DIFFERENCE #1 — always disabled here, regardless of anything else
    document.querySelectorAll('#rd-teams-group .score-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
    });
  } else {
    teamsGroup.style.display = 'none';
  }

  // --- Promote/Relegate (Ladder Scramble only) — unchanged from before ---
  const promoteGroup = document.getElementById('rd-promote-group');
  if (gameId === 'ladder-scramble') {
    promoteGroup.style.display = '';
    const promoteValue = parseInt(activeEvent?.RedivisionPromoteCount) || 2;
    document.getElementById('rd-promote-value').innerText = promoteValue;
    document.getElementById('rd-promote-hidden').value = promoteValue;
  } else {
    promoteGroup.style.display = 'none';
  }

  // --- All Players Present toggle (mirrors Generate Draw) ---
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || []).filter(p => String(p.PlayerVersion) === String(currentPlayerVersion));
  const anyExcluded = players.some(p => p.playerExclude === 'Yes');
  const computedDefault = anyExcluded ? 'No' : 'Yes';
  const currentValue = activeEvent.AllPlayersPresent || computedDefault;

  document.querySelectorAll('#rd-all-present-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === currentValue);
  });
  window.rdAllPlayersPresentValue = currentValue;

  // --- DIFFERENCE #2 — smarter default for Redivision Starts From Round ---
  const matches = window.cachedUserUniverse.draw || [];
  const allRounds = [...new Set(matches.map(m => parseInt(m.Round) || 0))];
  const highestCompleteRound = allRounds.filter(r => isRoundComplete(matches, r)).reduce((max, r) => Math.max(max, r), 0);
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;
  const startRoundValue = Math.max(highestCompleteRound, currentRound);

  document.getElementById('rd-start-round-value').innerText = startRoundValue;
  document.getElementById('rd-start-round-hidden').value = startRoundValue;
}

function renderRedivisionTeamsScreen(payload) {
  renderGenerateDrawTeams(payload); // reuse entirely — group-building logic doesn't differ

  const btn = document.getElementById('rd-teams-next-btn');
  if (!btn) return;
  btn.innerText = window.rdAllPlayersPresentValue === 'Yes' ? 'Build Draw' : 'Next';
}

function handleRedivisionTeamsNext() {
  routeRedivisionToAvailabilityOrBuild();
}

function routeRedivisionToAvailabilityOrBuild() {
  if (window.rdAllPlayersPresentValue === 'Yes') {
    handleRedivisionBuild();
  } else {
    navigateToScreen('redivision-available');
  }
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

async function handleRdAllPlayersPresentToggle(value) {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  document.querySelectorAll('#rd-all-present-toggle .scoring-option').forEach(btn => {
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

  const container = document.getElementById('rd-availability-list');
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

function handleRedivisionBuild() {
  console.log('Redivision build not yet implemented.', window.rdConfig);
  alert('Redivision logic coming soon — screen flow is wired and ready.');
}