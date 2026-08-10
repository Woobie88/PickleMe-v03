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
  document.getElementById('gd-game-type').innerText = gameProfile?.GamesGroup || '—';

  // --- Number Of Rounds ---
  const roundsSupported = gameProfile?.Rounds === 'Yes';
  let roundsValue = roundsSupported ? (parseInt(activeEvent?.NumberofRound) || 1) : 1;

  document.getElementById('gd-rounds-value').innerText = roundsValue;
  document.getElementById('gd-rounds-hidden').value = roundsValue;

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

  // --- Number Of Teams / Divisions (shared field: events.NumberOfTeams) ---
  const teamSupported = gameProfile?.Team === 'Yes';
  const divisionSupported = gameProfile?.Division === 'Yes';
  const teamsGroup = document.getElementById('gd-teams-group');
  const teamsLabel = document.getElementById('gd-teams-label');

  if (teamSupported || divisionSupported) {
    teamsGroup.style.display = '';
    teamsLabel.innerText = divisionSupported ? 'Number Of Divisions' : 'Number Of Teams';

    const teamsValue = parseInt(activeEvent?.NumberOfTeams) || 2;
    document.getElementById('gd-teams-value').innerText = teamsValue;
    document.getElementById('gd-teams-hidden').value = teamsValue;
  } else {
    teamsGroup.style.display = 'none';
  }

  // Ensure NumberOfTeams defaults to 1 whenever it's not applicable to the current game
  ensureTeamsDefaultForGame(activeEventId, gameProfile);
}

async function ensureTeamsDefaultForGame(activeEventId, gameProfile) {
  const teamSupported = gameProfile?.Team === 'Yes';
  const divisionSupported = gameProfile?.Division === 'Yes';

  if (!teamSupported && !divisionSupported) {
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
  current = Math.max(2, current + direction); // minimum 2

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

async function ensureTeamsDefaultForGame(activeEventId, gameProfile) {
  const teamSupported = gameProfile?.Team === 'Yes';
  const divisionSupported = gameProfile?.Division === 'Yes';

  if (!teamSupported && !divisionSupported) {
    const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
    if (activeEvent && activeEvent.NumberOfTeams !== 1) {
      activeEvent.NumberOfTeams = 1;
      await window.updateEventFieldInFirestore(activeEventId, 'NumberOfTeams', 1);
    }
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