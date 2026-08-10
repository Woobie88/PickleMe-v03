// Individual Player Add
let indFirstNameManuallyEdited = false;

function handleIndNameInput(value) {
  const firstNameField = document.getElementById('ind-firstname');

  // Auto-fill First Name only if the user hasn't manually typed into it themselves
  if (!indFirstNameManuallyEdited) {
    const firstWord = value.trim().split(/\s+/)[0] || '';
    firstNameField.value = firstWord;
  }

  // Live DUPR lookup as they type the name
  runIndDuprLookup(value);
}

function runIndDuprLookup(name) {
  const statusEl = document.getElementById('ind-match-status');
  const duprIdField = document.getElementById('ind-duprid');
  const duprField = document.getElementById('ind-dupr');

  const trimmed = name.trim();
  if (trimmed.split(/\s+/).length < 2) {
    // Not enough of a name typed yet to attempt a match
    statusEl.innerText = '';
    return;
  }

  const duprDatabase = window.cachedUserUniverse.dupr || [];
  const match = findBestDuprMatch(trimmed, duprDatabase);

  if (match.DUPRId === 'Not Found') {
    statusEl.innerText = 'No DUPR match found — enter manually';
    statusEl.style.color = 'var(--text-muted)';
  } else {
    duprIdField.value = match.DUPRId;
    duprField.value = match.DUPR;
    statusEl.innerText = `Matched: ${match.DUPRId} (DUPR ${match.DUPR})`;
    statusEl.style.color = 'var(--accent)';
  }
}

// Reset Individual Player Screen Load
function resetIndividualAddForm() {
  document.getElementById('ind-name').value = '';
  document.getElementById('ind-firstname').value = '';
  document.getElementById('ind-duprid').value = '';
  document.getElementById('ind-dupr').value = '';
  document.getElementById('ind-match-status').innerText = '';
  indFirstNameManuallyEdited = false;
}

// Write new player add to Firestore
async function commitIndividualAdd() {
  const name = document.getElementById('ind-name').value.trim();
  const firstName = document.getElementById('ind-firstname').value.trim();
  const duprId = document.getElementById('ind-duprid').value.trim() || 'Not Found';
  const duprRating = parseFloat(document.getElementById('ind-dupr').value) || 2.0;

  if (!name) {
    alert("Please enter a name.");
    return;
  }

  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = parseInt(activeEvent.CurrentPlayerVersion) || 0;

  const newPlayer = {
    PlayerID: generatePlayerId(),
    EventID: activeEventId,
    PlayerVersion: currentPlayerVersion,
    Name: name,
    FirstName: firstName,
    DUPRId: duprId,
    DUPR: duprRating,
    RandomNumber: Math.random(),
    Team: null,
    playerExclude: 'No',
    byeOrder: null
  };

  try {
    await window.saveGeneratedPlayersToFirestore([newPlayer]);
    window.cachedUserUniverse.players = [...(payload.players || []), newPlayer];

    alert(`${name} added successfully.`);
    navigateToScreen('players');
  } catch (err) {
    console.error("Failed to add player:", err);
    alert("Failed to add player — check the console for details.");
  }
}
