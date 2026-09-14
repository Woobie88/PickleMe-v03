async function playerDUPRrefresh() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = activeEvent.CurrentPlayerVersion;

  const players = window.cachedUserUniverse.players.filter(
    p => String(p.PlayerVersion) === String(currentPlayerVersion)
  );

  const duprDatabase = window.cachedUserUniverse.dupr && window.cachedUserUniverse.dupr.length > 0
    ? window.cachedUserUniverse.dupr
    : await window.fetchDuprDatabaseFromFirestore();
  window.cachedUserUniverse.dupr = duprDatabase;

  let updatedCount = 0;
  const updates = [];

  players.forEach(player => {
    if (!player.DUPRId || player.DUPRId === 'Not Found') return; // nothing to look up for these

    const duprRecord = duprDatabase.find(d => d.DUPRId === player.DUPRId);
    if (!duprRecord) return;

    const newRating = parseFloat(duprRecord['DUPR Rating']) || player.DUPR;
    if (newRating !== player.DUPR) {
      player.DUPR = newRating;
      updates.push(window.updatePlayerFieldInFirestore(player.PlayerID, 'DUPR', newRating));
      updatedCount++;
    }
  });

  try {
    await Promise.all(updates);
    alert(`DUPR ratings refreshed for ${updatedCount} player(s).`);
    renderPlayerCards(window.cachedUserUniverse);
  } catch (err) {
    console.error("Failed to refresh DUPR ratings:", err);
    alert("Failed to refresh DUPR ratings — check the console for details.");
  }
}