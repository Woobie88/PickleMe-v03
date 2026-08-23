const PLAYOFF_ROUND_NAMES = {
  1: ['Final'],
  2: ['Elimination Final', 'Final'],
  3: ['Semi Final', 'Elimination Final', 'Final'],
  4: ['Qualifying Final', 'Semi Final', 'Elimination Final', 'Final']
};

function renderPlayoffsScreen(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  const roundsValue = Math.min(4, Math.max(1, parseInt(activeEvent?.PlayoffRounds) || 1));

  document.getElementById('po-rounds-value').innerText = roundsValue;
  document.getElementById('po-rounds-hidden').value = roundsValue;

  renderPlayoffFinalTypeList(roundsValue);
}

function renderPlayoffFinalTypeList(roundsValue) {
  const roundNames = PLAYOFF_ROUND_NAMES[roundsValue] || [];
  const container = document.getElementById('po-final-type-list');

  container.innerHTML = roundNames.map(name =>
    `<div class="detail-readonly">${name}</div>`
  ).join('');
}

function adjustPoRounds(direction) {
  const hiddenInput = document.getElementById('po-rounds-hidden');
  const displaySpan = document.getElementById('po-rounds-value');

  let current = parseInt(hiddenInput.value) || 1;
  current = Math.min(4, Math.max(1, current + direction));

  hiddenInput.value = current;
  displaySpan.innerText = current;

  renderPlayoffFinalTypeList(current);
}

async function handlePlayoffsNext() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));

  const roundsValue = parseInt(document.getElementById('po-rounds-hidden').value) || 1;

  activeEvent.PlayoffRounds = roundsValue;
  await window.updateEventFieldInFirestore(activeEventId, 'PlayoffRounds', roundsValue);

  console.log(`Playoffs configured: ${roundsValue} round(s) — ${PLAYOFF_ROUND_NAMES[roundsValue].join(', ')}`);

  const payload = window.cachedUserUniverse;
  const drawVersion = activeEvent.CurrentDrawVersion;
  const userEmail = window.currentUserEmail;

  // Playoffs get its own round-numbering, starting right after the regular event's last round
  const existingMatches = payload.draw || [];
  const lastRegularRound = existingMatches.reduce((max, m) => Math.max(max, parseInt(m.Round) || 0), 0);
  const playoffStartRound = lastRegularRound + 1;

  let newMatches;

  if (roundsValue === 1) {
    newMatches = generatePlayoffFinalRound(payload, playoffStartRound, activeEventId, drawVersion, userEmail);
  } else if (roundsValue === 2) {
    newMatches = generatePlayoffEliminationRound(payload, playoffStartRound, activeEventId, drawVersion, userEmail);

    // NEW — remember which rounds are EF and Final, so goToNextRound knows when to trigger the Final generation
    activeEvent.PlayoffEFRound = playoffStartRound;
    activeEvent.PlayoffFinalRound = playoffStartRound + 1;
    await window.updateEventFieldInFirestore(activeEventId, 'PlayoffEFRound', playoffStartRound);
    await window.updateEventFieldInFirestore(activeEventId, 'PlayoffFinalRound', playoffStartRound + 1);
  } else {
    alert(`${roundsValue}-round Playoffs isn't built yet — only 1 and 2 rounds are currently supported.`);
    return;
  }

  try {
    await window.saveGeneratedDrawToFirestore(newMatches);
    window.cachedUserUniverse.draw = [...existingMatches, ...newMatches];
    console.log(`Playoffs Round ${playoffStartRound} generated: ${newMatches.length} match(es).`);
    navigateToScreen('draw');
  } catch (err) {
    console.error("Failed to save playoff matches:", err);
    alert("Failed to generate playoff matches — check the console for details.");
  }
}

