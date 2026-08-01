function handleCleanupDrawToggle() {
  const drawChecked = document.getElementById('cleanup-delete-draw').checked;
  const playersCheckbox = document.getElementById('cleanup-delete-players');

  playersCheckbox.disabled = !drawChecked;
  if (!drawChecked) {
    playersCheckbox.checked = false; // force-uncheck if draw gets unchecked
  }
}

async function confirmCleanupSelection() {
  const deleteDraw = document.getElementById('cleanup-delete-draw').checked;
  const deletePlayers = document.getElementById('cleanup-delete-players').checked;

  if (!deleteDraw && !deletePlayers) {
    alert("Please select at least one option to delete.");
    return;
  }

  const confirmMessage = deletePlayers
    ? "This will permanently delete the Draw AND Players for this event. This cannot be undone. Continue?"
    : "This will permanently delete the Draw for this event. This cannot be undone. Continue?";

  if (!confirm(confirmMessage)) {
    return; // user cancelled
  }

  const activeEventId = window.cachedUserUniverse.activeEventId;

  try {
    if (deleteDraw) {
      await window.deleteAllDrawDocumentsInFirestore(activeEventId);
    }
    if (deletePlayers) {
      await window.deleteAllPlayerDocumentsInFirestore(activeEventId);
    }

    await window.resetEventVersionsInFirestore(activeEventId, deleteDraw, deletePlayers);

    // Update local cache
    const activeEvent = window.cachedUserUniverse.events.find(
      e => String(e.EventID || e.eventId) === String(activeEventId)
    );
    if (activeEvent) {
      if (deleteDraw) activeEvent.CurrentDrawVersion = 0;
      if (deletePlayers) activeEvent.CurrentPlayerVersion = 0;
    }
    if (deleteDraw) window.cachedUserUniverse.draw = [];
    if (deletePlayers) window.cachedUserUniverse.players = [];

    alert("Clean up completed successfully.");
    navigateToScreen('dashboard');
  } catch (err) {
    console.error("Clean up failed:", err);
    alert("Clean up failed — check the console for details.");
  }
}
