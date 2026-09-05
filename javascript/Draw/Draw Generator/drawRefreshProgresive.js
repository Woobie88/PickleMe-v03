async function refreshCurrentRoundMatches() {
  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  const currentRound = parseInt(activeEvent.CurrentRound) || 1;
  const drawVersion = activeEvent.CurrentDrawVersion;
  const userEmail = window.currentUserEmail;

  const allMatches = payload.draw;

  const priorMatches = allMatches.filter(m => parseInt(m.Round) !== currentRound);
  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(priorMatches);

  const thisRoundMatches = allMatches.filter(m => parseInt(m.Round) === currentRound);

  // Remember each court's existing MatchID so the refreshed match can overwrite it
  const oldMatchIdByCourt = {};
  thisRoundMatches.forEach(m => { oldMatchIdByCourt[parseInt(m.Court)] = m.MatchID; });

  const playingIds = new Set();
  thisRoundMatches.forEach(m => {
    [m.Team1Player1, m.Team1Player2, m.Team2Player1, m.Team2Player2]
      .filter(Boolean).forEach(pid => playingIds.add(pid));
  });
  const groupPlayers = payload.players.filter(p => playingIds.has(p.PlayerID));

  const courtsCount = Math.min(
    parseInt(activeEvent.NumberofCourts) || 1,
    Math.floor(groupPlayers.length / 4) || 1
  );
  const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);

  const refreshedMatches = generateGroupMatches(
    groupPlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts,
    currentRound, activeEventId, drawVersion, userEmail
  );

  // Overwrite: reuse the MatchID already assigned to that court this round,
  // so the save writes over the existing document instead of creating a new one.
  refreshedMatches.forEach(m => {
    const existingId = oldMatchIdByCourt[parseInt(m.Court)];
    if (existingId) m.MatchID = existingId;
  });

  window.cachedUserUniverse.draw = [...priorMatches, ...refreshedMatches];

  await window.saveGeneratedDrawToFirestore(refreshedMatches);

  await renderCurrentRoundView(window.cachedUserUniverse);

  window.alert(`Round ${currentRound} matches have been refreshed.`);
}