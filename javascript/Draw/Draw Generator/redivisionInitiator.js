// Render function — populates fields, gates Promote/Relegate to Ladder Scramble only
function renderRedivisionScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent?.GameID;
  const gameProfile = gamesProfile.find(g => g.GameID === gameId);

  document.getElementById('rd-selected-game-title').innerText = gameProfile?.GameTitle || 'No Game Selected';
  document.getElementById('rd-game-type').innerText = gameProfile?.GamesGroup || '—';

  // --- Rounds (same conditional logic as Generate Draw) ---
  const roundsSupported = gameProfile?.Rounds === 'Yes';
  const roundsValue = roundsSupported ? (parseInt(activeEvent?.NumberofRound) || 1) : 1;
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

  // --- Promote/Relegate (Ladder Scramble only) ---
  const promoteGroup = document.getElementById('rd-promote-group');
  if (gameId === 'ladder-scramble') {
    promoteGroup.style.display = '';
    const promoteValue = parseInt(activeEvent?.RedivisionPromoteCount) || 2;
    document.getElementById('rd-promote-value').innerText = promoteValue;
    document.getElementById('rd-promote-hidden').value = promoteValue;
  } else {
    promoteGroup.style.display = 'none';
  }

  // --- Redivision Start Round (default: CurrentRound + 1) ---
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;
  const startRoundValue = currentRound + 1;
  document.getElementById('rd-start-round-value').innerText = startRoundValue;
  document.getElementById('rd-start-round-hidden').value = startRoundValue;
}

// Stepper adjust functions
function adjustRdRounds(direction) {
  const hiddenInput = document.getElementById('rd-rounds-hidden');
  const displaySpan = document.getElementById('rd-rounds-value');
  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustRdLives(direction) {
  const hiddenInput = document.getElementById('rd-lives-hidden');
  const displaySpan = document.getElementById('rd-lives-value');
  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustRdPromoteCount(direction) {
  const hiddenInput = document.getElementById('rd-promote-hidden');
  const displaySpan = document.getElementById('rd-promote-value');
  let current = parseInt(hiddenInput.value) || 2;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustRdStartRound(direction) {
  const hiddenInput = document.getElementById('rd-start-round-hidden');
  const displaySpan = document.getElementById('rd-start-round-value');
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID) === String(window.cachedUserUniverse.activeEventId)
  );
  const currentRound = parseInt(activeEvent?.CurrentRound) || 1;

  let current = parseInt(hiddenInput.value) || (currentRound + 1);
  current = Math.max(currentRound + 1, current + direction); // can't redivide before the next round
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

// Confirm handler — saves config, bumps PlayerVersion, updates existing player docs
async function handleRedivisionConfirm() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  const promoteCount = parseInt(document.getElementById('rd-promote-hidden').value) || 2;
  const startRound = parseInt(document.getElementById('rd-start-round-hidden').value);

  // Save redivision config to the event (used by the next step's team-reallocation logic)
  await window.updateEventFieldInFirestore(activeEventId, 'RedivisionPromoteCount', promoteCount);
  await window.updateEventFieldInFirestore(activeEventId, 'RedivisionStartRound', startRound);
  activeEvent.RedivisionPromoteCount = promoteCount;
  activeEvent.RedivisionStartRound = startRound;

  // Bump PlayerVersion and carry every current player forward under the new version
  const currentPlayerVersion = parseInt(activeEvent.CurrentPlayerVersion) || 0;
  const newPlayerVersion = currentPlayerVersion + 1;

  const players = window.cachedUserUniverse.players.filter(
    p => String(p.PlayerVersion) === String(currentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  try {
    await Promise.all(players.map(p => window.updatePlayerVersionInFirestore(p.PlayerID, newPlayerVersion)));

    await window.updateEventFieldInFirestore(activeEventId, 'CurrentPlayerVersion', newPlayerVersion);
    activeEvent.CurrentPlayerVersion = newPlayerVersion;
    players.forEach(p => { p.PlayerVersion = newPlayerVersion; }); // keep local cache in sync

    console.log(`Redivision: carried ${players.length} player(s) forward to PlayerVersion ${newPlayerVersion}. Team reallocation not yet applied.`);
    alert("New player version created. Team reallocation will be added in the next step.");
    navigateToScreen('draw');
  } catch (err) {
    console.error("Redivision failed:", err);
    alert("Redivision failed — check the console for details.");
  }
}