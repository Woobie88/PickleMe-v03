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
  
  // Build playoff schedule
  generatePlayoffFinalRound(payload, roundsValue, activeEvent, drawVersion, userEmail);
}

