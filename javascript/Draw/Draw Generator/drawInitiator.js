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

// DETERMINE NEXT ACTION FROM INITIAL DRAW CONDITIONS
function handleDetailsNext() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const needsGroups = gameProfile?.Team === 'Yes' || gameProfile?.Division === 'Yes';

  if (needsGroups) {
    navigateToScreen('generate-draw-teams');
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

function renderGenerateDrawTeams(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const gameProfile = gamesProfile.find(g => g.GameID === activeEvent?.GameID);

  const divisionSupported = gameProfile?.Division === 'Yes';
  const draftSupported = gameProfile?.Draft === 'Yes';
  const groupLabel = divisionSupported ? 'Division' : 'Team';
  const numberOfGroups = parseInt(activeEvent?.NumberOfTeams) || 2;

  document.getElementById('gd-teams-screen-heading').innerText = divisionSupported ? 'Divisions' : 'Teams';

  const draftToggleBlock = document.getElementById('gd-draft-toggle-block');
  if (draftSupported) {
    draftToggleBlock.style.display = 'flex';
    document.querySelectorAll('#gd-draft-toggle .scoring-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === window.gdDraftType);
    });
  } else {
    draftToggleBlock.style.display = 'none';
  }

  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;
  const players = (payload.players || [])
    .filter(p => String(p.PlayerVersion) === String(currentPlayerVersion))
    .filter(p => p.playerExclude !== 'Yes'); // same exclusion rule as the draw generator

  const duprSorted = [...players].sort((a, b) => {
    const duprDiff = (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0);
    if (duprDiff !== 0) return duprDiff;
    return (parseFloat(a.RandomNumber) || 0) - (parseFloat(b.RandomNumber) || 0);
  });

  const playersPerGroup = computePlayersPerGroup(duprSorted.length, numberOfGroups);

  // Build the group assignments — either straight contiguous blocks (no draft) or draft-order pick sequence
  const groups = Array.from({ length: numberOfGroups }, () => []);

  if (draftSupported) {
    const pickOrder = buildDraftPickOrder(numberOfGroups, playersPerGroup);
    pickOrder.forEach((groupIdx, pickIdx) => {
      groups[groupIdx].push(duprSorted[pickIdx]);
    });
  } else {
    let cursor = 0;
    playersPerGroup.forEach((count, groupIdx) => {
      groups[groupIdx] = duprSorted.slice(cursor, cursor + count);
      cursor += count;
    });
  }

  // Store assignment in-memory so handleTeamsNext() can persist it
  window.gdGroupAssignment = groups;

  const container = document.getElementById('gd-teams-groups-list');
  let html = '';

  groups.forEach((groupPlayers, idx) => {
    html += `<div class="event-section-title current">${groupLabel} ${idx + 1}</div>`;
    groupPlayers.forEach(player => {
      // Find this player's overall seed rank (DUPR position across ALL players, not just within their group)
      const seedNumber = duprSorted.findIndex(p => p.PlayerID === player.PlayerID) + 1;
      const seedUrl = playerSeeds[0]['seed-' + seedNumber];
      const iconAsset = seedUrl || '🎾';

      const contentHtml = `
        <h3>${player.Name || 'Unnamed Player'}</h3>
        <p class="card-meta-line">${player.DUPRId || 'N/A'} ${player.DUPR ? ' || DUPR ' + player.DUPR : '0'}</p>
      `;
      html += buildCardMarkup({ iconAsset, contentHtml, cardId: player.PlayerID });
    });
  });

  container.innerHTML = html || `<div class="no-data-placeholder"><h3>No Players Found</h3></div>`;
}

// Persist assignment + move to the final Available screen
async function handleTeamsNext() {
  const groups = window.gdGroupAssignment || [];
  const updates = [];

  groups.forEach((groupPlayers, idx) => {
    const teamNumber = idx + 1;
    groupPlayers.forEach(player => {
      player.Team = teamNumber; // update local cache immediately
      updates.push(window.updatePlayerTeamInFirestore(player.PlayerID, teamNumber));
    });
  });

  try {
    await Promise.all(updates);
    console.log("Team/Division assignments saved to Firestore.");
  } catch (err) {
    console.error("Failed to save team assignments:", err);
  }

  navigateToScreen('generate-draw-available');
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