async function refreshCurrentRoundMatches() {
  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  const currentRound = parseInt(activeEvent.CurrentRound) || 1;
  const drawVersion = activeEvent.CurrentDrawVersion;
  const userEmail = window.currentUserEmail;

  const allMatches = payload.draw;

  // History for repeat-avoidance: ONLY rounds actually played before this one —
  // excludes both the current round AND any future/dummy rounds
  const historyMatches = allMatches.filter(m => parseInt(m.Round) < currentRound); // CHANGED

  // Everything except the round being replaced — needed to correctly
  // reconstruct the full local draw cache without losing future rounds
  const otherRoundsMatches = allMatches.filter(m => parseInt(m.Round) !== currentRound); // NEW — kept as the original logic, just renamed

  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(historyMatches); // CHANGED — uses historyMatches now

  const thisRoundMatches = allMatches.filter(m => parseInt(m.Round) === currentRound);

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

  refreshedMatches.forEach(m => {
    const existingId = oldMatchIdByCourt[parseInt(m.Court)];
    if (existingId) m.MatchID = existingId;
  });

  window.cachedUserUniverse.draw = [...otherRoundsMatches, ...refreshedMatches]; // CHANGED — uses otherRoundsMatches, preserves future rounds

  await window.saveGeneratedDrawToFirestore(refreshedMatches);

  await renderCurrentRoundView(window.cachedUserUniverse);

  window.alert(`Round ${currentRound} matches have been refreshed.`);
}